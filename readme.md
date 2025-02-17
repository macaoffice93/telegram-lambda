# Telegram Bot for AWS Lambda Deployment and Configuration Management

## Overview
This project provides a **Telegram bot** that manages AWS **Lambda functions** dynamically. It allows authorized users to deploy Lambda functions, retrieve their public URLs, and update their configuration values stored in a **DynamoDB** table. Unauthorized users cannot interact with the bot.

## Features
- **Restricts access**: The bot only responds to messages from an authorized Telegram chat.
- **Deploy new Lambda functions**: The `/newlambda` command creates a new Lambda function and stores its URL in DynamoDB.
- **Update Lambda configurations**: The `/updateconfig` command updates the stored value for a given Lambda function, affecting its output.
- **DynamoDB integration**: All Lambda function URLs and their associated values are stored in a central DynamoDB table.

## Architecture

### Components:
1. **Telegram Bot (Node.js, AWS SDK)**: Runs on an AWS EC2 instance, interacts with Telegram API, AWS Lambda, and DynamoDB.
2. **AWS Lambda Functions**: Created dynamically by the bot, retrieve their configurations from DynamoDB.
3. **DynamoDB Table (`Config`)**: Stores:
   - `subdomain` (Primary Key) - A unique identifier for each function.
   - `functionUrl` - The Lambda function's public URL.
   - `config` - The configuration value the function should return.

### Flow:
1. **Creating a New Lambda (`/newlambda`)**:
   - The bot deploys a new Lambda function.
   - The function’s public URL is stored in DynamoDB with an initial config value of `0`.

2. **Updating a Configuration (`/updateconfig <URL> <value>`)**:
   - The bot updates the stored value in DynamoDB.
   - The Lambda function immediately reflects the new value when accessed via its URL.

## Setup Instructions

### 1. AWS Configuration
Ensure you have the following AWS services set up:
- **IAM Role with Permissions**:
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": "logs:CreateLogGroup",
        "Resource": "arn:aws:logs:ap-southeast-2:<AWS_ACCOUNT_ID>:*"
      },
      {
        "Effect": "Allow",
        "Action": [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        "Resource": "arn:aws:logs:ap-southeast-2:<AWS_ACCOUNT_ID>:log-group:/aws/lambda/configurationLambda:*"
      },
      {
        "Effect": "Allow",
        "Action": [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem"
        ],
        "Resource": "arn:aws:dynamodb:ap-southeast-2:<AWS_ACCOUNT_ID>:table/Config"
      },
      {
        "Effect": "Allow",
        "Action": "lambda:GetFunctionUrlConfig",
        "Resource": "arn:aws:lambda:ap-southeast-2:<AWS_ACCOUNT_ID>:function:*"
      }
    ]
  }
  ```
- **DynamoDB Table (Config)**:
  ```json
  {
    "TableName": "Config",
    "KeySchema": [
      { "AttributeName": "subdomain", "KeyType": "HASH" }
    ],
    "AttributeDefinitions": [
      { "AttributeName": "subdomain", "AttributeType": "S" }
    ],
    "BillingMode": "PAY_PER_REQUEST"
  }
  ```

### 2. Deploy the Telegram Bot
#### Install Dependencies
```bash
npm install
```

#### Set Up `.env`
```ini
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_AUTHORIZED_CHAT_ID=your-authorized-chat-id
AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_ROLE_ARN=arn:aws:iam::<AWS_ACCOUNT_ID>:role/your-lambda-role
```

#### Start with PM2
```bash
pm2 start index.js --name telegram-bot
pm2 save
```

### 3. Deploy the Lambda Function
- Upload the `index.mjs.zip` containing the function code.
- The bot will handle deployment and storage in DynamoDB.

## Commands

### `/newlambda`
- Deploys a new Lambda function.
- Returns its public URL.
- Stores its default config (`0`) in DynamoDB.

### `/updateconfig <URL or Subdomain> <New Value>`
- Updates the configuration for a given Lambda function.
- The function will return the new value.

## Cost Estimation
### 1. **EC2 Instance (Bot Hosting)**
- Assuming **t3.micro** (Free-tier eligible) in **ap-southeast-2**:
  - **Cost**: ~$8 per month if not free-tier.

### 2. **AWS Lambda**
- Each invocation is **$0.20 per 1M requests**.
- If each function runs for 128MB **for 1M requests/month**, cost is ~**$0.30**.

### 3. **DynamoDB**
- **Pay-Per-Request Mode**:
  - Reads: **$0.25 per million**.
  - Writes: **$1.25 per million**.
  - If we update 10 functions **10,000 times per month**, cost is ~**$0.03**.

### **Total Estimated Cost (Per Month)**:
| Service  | Cost Estimate |
|----------|--------------|
| EC2 (t3.micro) | ~$8.00 |
| Lambda (1M requests) | ~$0.30 |
| DynamoDB (10K writes) | ~$0.03 |
| **Total** | **~$8.33/month** |

## Security Measures
- **Restricted Access**: Only messages from `TELEGRAM_AUTHORIZED_CHAT_ID` are processed.
- **IAM Policies**: Least privilege permissions for Lambda and DynamoDB.


