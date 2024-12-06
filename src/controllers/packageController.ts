import { Request, Response } from 'express';
import { ddbDocClient } from '../utils/dbHelper';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { QueryCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

export const uploadPackage = async (req: Request, res: Response) => {
    const { metadata, data } = req.body;

    if (!metadata?.Name || !metadata?.Version || !metadata?.ID) {
        return res.status(400).json({ error: 'Missing requirement metadata fields: Name, Version, ID' });
    }

    if (!data.Content && !data?.URL) {
        return res.status(400).json({ error: 'Either Content or URL is required in data' });
    }
    
    try {
        const params = {
            TableName: 'Packages',
            Item: {
                ID: metadata.ID,
                Version: metadata.Version,
                Name: metadata.Name,
                data,
            },
        };

        await ddbDocClient.send(new PutCommand(params));
        res.status(201).json({ message: 'Package uploaded succesfully' });
    } catch (error) {
        console.error('Error uploading package:', error);
        res.status(500).json({ error: 'Failed to upload package' });
    }
};

export const getPackageByID = async (req: Request, res: Response) => {
    const { ID } = req.params;

    if (!ID) {
        return res.status(400).json({ error: 'ID is required' });
    }

    try {
        const params = {
            TableName: 'Packages',
            KeyConditionExpression: 'ID = :ID',
            ExpressionAttributeValues: {
                ':ID': { S: ID},
            },
            ScanIndexForward: false,
            Limit: 1,
        };

        const data = await ddbDocClient.send(new QueryCommand(params));

        if (!data.Items || data.Items.length === 0) {
            return res.status(404).json({ error: 'Package not found' });
        }

        const cleanData = data.Items.map((item) => unmarshall(item));

        return res.status(200).json(cleanData[0]);
    } catch (error) {
        console.error('Error fetching package:', error);
        res.status(500).json({ error: 'Failed to fetch package' });
    }
};

export const getPackageByName = (req: Request, res: Response) => {
    // IMPLEMENT GET PACKAGE BY NAME HERE
    res.send('Packages by Name.');
}

export const fetchPackages = (req: Request, res: Response) => {
    // IMPLEMENT FETCH PACKAGES HERE
    res.send('List of packages.');
}