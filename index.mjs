import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { LambdaClient, GetFunctionUrlConfigCommand } from "@aws-sdk/client-lambda";

const dynamoClient = new DynamoDBClient({ region: "ap-southeast-2" });

export const handler = async (event) => {
    try {
        console.log("🚀 Retrieving function URL...");

        // ✅ Extract the function URL dynamically
        const functionArn = process.env.AWS_LAMBDA_FUNCTION_NAME;
        const functionConfig = await new LambdaClient({ region: "ap-southeast-2" }).send(
            new GetFunctionUrlConfigCommand({ FunctionName: functionArn })
        );
        
        const functionUrl = functionConfig.FunctionUrl;
        console.log("🔹 Function URL:", functionUrl);

        // ✅ Extract the subdomain from the function URL
        const urlParts = new URL(functionUrl).hostname.split(".");
        const subdomain = urlParts[0];
        console.log("🔹 Extracted Subdomain:", subdomain);

        // ✅ Ensure the correct key structure for DynamoDB query
        const getParams = {
            TableName: "Config",
            Key: {
                subdomain: { S: subdomain }  // ✅ Ensure 'subdomain' matches the table's key name
            }
        };

        console.log("🔹 DynamoDB GetItem Params:", JSON.stringify(getParams, null, 2));

        const getCommand = new GetItemCommand(getParams);
        const data = await dynamoClient.send(getCommand);

        if (!data.Item) {
            console.log(`🔹 No config found for subdomain '${subdomain}'`);
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Configuration not found" })
            };
        }

        // ✅ Extract and return the stored config value
        const configValue = data.Item.config?.N || "0";

        return {
            statusCode: 200,
            body: JSON.stringify(Number(configValue)) // ✅ Return only the config value
        };

    } catch (error) {
        console.error("❌ Error retrieving configuration:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Could not retrieve configuration" })
        };
    }
};
