import { Request, Response } from "express";
import { ddbDocClient } from "../utils/dbHelper";
import { ScanCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

export const resetRegistry = async (req: Request, res: Response) => {
    try {
        const scanParams = {
            TableName: 'Packages',
        };
        const data = await ddbDocClient.send(new ScanCommand(scanParams));

        if (data.Items && data.Items.length > 0) {
            const deleteRequests = data.Items.map((item) => ({
                DeleteRequest: {
                    Key: {
                        ID: item.ID,
                        Version: item.Version,
                    },
                },
            }));

            const deleteParams = {
                RequestItems: {
                    Packages: deleteRequests,
                },
            };

            await ddbDocClient.send(new BatchWriteCommand(deleteParams));
        }

        res.status(200).json({ message: 'Database reset successfully' });
    } catch (error) {
        console.error('Error resetting database:', error);
        res.status(500).json({ error: 'Failed to reset database' });
    }
};