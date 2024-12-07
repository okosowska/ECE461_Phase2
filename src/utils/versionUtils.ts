import semver from 'semver';
import { ddbDocClient } from './dbHelper';
import { QueryCommand, QueryCommandInput } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { GetCommand, GetCommandInput } from '@aws-sdk/lib-dynamodb';
import { generatePackageID } from './idUtils';

export const isExactVersion = (version: string): boolean => {
    return semver.valid(version) !== null && !version.includes('-') && !version.startsWith('^') && !version.startsWith('~');
};

export const isBoundedRange = (version: string): boolean => {
    return version.includes('-') && version.split('-').length === 2;
};

export const parseBoundedRange = (version: string): { minVersion: string; maxVersion: string } | null => {
    const [minVersion, maxVersion] = version.split('-');
    if (semver.valid(minVersion) && semver.valid(maxVersion)) {
        return { minVersion, maxVersion };
    }
    return null;
};

export const satisfiesRange = (version: string, range: string): boolean => {
    return semver.satisfies(version, range);
};

export const isVersionNewer = async (packageID: string, uploadedVersion: string) => {
    try {
        const getParams: QueryCommandInput = {
            TableName: "Packages",
            KeyConditionExpression: "ID = :id",
            ExpressionAttributeValues: {
                ":id": { S: packageID },
            },
            ScanIndexForward: false, // Latest version first
            Limit: 1, // Only the newest version
        };
        
        const getData = await ddbDocClient.send(new QueryCommand(getParams));

        if (!getData.Items || getData.Items.length === 0) {
            throw new Error("Package not found.");
        }

        const initialPackage = unmarshall(getData.Items[0])

        const name = initialPackage.Name as string;

        // Step 2: Find the latest version using the package name
        const queryParams: QueryCommandInput = {
            TableName: "Packages",
            IndexName: "NameIndex",
            KeyConditionExpression: "#name = :name",
            ExpressionAttributeNames: {
                "#name": "Name",
            },
            ExpressionAttributeValues: {
                ":name": { S: name },
            },
            ScanIndexForward: false, // Descending order
            Limit: 1,
        };

        const queryData = await ddbDocClient.send(new QueryCommand(queryParams));

        if (!queryData.Items || queryData.Items.length === 0) {
            console.info("No versions found for the package.");
            return true; // Safe to upload if no version exists
        }

        const latestPackage = queryData.Items[0];
        const latestVersion = latestPackage.Version?.S ?? latestPackage.Version;

        if (!latestVersion || typeof latestVersion !== "string") {
            throw new Error("Invalid version format.");
        }

        return semver.gte(uploadedVersion, latestVersion);
    } catch (error) {
        console.error("Error checking latest version:", error);
        throw new Error("Failed to check the latest version.");
    }
};

export const checkPackageVersionExists = async (Name: string, Version: string) => {
    try {
        const ID = generatePackageID(Name, Version); // Generate the ID from the name and version

        const params = {
            TableName: "Packages",
            Key: { ID, Version },
        };

        const result = await ddbDocClient.send(new GetCommand(params));

        // Check if the Item exists
        return !!result.Item;
    } catch (error) {
        console.error("Error checking package ID:", error);
        throw new Error("Failed to check package ID.");
    }
};
