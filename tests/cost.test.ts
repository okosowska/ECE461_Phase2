import apiClient from './apiClientHelper';

describe('/package/{id}/cost', () => {
    beforeAll(async () => {
        await apiClient.authenticate();
    });

    const packageID = '11b2394d33';

    it('check 200 without dependencies', async () => {
        const response = await apiClient.get(`package/${packageID}/cost?dependency=false`);
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty(packageID);
        expect(response.data[packageID]).toHaveProperty('totalCost');
    });

    it('check 200 with dependencies', async () => {
        const response = await apiClient.get(`package/${packageID}/cost?dependency=true`);

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty(packageID);
        expect(response.data[packageID]).toHaveProperty('standaloneCost');
        expect(response.data[packageID]).toHaveProperty('totalCost');
    });

    it('check 400', async () => {
        try {
            const response = await apiClient.get(`package/0000/cost?dependency=false`);
            expect(response.status).toBe(400);
        } catch (error: any) {
            expect(error.response.status).toBe(403);
        }
    });

    it('check 403', async () => {
        try {
            const response = await apiClient.get(`package/${packageID}/cost?dependency=false`, true);
            expect(response.status).toBe(403);
        } catch (error: any) {
            expect(error.response.status).toBe(403);
        }
    });

    it('check 404', async () => {
        const test = '';
        try {
            const response = await apiClient.get(`package/${test}/cost?dependency=false`);
            expect(response.status).toBe(404);
        } catch (error: any) {          
            expect(error.response.status).toBe(404);
        }
    });

    it('check 500', async () => {
        try {
            const response = await apiClient.get(`pacage/${packageID}/cost?dependency=true`);
            expect(response.status).toBe(500);
        } catch (error: any) {
            expect(error.response.status).toBe(500);
        }
    });
});