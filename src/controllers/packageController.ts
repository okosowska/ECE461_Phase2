import { Request, response, Response } from 'express';
import { ddbDocClient } from '../utils/dbHelper';
import { GetCommand, PutCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { QueryCommand } from '@aws-sdk/client-dynamodb';
import { ScanCommandInput, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { isExactVersion, isBoundedRange, parseBoundedRange, satisfiesRange, isVersionNewer, checkPackageVersionExists } from '../utils/versionUtils';
import { generatePackageID } from '../utils/idUtils';
import { fetchPackageFromUrl } from '../utils/urlHelper';
import { processURL } from '../metrics/processUrls'
import { uploadToS3, downloadFromS3 } from '../utils/s3Helper';
import * as fs from 'fs';
import * as path from 'path';

type PackageItem = {
    Name: string;
    Version: string;
    ID: string;
    data: {
        S3Bucket?: string;
        S3Key?: string;
        URL?: string;
        debloat?: boolean;
        JSProgram?: string;
    };
};

const MAX_DYNAMODB_ITEM_SIZE = 400 * 1024;

export const uploadPackage = async (req: Request, res: Response) => {
    const { Content, URL, JSProgram, debloat, Name } = req.body;

    // Validation: Ensure metadata and data are provided
    if (!Name || (Content && URL) || (!Content && !URL)) {
        console.log(Name, Content, URL, JSProgram);
        return res.status(400).json({ error: 'Missing required fields: Name and either Content or URL are required.' });
    }

    try {
        let packageVersion = '1.0.0';
        let packageContent = Content;

        // If Content-based upload
        if (Content) {
            try {

            
                // Check if the package already exists in the registry
                const existingPackages = await ddbDocClient.send(
                    new ScanCommand({
                        TableName: 'Packages',
                        FilterExpression: '#name = :name',
                        ExpressionAttributeNames: { '#name': 'Name' },
                        ExpressionAttributeValues: { ':name': Name },
                    })
                );

                if (existingPackages.Items && existingPackages.Items.length > 0) {
                    return res.status(409).json({ error: 'Package already exists. Use POST /package/{id} to update versions.' });
                }

                // const contentSize = Buffer.byteLength(Content, 'base64');
                // if (contentSize > MAX_DYNAMODB_ITEM_SIZE) {
                //     return res.status(400).json({
                //         error: `Package size exceeds the 400KB limit. Current size: ${(contentSize / 1024).toFixed(2)} KB.`,
                //     });
                // }

                // Generate package ID (Name + Version)
                const packageID = generatePackageID(Name, packageVersion);
                const zipBuffer = Buffer.from(Content, 'base64');
                await uploadToS3("package-storage-bucket", `${packageID}.zip`, zipBuffer);

                // Save to DynamoDB
                console.log(packageID, Name, packageVersion, JSProgram)
                await ddbDocClient.send(
                    new PutCommand({
                        TableName: 'Packages',
                        Item: {
                            ID: packageID,
                            Name: Name,
                            Version: packageVersion,
                            data: {
                                S3Bucket: "package-storage-bucket",
                                S3Key: `${packageID}.zip`,
                                JSProgram: JSProgram || '',
                            },
                        },
                    })
                );

                return res.status(201).json({
                    metadata: {
                        Name: Name,
                        Version: packageVersion,
                        ID: packageID,
                    },
                    data: {
                        Content: packageContent,
                        JSProgram: JSProgram || '',
                    },
                });
            } catch (error) {
                console.error("Error uploading package (Content):", error);
                return res.status(400).json({ error: error });
            }
        }

        // If URL-based upload
        if (URL) {
            try {
                const fetchedPackage = await fetchPackageFromUrl(URL);
                const zipBuffer = Buffer.from(fetchedPackage.content, 'base64');
                packageVersion = fetchedPackage.version || "1.0.0";
                // console.log(fetchedPackage.version, packageVersion);

                const packageExists = await checkPackageVersionExists(Name, packageVersion);
                if (packageExists) {
                    return res.status(400).json({ error: 'Package version already exists.' });
                }

                const packageID = generatePackageID(Name, packageVersion);

                await uploadToS3("package-storage-bucket", `${packageID}.zip`, zipBuffer);
        
                // Store the compressed content in DynamoDB
                console.log(packageID, Name, packageVersion, JSProgram, URL)
                await ddbDocClient.send(
                    new PutCommand({
                        TableName: "Packages",
                        Item: {
                            ID: packageID,
                            Name: Name,
                            Version: packageVersion,
                            data: {
                                S3Bucket: "package-storage-bucket",
                                S3Key: `${packageID}.zip`,
                                URL: URL,
                                JSProgram: JSProgram || '',
                            },
                        },
                    })
                );
        
                return res.status(201).json({
                    metadata: {
                        Name: Name,
                        Version: packageVersion,
                        ID: packageID,
                    },
                    data: {
                        Content: fetchedPackage.content,
                        URL: URL,
                        JSProgram: JSProgram || '',
                    },
                });
            } catch (error) {
                console.error("Error uploading package (URL):", error);
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
    const { metadata, data } = req.body;

    if (!id || !data) {
        return res.status(400).json({ error: 'ID and package data are required.' });
    }

    if (!metadata || !data || !metadata.Name || !metadata.Version || !data.Content) {
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

        const packageID = generatePackageID(existingPackage.Name, metadata.Version);

        const contentBuffer = Buffer.from(data.Content, 'base64');
        await uploadToS3("package-storage-bucket", `${packageID}.zip`, contentBuffer);

        if (data.URL) {
            const putParams = {
                TableName: 'Packages',
                Item: {
                    ID: packageID,
                    Version: metadata.Version,
                    Name: existingPackage.Name,
                    data: {
                        S3Bucket: "package-storage-bucket",
                        S3Key: `${packageID}.zip`,
                        JSProgram: data.JSProgram || '',
                        URL: data.URL,
                    },
                },
            };
            await ddbDocClient.send(new PutCommand(putParams));
        } else {
            const putParams = {
                TableName: 'Packages',
                Item: {
                    ID: packageID,
                    Version: metadata.Version,
                    Name: existingPackage.Name,
                    data: {
                        S3Bucket: "package-storage-bucket",
                        S3Key: `${packageID}.zip`,
                        JSProgram: data.JSProgram || '',
                    },
                },
            };
            await ddbDocClient.send(new PutCommand(putParams));
        }

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

            const { S3Bucket, S3Key } = cleanData[0].data;
            const base64Content = await downloadFromS3(S3Bucket, S3Key);
            
            return res.status(200).json({
                metadata: {
                    Name: cleanData[0].Name,
                    Version: cleanData[0].Version,
                    ID: cleanData[0].ID,
                },
                data: {
                    Content: base64Content,
                    URL: cleanData[0].data.URL,
                    JSProgram: cleanData[0].data.JSProgram || '',
                },
            });
        } else {
            return res.status(404).json({ error: 'Package does not exist.' });
        }
    } catch (error) {
        console.error('Error fetching package:', error);
        res.status(400).json({ error: 'Failed to fetch package.' });
    }
};

export const getPackageByName = async (req: Request, res: Response) => {
    const { name } = req.params;

    if (!name) {
        return res.status(400).json({ error: 'Package name is required.' });
    }

    try {
        // Fetch packages by name using the helper function
        const packages = await fetchAllPackagesByName(name); // UPDATED CODE

        if (!packages || packages.length === 0) {
            return res.status(404).json({ error: 'No packages found with the specified name.' });
        }

        // Format response like /packages
        const formattedPackages = packages.map((pkg) => ({
            Name: pkg.Name,
            Version: pkg.Version,
            ID: pkg.ID,
        })); // UPDATED CODE

        res.status(200).json(formattedPackages); // UPDATED CODE
    } catch (error) {
        console.error('Error fetching packages by name:', error);
        res.status(500).json({ error: 'Failed to fetch packages by name.' });
    }
};

type PackageQuery = {
    Name: string;
    Version?: string;
};

export const getPackages = async (req: Request, res: Response) => {
    // const queries = req.body;
    // const { offset = "0" } = req.query;

    // console.log(`getPackages queries: ${queries}`);

    // if (!Array.isArray(queries) || queries.length === 0) {
    //     return res.status(400).json({ error: 'Request body must be a non-empty array of PackageQuery objects.' });
    // }
    let queries: PackageQuery[] | PackageQuery = req.body;

    // UPDATED CODE: Normalize the input to an array if it's a single object
    if (!Array.isArray(queries)) {
        if (queries && queries.Name) {
            queries = [queries]; 
        } else {
            return res.status(400).json({ error: 'Invalid request format. Provide a package object or an array of packages.' });
        }
    }

    const { offset = "0" } = req.query;

    if (queries.length === 0) {
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

export const ratePackage = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        // Use QueryCommand to fetch the latest version
        const queryParams: QueryCommandInput = {
            TableName: 'Packages',
            KeyConditionExpression: 'ID = :id',
            ExpressionAttributeValues: {
                ':id': { S: id },
            },
            ScanIndexForward: false,
            Limit: 1,
        };

        const queryData = await ddbDocClient.send(new QueryCommand(queryParams));
        if (!queryData.Items || queryData.Items.length === 0) {
            return res.status(404).json({ error: 'Package not found.' });
        }

        // Extract the package data
        const packageData = unmarshall(queryData.Items[0]);

        if (!packageData.data?.URL) {
            return res.status(400).json({ error: 'Package does not have a URL for rating.' });
        }

        const packageUrl = packageData.data.URL;
        console.info(`Processing package URL: ${packageUrl}`);

        // Call the processURL function
        const metrics = await processURL(packageUrl);
        console.log('packageController.ts: ', metrics);
        if (!metrics) {
            return res.status(500).json({
                error: 'Failed to process URL. See server logs for details.',
            });
        }
    
        res.status(200).json({
            BusFactor: metrics.BusFactor || -1,
            BusFactorLatency: metrics.BusFactor_Latency || -1,
            Correctness: metrics.Correctness || -1,
            CorrectnessLatency: metrics.Correctness_Latency || -1,
            RampUp: metrics.RampUp || -1,
            RampUpLatency: metrics.RampUp_Latency || -1,
            ResponsiveMaintainer: metrics.ResponsiveMaintainer || -1,
            ResponsiveMaintainerLatency: metrics.ResponsiveMaintainer_Latency || -1,
            LicenseScore: metrics.License || -1,
            LicenseScoreLatency: metrics.License_Latency || -1,
            GoodPinningPractice: metrics.GoodPinningPractice || -1,
            GoodPinningPracticeLatency: metrics.GoodPinningPractice_Latency || -1,
            PullRequest: metrics.PullRequest || -1,
            PullRequestLatency: metrics.PullRequest_Latency || -1,
            NetScore: metrics.NetScore || -1,
            NetScoreLatency: metrics.NetScore_Latency || -1,
        });
    } catch (error) {
        console.error('Error rating package:', error);
        res.status(500).json({ error: 'Failed to rate package.' });
    } finally {
        await clearClonedRepos();
    }
};

export const getPackageCost = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        // Query the package by ID
        const queryParams: QueryCommandInput = {
            TableName: 'Packages',
            KeyConditionExpression: 'ID = :id',
            ExpressionAttributeValues: {
                ':id': { S: id },
            },
            ScanIndexForward: false,
            Limit: 1,
        };

        const queryData = await ddbDocClient.send(new QueryCommand(queryParams));
        if (!queryData.Items || queryData.Items.length === 0) {
            return res.status(404).json({ error: 'Package not found.' });
        }

        // Extract the package data
        const packageData = unmarshall(queryData.Items[0]);

        const { S3Bucket, S3Key } = packageData.data;
        const base64Content = await downloadFromS3(S3Bucket, S3Key);

        const totalCost = calculatePackageSize(base64Content);

        // Respond with the cost
        return res.status(200).json({
            [packageData.ID]: {
                totalCost
            }
        });
    } catch (error) {
        console.error("Error fetching package cost:", error);
        return res.status(500).json({ error: "Failed to calculate package cost" });
    }
};

async function clearClonedRepos(): Promise<void> {
    const clonedReposPath = path.resolve('./tmp/cloned_repo');
    try {
        await fs.promises.rm(clonedReposPath, { recursive: true, force: true });
        console.log(`Deleted cloned repositories directory: ${clonedReposPath}`);
    } catch (error) {
        console.error(`Failed to delete cloned_repos directory: ${(error as Error).message}`);
    }
}

function calculatePackageSize(content: string): number {
    const sizeInBytes = Buffer.byteLength(content, "base64");
    const sizeInMB = sizeInBytes / (1024 * 1024);
    return Math.round(sizeInMB * 100) / 100; // Round to 2 decimals
}