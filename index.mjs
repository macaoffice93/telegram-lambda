import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { LambdaClient, GetFunctionUrlConfigCommand } from "@aws-sdk/client-lambda";

// ✅ Initialize AWS Clients
const dynamoClient = new DynamoDBClient({ region: "ap-southeast-2" });
const lambdaClient = new LambdaClient({ region: "ap-southeast-2" });

export const handler = async (event) => {
  try {
    console.log("🚀 Retrieving function URL...");

    // ✅ Fetch the function URL dynamically
    const functionArn = process.env.AWS_LAMBDA_FUNCTION_NAME;
    const functionConfig = await lambdaClient.send(
      new GetFunctionUrlConfigCommand({ FunctionName: functionArn })
    );
    
    const functionUrl = functionConfig.FunctionUrl;
    console.log("🔹 Function URL:", functionUrl);

    // ✅ Extract subdomain from function URL
    const urlParts = new URL(functionUrl).hostname.split(".");
    const subdomain = urlParts[0];
    console.log("🔹 Extracted Subdomain:", subdomain);

    // ✅ Check if subdomain exists in DynamoDB
    const getParams = {
      TableName: "Config",
      Key: {
        subdomain: { S: subdomain }
      }
    };

    console.log("🔹 DynamoDB GetItem Params:", JSON.stringify(getParams, null, 2));

    const getCommand = new GetItemCommand(getParams);
    const data = await dynamoClient.send(getCommand);

    console.log("🔹 DynamoDB Response:", JSON.stringify(data, null, 2));

    if (!data.Item) {
      console.log(`❌ Subdomain '${subdomain}' not found in DynamoDB.`);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Could not retrieve configuration" }),
      };
    }

    // ✅ If the subdomain exists, return its stored config value
    const configValue = data.Item.config?.N || "0"; // ✅ Ensure it's read correctly as a number

    return {
      statusCode: 200,
      body: JSON.stringify(Number(configValue)) // ✅ Return only the config value
    };
  } catch (error) {
    console.error("❌ Error retrieving configuration:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not retrieve configuration" }),
    };
  }
};
