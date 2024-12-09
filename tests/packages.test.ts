import apiClient from './apiClientHelper';

describe('/packages', () => {
    beforeAll(async () => {
        await apiClient.authenticate();
    });

    it('check 200', async () => {
        const response = await apiClient.post('/packages', [
        { Name: '*', Version: '*' },
        ]);
        console.log(response.data);
        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
        expect(response.data).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
            ID: expect.any(String),
            Name: expect.any(String),
            Version: expect.any(String),
            }),
        ])
        );
    });

    it('check 400', async () => {
        await expect(
        apiClient.post('/packages', [{ test: 'test' }])
        ).rejects.toThrow('Request failed with status code 400');
    });

    it('check 403', async () => {
        try {
            const response = await apiClient.post('/packages', [
            { Name: 'somePackage', Version: '1.0.0' },
            ], true);
            expect(response.status).toBe(403);
        } catch (error: any) {
            expect(error.response.status).toBe(403);
        }
    });
});