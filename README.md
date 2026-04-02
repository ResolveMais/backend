# Backend - Resolve Mais

API REST do projeto `Resolve Mais`, construída com `Node.js`, `Express` e `Sequelize`, usando `SQL Server` como banco de dados.

## O que este repositório faz

- autenticação de usuários com JWT
- cadastro e login
- validação de sessão
- atualização de perfil
- listagem de empresas e assuntos
- criação e consulta de tickets

## Stack

- `Node.js`
- `Express`
- `Sequelize`
- `mssql` / `tedious`
- `bcrypt`
- `jsonwebtoken`
- `dotenv`

## Estrutura

```text
backend/
|-- app/
|   |-- config/
|   |-- controllers/
|   |-- middlewares/
|   |-- models/
|   |-- repositories/
|   |-- routes/
|   |-- services/
|   `-- utils/
|-- .env.example
|-- index.js
|-- package.json
`-- README.md
```

## Requisitos

- `Node.js` 22+
- `npm`
- `SQL Server` acessível

## Variáveis de ambiente

Copie o arquivo de exemplo:

```powershell
Copy-Item .env.example .env
```

Conteúdo esperado:

```env
# DB
DB_HOST=localhost
DB_PORT=1433
DB_NAME=resolve_mais
DB_USER=sa
DB_PASS=[SENHA]

# JWT
JWT_EXPIRATION=1d
ACCESS_TOKEN_SECRET=access_token_secret
JWT_ALGORITHM=HS256

# SERVER
PORT=3001

# Opcional: apenas se quiser sync automatico ao subir em desenvolvimento
DB_SYNC_ON_BOOT=false
```

## Como rodar localmente

### 1. Instale as dependências

```powershell
npm install
```

### 2. Configure o `.env`

```powershell
Copy-Item .env.example .env
```

### 3. Crie o banco manualmente

```sql
CREATE DATABASE resolve_mais;
```

### 4. Suba a API

```powershell
npm run dev
```

A API ficará disponível em:

```text
http://localhost:3001
```

Se quiser rodar sem `nodemon`:

```powershell
npm start
```

## Scripts

- `npm run dev`: inicia em modo desenvolvimento com `nodemon`
- `npm start`: inicia com `node index.js`
- `npm test`: placeholder

## Observação sobre sync automático

Por padrão, o projeto **não executa `sequelize.sync()`** automaticamente.

Se você quiser forçar sync automático ao subir (não recomendado em produção), use:

```env
DB_SYNC_ON_BOOT=true
```

## Rotas principais

### Autenticação - `/api/auth`

- `POST /login`
- `POST /register`
- `GET /me`

#### Cadastro tipo empresa (`POST /register`)

Quando `userType = empresa`, o payload esperado é:

```json
{
  "userType": "empresa",
  "companyName": "Nome da Empresa",
  "companyDescription": "Descricao da empresa",
  "companyCnpj": "00.000.000/0000-00",
  "adminUser": {
    "name": "Nome do Admin",
    "email": "admin@empresa.com",
    "phone": "(11) 99999-9999",
    "cpf": "000.000.000-00",
    "password": "123456"
  }
}
```

A API cria automaticamente:

1. a empresa (`Company`)
2. o usuário administrador inicial (`User`)
3. o vínculo de administrador (`CompanyAdmin` com `is_primary = true`)

Observação: cadastro público de `funcionario` foi desabilitado.
Funcionários só podem ser criados por administradores da empresa.

### Empresas - `/api/companies`

- `GET /all`
- `GET /my-company/admins` (autenticado)
- `POST /my-company/admins` (autenticado)
- `PATCH /my-company/admins/:adminUserId/primary` (autenticado)
- `DELETE /my-company/admins/:adminUserId` (autenticado)
- `GET /my-company/employees` (autenticado, admin)
- `POST /my-company/employees` (autenticado, admin)
- `DELETE /my-company/employees/:employeeUserId` (autenticado, admin)

### Tickets - `/api/tickets`

- `GET /companies`
- `GET /complaint-titles/:companyId`
- `GET /my-tickets`
- `POST /create`
- `GET /user-closed-tickets`
- `GET /user-open-pending-tickets`
- `GET /recent-updates`

### Usuário - `/api/users`

- `PATCH /update-profile`
