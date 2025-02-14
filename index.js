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

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

// ✅ Initialize Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

console.log("🤖 Telegram bot is running...");

// ✅ Function to create a new Lambda with a publicly accessible Function URL
const createLambda = async (chatId) => {
    const functionName = `lambda-${Date.now().toString(36)}`;

    try {
        console.log(`🚀 Creating Lambda function: ${functionName}...`);

        // Read the zip file containing the Lambda function code
        const zipFile = fs.readFileSync("./index.mjs.zip");

        // Step 1: Create Lambda Function
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

        // Step 3: Add Public Access Permission
        const addPermission = new AddPermissionCommand({
            FunctionName: functionName,
            StatementId: "FunctionURLPublicAccess",
            Action: "lambda:InvokeFunctionUrl",
            Principal: "*",
            FunctionUrlAuthType: "NONE"
        });

        await lambdaClient.send(addPermission);
        bot.sendMessage(chatId, `🚀 Lambda Function URL: ${functionUrl} (Publicly Accessible)`);

        // ✅ Step 4: Store Function URL in DynamoDB with Default Config `0`
        const putCommand = new PutItemCommand({
            TableName: "Config",
            Item: {
                subdomain: { S: functionUrl }, // Function URL as key
                config: { N: "0" } // Default config value
            }
        });

        await dynamoClient.send(putCommand);
        bot.sendMessage(chatId, `✅ Stored function in DynamoDB with default config.`);

        return functionUrl;
    } catch (error) {
        console.error("❌ Error creating Lambda function:", error);
        bot.sendMessage(chatId, `❌ Error creating Lambda function. Check logs. Error: ${error.message}`);
    }
};

// ✅ Handle Telegram Command: `/newlambda`
bot.onText(/\/newlambda/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`📥 Received /newlambda command from ${chatId}`);

    bot.sendMessage(chatId, "⏳ Creating a unique Lambda function...");
    await createLambda(chatId);
});

// ✅ General Message Handler (Confirms Bot is Running)
bot.on("message", (msg) => {
    const chatId = msg.chat.id;
    if (msg.text !== "/newlambda") {
        bot.sendMessage(chatId, "✅ I'm alive! Send `/newlambda` to create a Lambda function.");
    }
});

// ✅ Start Polling Error Handling
bot.on("polling_error", (error) => {
    console.error("🚨 Polling Error:", error);
});
