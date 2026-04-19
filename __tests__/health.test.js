// __tests__/health.test.js
import request from 'supertest';
import app from '../index.js';

describe('Feature: Health Check', () => {
  
  test('GET / - Deve retornar Hello World', async () => {
    const response = await request(app)
      .get('/');
    
    expect(response.status).toBe(200);
    expect(response.text).toContain('Hello World');
  });
});