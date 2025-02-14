import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { LambdaClient, GetFunctionUrlConfigCommand } from "@aws-sdk/client-lambda";

const dynamoClient = new DynamoDBClient({ region: "us-east-1" });
const lambdaClient = new LambdaClient({ region: "us-east-1" });

export const handler = async () => {
    try {
        console.log("🚀 Retrieving function URL...");

        const functionArn = process.env.AWS_LAMBDA_FUNCTION_NAME;
        const functionConfig = await lambdaClient.send(
            new GetFunctionUrlConfigCommand({ FunctionName: functionArn })
        );

        const functionUrl = functionConfig.FunctionUrl;
        console.log("🔹 Function URL:", functionUrl);

        const subdomain = new URL(functionUrl).hostname.split(".")[0];
        console.log("🔹 Extracted Subdomain:", subdomain);

        const getParams = {
            TableName: "Config",
            Key: {
                subdomain: { S: subdomain }
            }
        };

        const data = await dynamoClient.send(new GetItemCommand(getParams));

        if (!data.Item) {
            console.log(`🔹 Subdomain '${subdomain}' not found.`);
            return { statusCode: 404, body: "0" };
        }

        const configValue = data.Item.config?.N || "0";

        return {
            statusCode: 200,
            body: configValue
        };
    } catch (error) {
        console.error("❌ Error processing request:", error);
        return { statusCode: 500, body: "0" };
    }
};
