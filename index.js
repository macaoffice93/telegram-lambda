import TelegramBot from "node-telegram-bot-api";
import {
    LambdaClient,
    CreateFunctionCommand,
    CreateFunctionUrlConfigCommand,
    AddPermissionCommand
} from "@aws-sdk/client-lambda";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// ✅ Initialize AWS Clients
const lambdaClient = new LambdaClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const dynamoClient = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// ✅ Initialize Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

console.log("🤖 Telegram bot is running...");

// ✅ Store Lambda URL in DynamoDB
const storeFunctionUrl = async (functionUrl) => {
    const subdomain = new URL(functionUrl).hostname.split(".")[0];

    const params = {
        TableName: "Config",
        Item: {
            subdomain: { S: subdomain },
            config: { N: "0" } // ✅ Ensuring the config value is stored as a number
        }
    };

    try {
        await dynamoClient.send(new PutItemCommand(params));
        console.log(`✅ Stored '${subdomain}' in DynamoDB with default config 0.`);
    } catch (error) {
        console.error("❌ Error storing Lambda URL in DynamoDB:", error);
    }
};

// ✅ Create Lambda Function
const createLambda = async (chatId) => {
    const functionName = `lambda-${Date.now().toString(36)}`;

    try {
        console.log(`🚀 Creating Lambda function: ${functionName}...`);
        const zipFile = fs.readFileSync("./index.mjs.zip");

        // Step 1: Create the Lambda Function
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

        // Step 2: Enable Function URL
        const createFunctionUrl = new CreateFunctionUrlConfigCommand({
            FunctionName: functionName,
            AuthType: "NONE",
        });

        const response = await lambdaClient.send(createFunctionUrl);
        const functionUrl = response.FunctionUrl;

        // Step 3: Add Public Access Permission (FIX)
        const addPermission = new AddPermissionCommand({
            FunctionName: functionName,
            StatementId: "AllowPublicAccess",
            Action: "lambda:InvokeFunctionUrl",
            Principal: "*",
            FunctionUrlAuthType: "NONE"
        });

        await lambdaClient.send(addPermission);

        // ✅ Store Function URL in DynamoDB
        await storeFunctionUrl(functionUrl);

        bot.sendMessage(chatId, `🚀 Lambda Function URL: ${functionUrl} (Publicly Accessible)`);
        return functionUrl;
    } catch (error) {
        console.error("❌ Error creating Lambda function:", error);
        bot.sendMessage(chatId, `❌ Error creating Lambda function. Check logs. Error: ${error.message}`);
    }
};

// ✅ Telegram Bot Setup
bot.onText(/\/newlambda/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`📥 Received /newlambda command from ${chatId}`);

    bot.sendMessage(chatId, "⏳ Creating a unique Lambda function...");
    await createLambda(chatId);
});

bot.on("message", (msg) => {
    const chatId = msg.chat.id;
    if (msg.text !== "/newlambda") {
        bot.sendMessage(chatId, "✅ I'm alive! Send `/newlambda` to create a Lambda function.");
    }
});

bot.on("polling_error", (error) => {
    console.error("🚨 Polling Error:", error);
});
