import TelegramBot from "node-telegram-bot-api";
import {
    LambdaClient,
    CreateFunctionCommand,
    CreateFunctionUrlConfigCommand,
    AddPermissionCommand
} from "@aws-sdk/client-lambda";
import { IAMClient, PutRolePolicyCommand } from "@aws-sdk/client-iam";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// ✅ Initialize AWS Lambda & IAM Clients with Credentials
const lambdaClient = new LambdaClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const iamClient = new IAMClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// ✅ Initialize Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

console.log("🤖 Telegram bot is running...");

// ✅ Function to create a new Lambda with a publicly accessible Function URL
const createLambda = async (chatId) => {
    const functionName = `lambda-${Date.now().toString(36)}`;

    try {
        const zipFile = fs.readFileSync("./index.mjs.zip");

        console.log(`🚀 Creating Lambda function: ${functionName}...`);

        if (!process.env.AWS_ROLE_ARN) {
            console.error("❌ ERROR: AWS_ROLE_ARN is missing. Set it in .env and restart the bot.");
            bot.sendMessage(chatId, "❌ ERROR: AWS_ROLE_ARN is missing. Please set it in the .env file.");
            return;
        }
        
        // Check if the Lambda function ZIP file exists
        if (!fs.existsSync("./index.mjs.zip")) {
            console.error("❌ ERROR: Lambda ZIP file not found.");
            bot.sendMessage(chatId, "❌ ERROR: Lambda ZIP file not found. Ensure 'index.mjs.zip' exists in the bot directory.");
            return;
        }
        console.log("🚀 Lambda Function Parameters:", {
            FunctionName: functionName,
            Runtime: "nodejs18.x",
            Role: process.env.AWS_ROLE_ARN,
            Handler: "index.handler",
            Timeout: 10,
            MemorySize: 128,
        });
        
        const createFunction = new CreateFunctionCommand({
            FunctionName: functionName,
            Runtime: "nodejs18.x",
            Role: process.env.AWS_ROLE_ARN.trim(),  // ✅ Trim whitespace to prevent errors
            Handler: "index.handler",
            Code: { ZipFile: fs.readFileSync("./index.mjs.zip") },  // ✅ Ensure it loads properly
            Timeout: 10,  // ✅ Ensure a timeout is set (AWS requires this)
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

        const addPermission = new AddPermissionCommand({
            FunctionName: functionName,
            StatementId: "FunctionURLPublicAccess",
            Action: "lambda:InvokeFunctionUrl",
            Principal: "*",
            FunctionUrlAuthType: "NONE"  // ✅ FIXED: This is the correct parameter
        });
        
        await lambdaClient.send(addPermission);

        // ✅ Step 4: Add an Inline Policy to IAM Role to Ensure Access
        const lambdaResourceArn = `arn:aws:lambda:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:function:${functionName}`;

        const policyDocument = JSON.stringify({
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Action: "lambda:InvokeFunctionUrl",
                    Resource: lambdaResourceArn,
                    Principal: "*"
                }
            ]
        });

        const putRolePolicy = new PutRolePolicyCommand({
            RoleName: process.env.AWS_ROLE_NAME,
            PolicyName: `${functionName}-PublicAccessPolicy`,
            PolicyDocument: policyDocument
        });

        await iamClient.send(putRolePolicy);

        // ✅ Send the Function URL back to the Telegram chat
        bot.sendMessage(chatId, `🚀 Lambda Function URL: ${functionUrl} (Publicly Accessible)`);
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
