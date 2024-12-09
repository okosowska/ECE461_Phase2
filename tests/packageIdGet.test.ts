import apiClient from './apiClientHelper';

describe('/package/{id} GET', () => {
    beforeAll(async () => {
        await apiClient.authenticate();
    });

    let packageId: string = '11b2394d33';

    it('check 200', async () => {
        const response = await apiClient.get(`/package/${packageId}`);

        expect(response.status).toBe(200);
        expect(response.data.metadata.Name).toBe('cool-package');
        expect(response.data.metadata.ID).toBe(packageId);
        expect(response.data).toHaveProperty('data');
        expect(response.data.data.Content).toBeTruthy();
    });

    it('check 404', async () => {
        const test = '0000';
        await expect(apiClient.get(`/package/${test}`))
            .rejects.toThrow('Request failed with status code 404');
    });

    it('check 403', async () => {
        await expect(apiClient.get(`/package/${packageId}`, true))
            .rejects.toThrow('Request failed with status code 403');
    });
});
