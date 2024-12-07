import { Request, Response } from 'express';
import { ddbDocClient } from '../utils/dbHelper';
import { GetCommand, PutCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { QueryCommand } from '@aws-sdk/client-dynamodb';
import { ScanCommandInput, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { isExactVersion, isBoundedRange, parseBoundedRange, satisfiesRange, isVersionNewer, checkPackageVersionExists } from '../utils/versionUtils';
import { generatePackageID } from '../utils/idUtils';
import { fetchPackageFromUrl } from '../utils/urlHelper';

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

const MAX_DYNAMODB_ITEM_SIZE = 400 * 1024;

export const uploadPackage = async (req: Request, res: Response) => {
    const { metadata, data } = req.body;

    // Validation: Ensure metadata and data are provided
    if (!metadata || !data || !metadata.Name || (!data.Content && !data.URL)) {
        return res.status(400).json({ error: 'Missing required fields: metadata.Name and either data.Content or data.URL are required.' });
    }

    try {
        let packageVersion = '1.0.0';
        let packageContent = data.Content;

        // If Content-based upload
        if (data.Content) {
            // Check if the package already exists in the registry
            const existingPackages = await ddbDocClient.send(
                new ScanCommand({
                    TableName: 'Packages',
                    FilterExpression: '#name = :name',
                    ExpressionAttributeNames: { '#name': 'Name' },
                    ExpressionAttributeValues: { ':name': metadata.Name },
                })
            );

            if (existingPackages.Items && existingPackages.Items.length > 0) {
                return res.status(400).json({ error: 'Package already exists. Use POST /package/{id} to update versions.' });
            }

            const contentSize = Buffer.byteLength(data.Content, 'base64');
            if (contentSize > MAX_DYNAMODB_ITEM_SIZE) {
                return res.status(400).json({
                    error: `Package size exceeds the 400KB limit. Current size: ${(contentSize / 1024).toFixed(2)} KB.`,
                });
            }

            // Generate package ID (Name + Version)
            const packageID = generatePackageID(metadata.Name, packageVersion);

            // Save to DynamoDB
            await ddbDocClient.send(
                new PutCommand({
                    TableName: 'Packages',
                    Item: {
                        ID: packageID,
                        Name: metadata.Name,
                        Version: packageVersion,
                        data: {
                            Content: packageContent,
                            JSProgram: data.JSProgram,
                        },
                    },
                })
            );

            return res.status(201).json({ message: 'Package uploaded successfully', ID: packageID });
        }

        // If URL-based upload
        if (data.URL) {
            try {
                const fetchedPackage = await fetchPackageFromUrl(data.URL);
                const packageSize = Buffer.byteLength(fetchedPackage.content, 'base64');
                packageVersion = fetchedPackage.version || "1.0.0";
                console.log(fetchedPackage.version, packageVersion);

                const packageExists = await checkPackageVersionExists(metadata.Name, packageVersion);
                if (packageExists) {
                    return res.status(400).json({ error: 'Package version already exists.' });
                }
                
                if (packageSize > MAX_DYNAMODB_ITEM_SIZE) {
                    data.Content = 'UEsDBBQAAAAAAA9DQlMAAAAAAAAAAAAAAAALACAAZXhjZXB';
                    data.Version = packageVersion;
                } else {
                    data.Content = fetchedPackage.content;
                    data.Version = packageVersion;
                }

                const packageID = generatePackageID(metadata.Name, packageVersion);
        
                // Store the compressed content in DynamoDB
                await ddbDocClient.send(
                    new PutCommand({
                        TableName: "Packages",
                        Item: {
                            ID: packageID,
                            Name: metadata.Name,
                            Version: packageVersion,
                            data: {
                                Content: data.Content, // Store the compressed Base64 string
                                URL: data.URL,
                                JSProgram: data.JSProgram,
                            },
                        },
                    })
                );
        
                return res.status(201).json({ message: "Package uploaded successfully", ID: packageID });
            } catch (error) {
                console.error("Error uploading package:", error);
                return res.status(400).json({ error: error });
            }
        }

        return res.status(400).json({ error: 'Invalid upload data. Provide either Content or URL.' });
    } catch (error) {
        console.error('Error uploading package:', error);
        return res.status(500).json({ error: 'Failed to upload package' });
    }
};

export const updatePackage = async (req: Request, res: Response) => {
    const { id } = req.params;
    const updatedPackage = req.body;

    if (!id || !updatedPackage) {
        return res.status(400).json({ error: 'ID and package data are required.' });
    }

    const { metadata, data } = updatedPackage;
    if (!metadata || !data || !metadata.Name || !metadata.Version) {
        return res.status(400).json({ error: 'Metadata and data fields are required, including Name, Version, Content.' });
    }

    try {
        const queryParams = {
            TableName: 'Packages',
            KeyConditionExpression: 'ID = :id',
            ExpressionAttributeValues: {
                ':id': { S: id },
            },
        };

        const queryResult = await ddbDocClient.send(new QueryCommand(queryParams));
        if (!queryResult.Items || queryResult.Items.length === 0) {
            return res.status(404).json({ error: 'Package not found' });
        }

        const existingPackage = unmarshall(queryResult.Items[0]);

        if (
            metadata.Name !== existingPackage.Name ||
            id as any !== existingPackage.ID
        ) {
            console.log(metadata.Name, existingPackage.Name);
            console.log(metadata.Version, existingPackage.Version);
            console.log(id, existingPackage.ID);
            return res.status(400).json({ error: 'Metadata does not match the existing package.' });
        }

        const isNewer = await isVersionNewer(existingPackage.ID, metadata.Version)
        if (!isNewer) {
            return res.status(400).json({ error: `Version ${metadata.Version} is not newer than the current version.`})
        }

        const putParams = {
            TableName: 'Packages',
            Item: {
                ID: generatePackageID(existingPackage.Name, metadata.Version),
                Version: metadata.Version,
                Name: existingPackage.Name,
                data: {
                    ...data,
                },
            },
        };

        await ddbDocClient.send(new PutCommand(putParams));

        res.status(200).json({ message: 'Package updated successfully.' });
    } catch (error) {
        console.error('Error updating package:', error);
        res.status(500).json({ error: 'Failed to update package.' });
    }
};

export const getPackageByID = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {

        const params = {
            TableName: 'Packages',
            KeyConditionExpression: 'ID = :id',
            ExpressionAttributeValues: {
                ':id': { S: id },
            },
            ScanIndexForward: false,
            Limit: 1,
        };

        const result = await ddbDocClient.send(new QueryCommand(params));

        if (result.Items && result.Items.length > 0) {
            const cleanData = result.Items.map((item) => unmarshall(item));
            res.status(200).json(cleanData[0]);
        } else {
            return res.status(404).json({ error: 'Package not found.' });
        }
    } catch (error) {
        console.error('Error fetching package:', error);
        res.status(500).json({ error: 'Failed to fetch package.' });
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

                params.ExpressionAttributeValues = params.ExpressionAttributeValues || {};
                params.ExpressionAttributeNames = params.ExpressionAttributeNames || {};

                if (Version) {
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
        res.status(200).json(
            paginatedResults.map((pkg) => ({
                Name: pkg.Name,
                Version: pkg.Version,
                ID: pkg.ID,
            }))
        );
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