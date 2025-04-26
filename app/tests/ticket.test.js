const request = require('supertest');
const app = require('../index');
const { ticket: Ticket } = require('../app/models');

describe('Ticket API', () => {
    let authToken;

    beforeAll(async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({
                email: 'admin@example.com',
                password: 'admin123'
            });
        authToken = res.body.token;
    });

    it('should create a new ticket', async () => {
        const res = await request(app)
            .post('/tickets')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                title: 'Test Ticket',
                description: 'This is a test ticket'
            });
        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('id');
    });

    afterAll(async () => {
        await Ticket.destroy({ where: { title: 'Test Ticket' } });
    });
});