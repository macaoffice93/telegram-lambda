import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { LambdaClient, GetFunctionUrlConfigCommand } from "@aws-sdk/client-lambda";

// ✅ Initialize AWS Clients
const dynamoClient = new DynamoDBClient({ region: "ap-southeast-2" });
const lambdaClient = new LambdaClient({ region: "ap-southeast-2" });

export const handler = async () => {
    try {
        console.log("🚀 Retrieving function URL...");

        // ✅ Fetch the function URL dynamically
        const functionArn = process.env.AWS_LAMBDA_FUNCTION_NAME;
        const functionConfig = await lambdaClient.send(
            new GetFunctionUrlConfigCommand({ FunctionName: functionArn })
        );
        
        const functionUrl = functionConfig.FunctionUrl;
        console.log("🔹 Function URL:", functionUrl);

        // ✅ Look up the function URL in DynamoDB
        const getCommand = new GetItemCommand({
            TableName: "Config",
            Key: { subdomain: { S: functionUrl } }
        });

        const data = await dynamoClient.send(getCommand);

        if (!data.Item) {
            console.log("⚠️ No config found for this function.");
            return { statusCode: 404, body: JSON.stringify("0") }; // Default to 0 if not found
        }

        // ✅ Return the stored config value
        const configValue = data.Item.config?.N || "0";

        return { statusCode: 200, body: JSON.stringify(configValue) };
    } catch (error) {
        console.error("❌ Error retrieving configuration:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Could not retrieve configuration" }) };
    }
};
