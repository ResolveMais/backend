// __tests__/tickets.test.js
import request from 'supertest';
import app from '../index.js';

const gerarCPF = () => {
  const random = Math.floor(Math.random() * 999999999);
  return String(random).padStart(11, '0');
};

const gerarEmail = () => `cliente_${Date.now()}_${Math.random()}@email.com`;

let authToken = '';

describe('Feature: Gerenciamento de Tickets', () => {

  beforeAll(async () => {
    // Criar um cliente autenticado
    const email = gerarEmail();
    const cpf = gerarCPF();
    
    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Cliente Teste Tickets',
        email: email,
        password: '123456',
        userType: 'cliente',
        cpf: cpf,
        phone: '11999999999',
        birthDate: '1990-01-01'
      });
    
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: email,
        password: '123456'
      });
    
    authToken = loginResponse.body.token;
  });

  describe('GET /api/tickets/companies - Listar empresas', () => {
    
    test('DADO token válido, QUANDO listar empresas, ENTÃO retorna status 200', async () => {
      const response = await request(app)
        .get('/api/tickets/companies')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
    });

    test('DADO sem token, QUANDO listar empresas, ENTÃO retorna 401', async () => {
      const response = await request(app)
        .get('/api/tickets/companies');
      
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/tickets/create - Criar ticket', () => {
    
    test('DADO sem descrição, QUANDO criar ticket, ENTÃO retorna erro 400', async () => {
      const response = await request(app)
        .post('/api/tickets/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          companyId: 1,
          complaintTitleId: 1
        });
      
      expect(response.status).toBe(400);
    });

    test('DADO sem token, QUANDO criar ticket, ENTÃO retorna 401', async () => {
      const response = await request(app)
        .post('/api/tickets/create')
        .send({
          description: 'Teste sem token',
          companyId: 1,
          complaintTitleId: 1
        });
      
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/tickets/my-tickets - Listar meus tickets', () => {
    
    test('DADO token válido, QUANDO listar meus tickets, ENTÃO retorna status 200', async () => {
      const response = await request(app)
        .get('/api/tickets/my-tickets')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
    });

    test('DADO sem token, QUANDO listar meus tickets, ENTÃO retorna 401', async () => {
      const response = await request(app)
        .get('/api/tickets/my-tickets');
      
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/tickets/user-open-pending-tickets', () => {
    
    test('DADO token válido, QUANDO listar tickets abertos, ENTÃO retorna status 200', async () => {
      const response = await request(app)
        .get('/api/tickets/user-open-pending-tickets')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/tickets/user-closed-tickets', () => {
    
    test('DADO token válido, QUANDO listar tickets fechados, ENTÃO retorna status 200', async () => {
      const response = await request(app)
        .get('/api/tickets/user-closed-tickets')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/tickets/recent-updates', () => {
    
    test('DADO token válido, QUANDO buscar atualizações recentes, ENTÃO retorna status 200', async () => {
      const response = await request(app)
        .get('/api/tickets/recent-updates')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
    });
  });
});

afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 500));
});