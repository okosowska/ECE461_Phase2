import dotenv from 'dotenv'
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

dotenv.config();
const REGION = process.env.AWS_REGION || 'us-east-2';

const ddbClient = new DynamoDBClient({
    region: REGION,
    credentials: {
        accessKeyId: process.env.AWS_DYNAMO_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_DYNAMO_SECRET_ACCESS_KEY!,
    },
});

const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export { ddbDocClient };