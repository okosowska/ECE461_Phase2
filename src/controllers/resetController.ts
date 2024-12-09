import { Request, Response } from "express";
import { ddbDocClient } from "../utils/dbHelper";
import { ScanCommand, BatchWriteCommand, ScanCommandInput } from "@aws-sdk/lib-dynamodb";
import { ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";

export const resetRegistry = async (req: Request, res: Response) => {
    try {
        let lastEvaluatedKey: Record<string, any> | undefined = undefined;

        do {
            const scanParams: ScanCommandInput = {
                TableName: 'Packages',
                ExclusiveStartKey: lastEvaluatedKey,
            };
            const data = await ddbDocClient.send(new ScanCommand(scanParams));
    
            if (data.Items && data.Items.length > 0) {
                const deleteChunks = chunkArray(
                        data.Items.map((item) => ({
                        DeleteRequest: {
                            Key: {
                            ID: item.ID,
                            Version: item.Version,
                            },
                        },
                    })),
                    25
                );
                for (const chunk of deleteChunks) {
                    const deleteParams = {
                        RequestItems: {
                            Packages: chunk,
                        },
                    };
                    
                    await ddbDocClient.send(new BatchWriteCommand(deleteParams));
                }
            }

            lastEvaluatedKey = data.LastEvaluatedKey;
        } while (lastEvaluatedKey);
        
        res.status(200).json({ description: 'Registry is reset.' });
    } catch (error) {
        console.error('Error resetting database:', error);
        res.status(500).json({ error: 'Failed to reset database' });
    }
};

function chunkArray<T>(array: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

