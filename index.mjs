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

    console.log("🔹 DynamoDB Response:", JSON.stringify(data, null, 2));

    if (!data.Item) {
      console.log(`❌ Subdomain '${subdomain}' not found in DynamoDB.`);
      return {
        statusCode: 404,
        body: JSON.stringify(0) // ✅ Default to 0 if not found
      };
    }

    // ✅ Extracting `config` correctly as a Number (N)
    const configValue = data.Item.config?.N ? Number(data.Item.config.N) : 0;

    console.log(`✅ Retrieved config value for '${subdomain}':`, configValue);

    return {
      statusCode: 200,
      body: JSON.stringify(configValue) // ✅ Return only the config value
    };
  } catch (error) {
    console.error("❌ Error retrieving configuration:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not retrieve configuration" }),
    };
  }
};
