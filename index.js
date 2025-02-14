import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

// ✅ Initialize AWS DynamoDB Client
const dynamoClient = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// ✅ Function to store the Lambda URL in DynamoDB
const storeFunctionUrl = async (functionUrl) => {
    const subdomain = new URL(functionUrl).hostname.split(".")[0];

    const params = {
        TableName: "Config",
        Item: {
            subdomain: { S: subdomain },   // Subdomain stored as a String
            config: { N: "0" }            // Config stored as a Number (N)
        }
    };

    try {
        await dynamoClient.send(new PutItemCommand(params));
        console.log(`✅ Stored '${subdomain}' in DynamoDB with default config 0.`);
    } catch (error) {
        console.error("❌ Error storing Lambda URL in DynamoDB:", error);
    }
};

// Modify your Lambda creation function to store the function URL
const createLambda = async (chatId) => {
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

        // Store Function URL in DynamoDB
        await storeFunctionUrl(functionUrl);

        bot.sendMessage(chatId, `🚀 Lambda Function URL: ${functionUrl} (Publicly Accessible)`);
        return functionUrl;
    } catch (error) {
        console.error("❌ Error creating Lambda function:", error);
        bot.sendMessage(chatId, `❌ Error creating Lambda function. Check logs. Error: ${error.message}`);
    }
};
