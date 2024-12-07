import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const handler = async (
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
    console.log("Request received:", event);

    return {
        statusCode: 200,
        body: JSON.stringify({
            mesage: "Lambda is working!",
            input: event,
        }),
    };
};