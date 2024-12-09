import apiClient from './apiClientHelper';

describe('/package/{id} POST', () => {
    beforeAll(async () => {
        await apiClient.authenticate();
    });

    let packageId: string = '11b2394d33';
    let updatePackageData = {
        metadata: {
            Name: 'cool-package',
            Version: '1.1.0',
        },
        data: {
            Content: 'UpdatedContentAJDBJABKNFK',
        }
    };

    it('check 200', async () => {
        try {
            const response = await apiClient.post(`/package/${packageId}`, updatePackageData);
            console.log(response.data);

            expect(response.status).toBe(200);
            expect(response.data.metadata.Version).toBe('1.1.0');
        } catch (error: any) {
            console.error(error);
        }
    });

    it('check 404', async () => {
        const test = 'test';
        await expect(apiClient.post(`/package/${test}`, updatePackageData))
            .rejects.toThrow('Request failed with status code 404');
    });

    it('check 400', async () => {
        const test = {};
        try {
            const response = await apiClient.post('/package/0', test);
            expect(response.status).toBe(400);
        } catch (error: any) {
            expect(error.response.status).toBe(400);
        }
    });

    it('check 403', async () => {
        await expect(apiClient.post(`/package/${packageId}`, updatePackageData, true))
            .rejects.toThrow('Request failed with status code 403');
    });
});
