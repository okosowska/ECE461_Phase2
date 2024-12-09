import apiClient from './apiClientHelper';

describe('/package POST', () => {
    beforeAll(async () => {
        await apiClient.authenticate();
    });

    const packageContent = {
        Name: 'cool-package',
        Content: 'UEsDBAoAAAAAACAfUFkAAAAAAAAAAAAAAAASAAkAdW5kZXJzY29yZS1t.........fQFQAoADBkODIwZWY3MjkyY2RlYzI4ZGQ4YjVkNTY1OTIxYjgxMDBjYTMzOTc=',
        JSProgram: 'console.log(\'Success\');}',
        debloat: false,
    };

    const packageURL = {
        JSProgram: 'console.log(\'Success\');}',
        URL: 'https://www.npmjs.com/package/unlicensed',
    }

    it('check 201', async () => {
        const response = await apiClient.post('/package', packageContent);

        expect(response.status).toBe(201);
        expect(response.data.metadata.Name).toBe('cool-package');
        expect(response.data.data.Content).toBe(packageContent.Content);
    });

    it('check 400', async () => {
        const test = { Name: 'test' };

        await expect(apiClient.post('/package', test))
            .rejects.toThrow('Request failed with status code 400');
    });

    it('check 403', async () => {
        try {
            const response = await apiClient.post('/package', packageContent, true);
            expect(response.status).toBe(403);
        } catch (error: any) {
            expect(error.response.status).toBe(403);
        }
    });

    it('check 409', async () => {
        const test = packageContent;

        await expect(apiClient.post('/package', test))
            .rejects.toThrow('Request failed with status code 409');
    });

});
