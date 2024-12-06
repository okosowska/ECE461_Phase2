import { Request, Response } from 'express';
import { ddbDocClient } from '../utils/dbHelper';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { QueryCommand } from '@aws-sdk/client-dynamodb';
import { ScanCommandInput, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { isExactVersion, isBoundedRange, parseBoundedRange, satisfiesRange } from '../utils/versionUtils';

type PackageItem = {
    Name: string;
    Version: string;
    ID: string;
    data: {
        Content?: string;
        URL?: string;
        debloat?: boolean;
        JSProgram?: string;
    };
};

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

export const getPackages = async (req: Request, res: Response) => {
    const queries = req.body;
    const { offset = "0" } = req.query;

    if (!Array.isArray(queries) || queries.length === 0) {
        return res.status(400).json({ error: 'Request body must be a non-empty array of PackageQuery objects.' });
    }

    try {
        const enumerateAll = queries.some((query) => query.Name === '*');
        
        let packages: PackageItem[] = [];
        let lastEvaluatedKey: Record<string, any> | undefined = undefined;
        let pageOffset = parseInt(offset as string, 10);

        if (enumerateAll) {
            do {
                const params: ScanCommandInput = {
                    TableName: 'Packages',
                    ExclusiveStartKey: lastEvaluatedKey,
                };

                const data = await ddbDocClient.send(new ScanCommand(params));
                if (data.Items) {
                    packages = packages.concat(data.Items as PackageItem[]);
                }
                lastEvaluatedKey = data.LastEvaluatedKey;
            } while (lastEvaluatedKey && packages.length < pageOffset + 10);
        } else {
            for (const query of queries) {
                const { Name, Version } = query;

                if (!Name) {
                    return res.status(400).json({ error: 'Each PackageQuery must include a Name.' });
                }

                const params: ScanCommandInput = {
                    TableName: 'Packages',
                    FilterExpression: '#name = :name',
                    ExpressionAttributeValues: {
                        ':name': Name,
                    },
                    ExpressionAttributeNames: {
                        '#name': 'Name',
                    },
                };

                if (Version) {
                    if (!params.ExpressionAttributeNames) {
                        params.ExpressionAttributeNames = {};
                    }
                    if (!params.ExpressionAttributeValues) {
                        params.ExpressionAttributeValues = {};
                    }
                    if (isExactVersion(Version)) {
                        params.FilterExpression += ' AND #version = :version';
                        params.ExpressionAttributeNames['#version'] = 'Version';
                        params.ExpressionAttributeValues[':version'] = Version;
                    } else if (isBoundedRange(Version)) {
                        const range = parseBoundedRange(Version);
                        if (range) {
                            params.FilterExpression += ' AND #version BETWEEN :minVersion AND :maxVersion';
                            params.ExpressionAttributeNames['#version'] = 'Version';
                            params.ExpressionAttributeValues[':minVersion'] = range.minVersion;
                            params.ExpressionAttributeValues[':maxVersion'] = range.maxVersion;
                        } else {
                            return res.status(400).json({ error: 'Invalid bounded range in Version.' });
                        }
                    } else {
                        const matchingPackages = await fetchAllPackagesByName(Name);
                        const filteredPackages = matchingPackages.filter((pkg) =>
                            satisfiesRange(pkg.Version, Version)
                        );
                        packages = packages.concat(filteredPackages as PackageItem[]);
                        continue; // Skip the ScanCommand execution for SemVer ranges
                    }
                }

                const data = await ddbDocClient.send(new ScanCommand(params));
                if (data.Items) {
                    packages = packages.concat(data.Items as PackageItem[]);
                }
            }
        }

        const paginatedResults = packages.slice(pageOffset, pageOffset + 10);

        res.setHeader('offset', pageOffset + 10);
        res.status(200).json(paginatedResults.map((pkg) => ({
            Name: pkg.Name,
            Version: pkg.Version,
            ID: pkg.ID,
        })));
    } catch (error) {
        console.error('Error fetching packages:', error);
        res.status(500).json({ error: 'Failed to fetch packages' });
    }
};

const fetchAllPackagesByName = async (name: string): Promise<PackageItem[]> => {
    const params: ScanCommandInput = {
        TableName: 'Packages',
        FilterExpression: '#name = :name',
        ExpressionAttributeValues: { ':name': name },
        ExpressionAttributeNames: { '#name': 'Name' },
    };

    const data = await ddbDocClient.send(new ScanCommand(params));
    return data.Items as PackageItem[];
};
