import { LambdaClient, CreateFunctionCommand, CreateFunctionUrlConfigCommand, AddPermissionCommand } from "@aws-sdk/client-lambda";

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });

const createLambda = async (chatId) => {
    const functionName = `lambda-${Date.now().toString(36)}`;
    
    try {
        const zipFile = fs.readFileSync("./index.mjs.zip");

        // Step 1: Create Lambda Function
        const createFunction = new CreateFunctionCommand({
            FunctionName: functionName,
            Runtime: "nodejs18.x",
            Role: process.env.AWS_ROLE_ARN,
            Handler: "index.handler",
            Code: { ZipFile: zipFile }
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
            FunctionUrlAuthType: "NONE",
        });

        await lambdaClient.send(addPermission);
        bot.sendMessage(chatId, `🚀 Lambda Function URL: ${functionUrl} (Publicly Accessible)`);
        return functionUrl;
    } catch (error) {
        console.error("❌ Error creating Lambda function:", error);
        bot.sendMessage(chatId, `❌ Error creating Lambda function. Check logs. Error: ${error.message}`);
    }
};
