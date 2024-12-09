import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// S3 Upload Function
export const uploadToS3 = async (bucket: string, key: string, fileBuffer: Buffer) => {
    const s3 = new S3Client({
        region: "us-east-2",
        credentials: {
            accessKeyId: process.env.AWS_DYNAMO_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_DYNAMO_SECRET_ACCESS_KEY!,
        },
    });
    await s3.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: fileBuffer,
            ContentEncoding: 'base64',
            ContentType: 'application/zip',
        })
    );
};

// S3 Download Function
export const downloadFromS3 = async (bucket: string, key: string): Promise<string> => {
    const s3 = new S3Client({
        region: "us-east-2",
        credentials: {
            accessKeyId: process.env.AWS_DYNAMO_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_DYNAMO_SECRET_ACCESS_KEY!,
        },
    });
    const { Body } = await s3.send(
        new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        })
    );
    const streamToBuffer = (stream: any) => {
        return new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = [];
            stream.on("data", (chunk: Buffer) => chunks.push(chunk));
            stream.on("end", () => resolve(Buffer.concat(chunks)));
            stream.on("error", reject);
        });
    };
    const fileBuffer = await streamToBuffer(Body as any);
    return fileBuffer.toString("base64");
};
