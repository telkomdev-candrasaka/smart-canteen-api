const request = require('supertest');
const app = require('../../src/app');

test('GET /health returns API status', async () => {
  await request(app)
    .get('/health')
    .expect(200)
    .expect((res) => {
      expect(res.body).toEqual({ success: true, message: 'API is running' });
    });
});

test('unknown route returns 404 with route message', async () => {
  await request(app)
    .get('/unknown-path')
    .expect(404)
    .expect((res) => {
      expect(res.body).toEqual({ success: false, message: 'Route GET /unknown-path not found' });
    });
});
