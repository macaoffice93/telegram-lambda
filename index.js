import TelegramBot from "node-telegram-bot-api";
import { LambdaClient, CreateFunctionCommand, CreateFunctionUrlConfigCommand } from "@aws-sdk/client-lambda";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// ✅ Initialize Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// ✅ Initialize AWS Lambda Client
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });

// ✅ Function to generate a unique subdomain
const generateUniqueSubdomain = () => {
    const timestamp = Date.now().toString(36); // Base36 timestamp
    const randomStr = Math.random().toString(36).substring(2, 8); // Random string
    return `lambda-${timestamp}-${randomStr}`;
};

// ✅ Function to create a new Lambda with Function URL
const createLambda = async (chatId) => {
    const subdomain = generateUniqueSubdomain();
    const functionName = `${subdomain}-function`;

    try {
        // Step 1: Read the Lambda function code from a .zip file
        const zipFile = fs.readFileSync("./index.mjs.zip");

        // Step 2: Create Lambda Function
        const createFunction = new CreateFunctionCommand({
            FunctionName: functionName,
            Runtime: "nodejs18.x",
            Role: process.env.AWS_ROLE_ARN,
            Handler: "index.handler",
            Code: { ZipFile: zipFile }
        });

        await lambdaClient.send(createFunction);
        bot.sendMessage(chatId, `✅ Lambda function '${functionName}' created successfully.`);

        // Step 3: Enable Function URL
        const createFunctionUrl = new CreateFunctionUrlConfigCommand({
            FunctionName: functionName,
            AuthType: "NONE",
        });

        const response = await lambdaClient.send(createFunctionUrl);
        const functionUrl = response.FunctionUrl;

        bot.sendMessage(chatId, `🚀 Lambda Function URL: ${functionUrl}`);
        return functionUrl;
    } catch (error) {
        console.error("❌ Error creating Lambda function:", error);
        bot.sendMessage(chatId, `❌ Error creating Lambda function. Check logs. Error: ${error.message}`);
    }
};

// ✅ Handle Telegram Command: `/newlambda`
bot.onText(/\/newlambda/, async (msg) => {
    const chatId = msg.chat.id;

    bot.sendMessage(chatId, `⏳ Generating a unique Lambda function...`);
    await createLambda(chatId);
});

// ✅ General Message Handler (Confirms Polling Works)
bot.on("message", (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "✅ I'm alive! Send `/newlambda` to create a unique Lambda function.");
});

// ✅ Start the bot and log errors
bot.on("polling_error", (error) => {
    console.error("🚨 Polling Error:", error);
});

console.log("🤖 Telegram bot is running...");
