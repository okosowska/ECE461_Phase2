import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDocClient } from "../utils/dbHelper";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

const s3Client = new S3Client({ region: "us-east-1" });

async function uploadToS3AndStoreInDynamoDB(
  packageID: string,
  metadata: { Name: string },
  packageVersion: string,
  base64Content: string,
  data: { URL: string; JSProgram: string }
) {
  // Define S3 parameters
  const bucketName = "your-bucket-name";
  const keyName = `packages/${packageID}/${packageVersion}/content.zip.b64`;

  try {
    // Upload the Base64 file to S3
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: keyName,
        Body: base64Content,
        ContentEncoding: "base64",
        ContentType: "application/zip",
      })
    );
    console.log("File uploaded to S3 successfully.");

    // Store only the S3 reference in DynamoDB
    await ddbDocClient.send(
      new PutCommand({
        TableName: "Packages",
        Item: {
          ID: packageID,
          Name: metadata.Name,
          Version: packageVersion,
          data: {
            Content: {
              S3Bucket: bucketName,
              S3Key: keyName,
            },
            URL: data.URL,
            JSProgram: data.JSProgram,
          },
        },
      })
    );

    console.log("S3 reference stored in DynamoDB.");
  } catch (err) {
    console.error("Error:", err);
  }
}

async function fetchFileFromDynamoDB(packageID: string) {
    try {
      // Query DynamoDB
      const response = await ddbDocClient.send(
        new GetCommand({
          TableName: "Packages",
          Key: { ID: packageID },
        })
      );
  
      if (!response.Item) {
        console.log("Package not found.");
        return;
      }
  
      // Extract S3 file reference
      const { S3Bucket, S3Key } = response.Item.data.Content;
  
      // Fetch file from S3
      const s3Response = await s3Client.send(
        new GetObjectCommand({
          Bucket: S3Bucket,
          Key: S3Key,
        })
      );
  
      const fileStream = s3Response.Body?.transformToString();
  
      console.log("Base64 File Content:", await fileStream);
    } catch (err) {
      console.error("Error:", err);
    }
  }