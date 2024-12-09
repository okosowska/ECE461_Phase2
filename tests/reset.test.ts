import apiClient from './apiClientHelper';

describe('/reset', () => {
    beforeAll(async () => {
        await apiClient.authenticate();
    });

    it('check 200', async () => {
        const response = await apiClient.del('/reset');

        expect(response.status).toBe(200);
    });

    it('check 403', async () => {
        try {
            const response = await apiClient.del('/reset', true);
            expect(response.status).toBe(403);
        } catch (error: any) {
            expect(error.response.status).toBe(403);
        }
    });
});
