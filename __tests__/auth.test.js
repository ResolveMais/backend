// __tests__/auth.test.js
import request from 'supertest';
import app from '../index.js';

// Função para gerar CPF válido (11 dígitos)
const gerarCPF = () => {
  const random = Math.floor(Math.random() * 999999999);
  return String(random).padStart(11, '0');
};

// Função para gerar email único
const gerarEmail = () => `teste_${Date.now()}_${Math.random()}@email.com`;

describe('Feature: Autenticação', () => {

  describe('POST /api/auth/register - Cadastro', () => {
    
    test('DADO dados válidos, QUANDO cadastrar, ENTÃO usuário é criado (status 201)', async () => {
      const email = gerarEmail();
      const cpf = gerarCPF();
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Usuário Teste',
          email: email,
          password: '123456',
          userType: 'cliente',
          cpf: cpf,
          phone: '11999999999',
          birthDate: '1990-01-01'
        });
      
      // ✅ Sua API retorna 201
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.message).toBe('User registered successfully');
    });

    test('DADO CPF duplicado, QUANDO cadastrar, ENTÃO retorna erro 400', async () => {
      const email1 = gerarEmail();
      const email2 = gerarEmail();
      const cpf = gerarCPF();
      
      // Primeiro cadastro
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Primeiro',
          email: email1,
          password: '123456',
          userType: 'cliente',
          cpf: cpf,
          phone: '11999999999',
          birthDate: '1990-01-01'
        });
      
      // Tentativa com mesmo CPF
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Segundo',
          email: email2,
          password: '123456',
          userType: 'cliente',
          cpf: cpf,
          phone: '11999999999',
          birthDate: '1990-01-01'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('CPF already registered');
    });

    test('DADO email duplicado, QUANDO cadastrar, ENTÃO retorna erro 400', async () => {
      const email = gerarEmail();
      const cpf1 = gerarCPF();
      const cpf2 = gerarCPF();
      
      // Primeiro cadastro
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Primeiro',
          email: email,
          password: '123456',
          userType: 'cliente',
          cpf: cpf1,
          phone: '11999999999',
          birthDate: '1990-01-01'
        });
      
      // Tentativa com mesmo email
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Segundo',
          email: email,
          password: '123456',
          userType: 'cliente',
          cpf: cpf2,
          phone: '11999999999',
          birthDate: '1990-01-01'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('User already exists');
    });
  });

  describe('POST /api/auth/login - Login', () => {
    
    test('DADO credenciais corretas, QUANDO login, ENTÃO retorna token (status 200)', async () => {
      const email = gerarEmail();
      const cpf = gerarCPF();
      const senha = '123456';
      
      // Criar usuário
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Login Teste',
          email: email,
          password: senha,
          userType: 'cliente',
          cpf: cpf,
          phone: '11999999999',
          birthDate: '1990-01-01'
        });
      
      // Login
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: email,
          password: senha
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.message).toBe('Login successful');
    });

    test('DADO senha incorreta, QUANDO login, ENTÃO retorna erro 400', async () => {
      const email = gerarEmail();
      const cpf = gerarCPF();
      
      // Criar usuário
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Senha Errada',
          email: email,
          password: '123456',
          userType: 'cliente',
          cpf: cpf,
          phone: '11999999999',
          birthDate: '1990-01-01'
        });
      
      // Login com senha errada
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: email,
          password: 'senha_errada'
        });
      
      // ✅ Sua API retorna 400, não 401
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid credentials');
    });

    test('DADO email inexistente, QUANDO login, ENTÃO retorna erro 400', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'naoexiste@email.com',
          password: '123456'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid credentials');
    });
  });

  describe('GET /api/auth/me - Validação de token', () => {
    
    test('DADO token válido, QUANDO acessar /me, ENTÃO retorna dados do usuário', async () => {
      const email = gerarEmail();
      const cpf = gerarCPF();
      
      // Criar usuário
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Token Teste',
          email: email,
          password: '123456',
          userType: 'cliente',
          cpf: cpf,
          phone: '11999999999',
          birthDate: '1990-01-01'
        });
      
      // Login para pegar token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: email,
          password: '123456'
        });
      
      const token = loginResponse.body.token;
      
      // Acessar rota protegida
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(email);
    });

    test('DADO token inválido, QUANDO acessar /me, ENTÃO retorna 401', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer token_invalido_123');
      
      expect(response.status).toBe(401);
    });

    test('DADO sem token, QUANDO acessar /me, ENTÃO retorna 401', async () => {
      const response = await request(app)
        .get('/api/auth/me');
      
      expect(response.status).toBe(401);
    });
  });
});

// Fechar conexões após os testes
afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 1000));
});