import apiClient from './apiClientHelper';

describe('/package/{id}/rate', () => {
    beforeAll(async () => {
        await apiClient.authenticate();
    });
    const packageId = '552958c1c5';
  
    it('check 200', async () => {
        const response = await apiClient.get(`package/${packageId}/rate`);
        
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('rating');
    });
  
    it('check 400', async () => {
        try {
            const response = await apiClient.get('package//rate');
            expect(response.status).toBe(400);
        } catch (error: any) {
            expect(error.response.status).toBe(400);
        }
    });
  
    it('check 403', async () => {
        try {
            const response = await apiClient.get(`package/${packageId}/rate`, true);
      
            expect(response.status).toBe(403);
        } catch (error: any) {
            expect(error.response.status).toBe(403);
        }
    });
  
    it('check 400', async () => {
        try {
            const test = '0000';
            const response = await apiClient.get(`package/${test}/rate`);
            expect(response.status).toBe(404);
        } catch (error: any) {
            expect(error.response.status).toBe(404);
        }
    });
  });