import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { LambdaClient, GetFunctionUrlConfigCommand } from "@aws-sdk/client-lambda";

// ✅ Initialize AWS Clients
const dynamoClient = new DynamoDBClient({ region: "us-east-1" });
const lambdaClient = new LambdaClient({ region: "us-east-1" });

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

    const getCommand = new GetItemCommand(getParams);
    const data = await dynamoClient.send(getCommand);

    if (!data.Item) {
      console.log(`🔹 Subdomain '${subdomain}' not found. Adding to DynamoDB...`);

      // ✅ Insert new subdomain with default config value `0`
      const putParams = {
        TableName: "Config",
        Item: {
          subdomain: { S: subdomain },
          config: { M: { value: { N: "0" } } }
        }
      };

      const putCommand = new PutItemCommand(putParams);
      await dynamoClient.send(putCommand);
      console.log(`✅ Subdomain '${subdomain}' added with default config: 0`);

      return {
        statusCode: 200,
        body: JSON.stringify(0) // ✅ Return only the config value (default 0)
      };
    }

    // ✅ If the subdomain exists, return its stored config value
    const configValue = data.Item.config?.M?.value?.N || "0";

    return {
      statusCode: 200,
      body: JSON.stringify(Number(configValue)) // ✅ Return only the config value
    };
  } catch (error) {
    console.error("❌ Error processing request:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not retrieve or store configuration" }),
    };
  }
};
