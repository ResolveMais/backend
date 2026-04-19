// __tests__/user.test.js
import request from 'supertest';
import app from '../index.js';

const gerarCPF = () => {
  const random = Math.floor(Math.random() * 999999999);
  return String(random).padStart(11, '0');
};

const gerarEmail = () => `user_${Date.now()}_${Math.random()}@email.com`;

let authToken = '';
let userId = '';

describe('Feature: Perfil do Usuário', () => {

  beforeAll(async () => {
    const email = gerarEmail();
    const cpf = gerarCPF();
    
    // Registrar usuário
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Usuário Perfil',
        email: email,
        password: '123456',
        userType: 'cliente',
        cpf: cpf,
        phone: '11999999999',
        birthDate: '1990-01-01'
      });
    
    userId = registerResponse.body.user?.id;
    
    // Login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: email,
        password: '123456'
      });
    
    authToken = loginResponse.body.token;
  });

  describe('PATCH /api/users/update-profile - Atualizar perfil', () => {
    
    test('DADO token válido, QUANDO atualizar nome, ENTÃO perfil é atualizado', async () => {
      const response = await request(app)
        .patch('/api/users/update-profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Nome Atualizado Teste',
          phone: '11988887777'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Profile updated successfully');
    });

    test('DADO token válido, QUANDO tentar atualizar CPF, ENTÃO retorna erro', async () => {
      const response = await request(app)
        .patch('/api/users/update-profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cpf: '11111111111'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('CPF/CNPJ cannot be updated');
    });

    test('DADO token válido, QUANDO tentar atualizar para email já existente, ENTÃO retorna erro', async () => {
      // Criar outro usuário
      const outroEmail = gerarEmail();
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Outro Usuário',
          email: outroEmail,
          password: '123456',
          userType: 'cliente',
          cpf: gerarCPF(),
          phone: '11999999999',
          birthDate: '1990-01-01'
        });
      
      // Tentar atualizar para o email do outro usuário
      const response = await request(app)
        .patch('/api/users/update-profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: outroEmail
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('E-mail already registered');
    });

    test('DADO token válido, QUANDO atualizar avatarUrl, ENTÃO atualiza', async () => {
      const response = await request(app)
        .patch('/api/users/update-profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          avatarUrl: 'https://exemplo.com/avatar.jpg'
        });
      
      expect(response.status).toBe(200);
    });

    test('DADO token válido, QUANDO enviar sem campos, ENTÃO retorna erro', async () => {
      const response = await request(app)
        .patch('/api/users/update-profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('No profile fields provided');
    });

    test('DADO sem token, QUANDO atualizar perfil, ENTÃO retorna 401', async () => {
      const response = await request(app)
        .patch('/api/users/update-profile')
        .send({
          name: 'Teste sem token'
        });
      
      expect(response.status).toBe(401);
    });
  });
});

afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 1000));
});