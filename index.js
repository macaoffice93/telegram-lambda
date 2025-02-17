import TelegramBot from "node-telegram-bot-api";
import {
    LambdaClient,
    CreateFunctionCommand,
    CreateFunctionUrlConfigCommand,
    AddPermissionCommand
} from "@aws-sdk/client-lambda";
import { DynamoDBClient, PutItemCommand, UpdateItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// ✅ Allowed Conversation ID (Set in .env, converted to number)
const AUTHORIZED_CHAT_ID = Number(process.env.TELEGRAM_AUTHORIZED_CHAT_ID);

if (!AUTHORIZED_CHAT_ID) {
    console.error("❌ ERROR: TELEGRAM_AUTHORIZED_CHAT_ID is not set in environment variables.");
    process.exit(1);
}

// ✅ Initialize AWS Clients
const lambdaClient = new LambdaClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

// ✅ Middleware to check if the message is from an authorized chat
const isAuthorized = (chatId) => {
    if (chatId !== AUTHORIZED_CHAT_ID) {
        console.log(`🚫 Unauthorized attempt from chat ID: ${chatId}`);
        return false;
    }
    return true;
};

// ✅ Function to store function URL in DynamoDB
const storeFunctionUrl = async (functionUrl) => {
    try {
        const urlParts = new URL(functionUrl).hostname.split(".");
        const subdomain = urlParts[0];

        console.log(`📝 Storing subdomain '${subdomain}' in DynamoDB...`);

        const putParams = {
            TableName: "Config",
            Item: {
                subdomain: { S: subdomain },
                functionUrl: { S: functionUrl },
                config: { N: "0" }
            }
        };

        await dynamoClient.send(new PutItemCommand(putParams));
        console.log(`✅ Subdomain '${subdomain}' stored successfully!`);
        return true;
    } catch (error) {
        console.error("❌ DynamoDB Error:", error);
        return false;
    }
};

// ✅ Function to create a new Lambda function
const createLambda = async (chatId) => {
    if (!isAuthorized(chatId)) {
        bot.sendMessage(chatId, "🚫 You are not authorized to use this bot.");
        return;
    }

    const functionName = `lambda-${Date.now().toString(36)}`;

    try {
        console.log(`🚀 Creating Lambda function: ${functionName}...`);
        
        const zipFile = fs.readFileSync("./index.mjs.zip");

        const createFunction = new CreateFunctionCommand({
            FunctionName: functionName,
            Runtime: "nodejs18.x",
            Role: process.env.AWS_ROLE_ARN.trim(),
            Handler: "index.handler",
            Code: { ZipFile: zipFile },
            Timeout: 10,
            MemorySize: 128
        });

        await lambdaClient.send(createFunction);
        bot.sendMessage(chatId, `✅ Lambda function '${functionName}' created successfully.`);

        const createFunctionUrl = new CreateFunctionUrlConfigCommand({
            FunctionName: functionName,
            AuthType: "NONE",
        });

        const response = await lambdaClient.send(createFunctionUrl);
        const functionUrl = response.FunctionUrl;

        const addPermission = new AddPermissionCommand({
            FunctionName: functionName,
            StatementId: "FunctionURLPublicAccess",
            Action: "lambda:InvokeFunctionUrl",
            Principal: "*",
            FunctionUrlAuthType: "NONE"
        });

        await lambdaClient.send(addPermission);
        bot.sendMessage(chatId, `🚀 Lambda Function URL: ${functionUrl} (Publicly Accessible)`);

        const stored = await storeFunctionUrl(functionUrl);
        if (!stored) {
            bot.sendMessage(chatId, `⚠️ Warning: Could not store function URL in DynamoDB.`);
        }

        return functionUrl;
    } catch (error) {
        console.error("❌ Error creating Lambda function:", error);
        bot.sendMessage(chatId, `❌ Error creating Lambda function. Check logs. Error: ${error.message}`);
    }
};

// ✅ Function to update configuration in DynamoDB
const updateConfig = async (chatId, inputSubdomainOrUrl, newValue) => {
    if (!isAuthorized(chatId)) {
        bot.sendMessage(chatId, "🚫 You are not authorized to use this bot.");
        return;
    }

    try {
        let subdomain;
        if (inputSubdomainOrUrl.includes(".")) {
            subdomain = new URL(inputSubdomainOrUrl).hostname.split(".")[0];
        } else {
            subdomain = inputSubdomainOrUrl;
        }

        console.log(`🔄 Updating config for subdomain: ${subdomain} with value: ${newValue}`);

        const getParams = {
            TableName: "Config",
            Key: {
                subdomain: { S: subdomain }
            }
        };

        const getResponse = await dynamoClient.send(new GetItemCommand(getParams));

        if (!getResponse.Item) {
            bot.sendMessage(chatId, `❌ Error: No function found for subdomain '${subdomain}'.`);
            return;
        }

        const functionUrl = getResponse.Item.functionUrl?.S || "Unknown";

        const updateParams = {
            TableName: "Config",
            Key: {
                subdomain: { S: subdomain }
            },
            UpdateExpression: "SET config = :newValue",
            ExpressionAttributeValues: {
                ":newValue": { N: newValue.toString() }
            },
            ReturnValues: "UPDATED_NEW"
        };

        await dynamoClient.send(new UpdateItemCommand(updateParams));

        bot.sendMessage(chatId, `✅ Config updated for '${subdomain}'. New value: ${newValue}\n🌍 Function URL: ${functionUrl}`);
    } catch (error) {
        console.error("❌ Error updating configuration:", error);
        bot.sendMessage(chatId, `❌ Error updating configuration. Check logs.`);
    }
};

// ✅ Initialize Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

console.log("🤖 Telegram bot is running...");

// ✅ Handle Telegram Command: `/newlambda`
bot.onText(/\/newlambda/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAuthorized(chatId)) {
        bot.sendMessage(chatId, "🚫 You are not authorized to use this bot.");
        return;
    }
    console.log(`📥 Received /newlambda command from ${chatId}`);
    bot.sendMessage(chatId, "⏳ Creating a unique Lambda function...");
    await createLambda(chatId);
});

// ✅ Handle Telegram Command: `/updateconfig <subdomain/url> <value>`
bot.onText(/\/updateconfig (.+) (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAuthorized(chatId)) {
        bot.sendMessage(chatId, "🚫 You are not authorized to use this bot.");
        return;
    }
    const subdomainOrUrl = match[1].trim();
    const newValue = match[2].trim();

    if (!subdomainOrUrl || isNaN(newValue)) {
        bot.sendMessage(chatId, "❌ Invalid format. Use `/updateconfig <subdomain/url> <value>`");
        return;
    }

    await updateConfig(chatId, subdomainOrUrl, newValue);
});

// ✅ Start Polling Error Handling
bot.on("polling_error", (error) => {
    console.error("🚨 Polling Error:", error);
});
