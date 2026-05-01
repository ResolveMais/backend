# Backend - Resolve Mais

API REST do projeto **Resolve Mais**, construída com `Node.js`, `Express`, `Sequelize` e `SQL Server`.

## Stack

- `Node.js`
- `Express`
- `Sequelize`
- `SQL Server`
- `tedious`
- `bcrypt`
- `jsonwebtoken`
- `dotenv`
- `nodemailer`
- `OpenAI`

## Pré-requisitos

- `Node.js` 22 ou superior
- `npm`
- instância do `SQL Server` acessível
- banco `resolve_mais` criado no SQL Server

## Passo a passo para iniciar

### 1. Entrar na pasta do backend

```powershell
cd backend
```

### 2. Instalar as dependências

```powershell
npm install
```

### 3. Criar o banco de dados

Caso o banco ainda não exista, crie manualmente no SQL Server:

```sql
CREATE DATABASE resolve_mais;
```

### 4. Criar o arquivo de ambiente

```powershell
Copy-Item .env.example .env
```

### 5. Configurar o `.env`

Exemplo de configuração local:

```env
# DB
DB_HOST=localhost
DB_PORT=1433
DB_NAME=resolve_mais
DB_USER=sa
DB_PASS=sua_senha

# DB bootstrap
DB_SYNC_ON_BOOT=true
# DB_SYNC_ALTER=false

# JWT
JWT_EXPIRATION=1d
JWT_SECRET=secret_key_here
ACCESS_TOKEN_SECRET=access_token_secret
JWT_ALGORITHM=HS256

# OPENAI
OPENAI_API_KEY=sua_chave_openai
OPENAI_MODEL=gpt-4.1-nano

# SERVER
PORT=3001
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
APP_URL=http://localhost:3000

# MAIL
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_SECURE=false
MAIL_FROM=

# Opcional
RESET_PASSWORD_EXPIRES_MINUTES=30
TICKET_AUTOMATION_INTERVAL_MS=60000
```

### 6. Entender o `DB_SYNC_ON_BOOT`

- `DB_SYNC_ON_BOOT=true`: ao subir a API, o Sequelize autentica, cria/sincroniza as tabelas e executa o bootstrap do schema
- `DB_SYNC_ON_BOOT=false`: a API apenas testa a conexão com o banco; se as tabelas ainda não existirem, a aplicação não ficará pronta para uso

Para a primeira subida em ambiente local, o mais seguro é manter `DB_SYNC_ON_BOOT=true`.

### 7. Iniciar a API

```powershell
npm run dev
```

### 8. Confirmar a porta da API

Com a configuração padrão, a API sobe em:

```text
http://localhost:3001
```

Se quiser rodar sem `nodemon`:

```powershell
npm start
```

## Ordem correta para subir o projeto completo

1. Inicie o SQL Server.
2. Suba o backend com `npm run dev`.
3. Suba o frontend.
4. Acesse o frontend em `http://localhost:3000`.

## Variáveis importantes

### Obrigatórias para a API

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASS`
- `ACCESS_TOKEN_SECRET`
- `JWT_EXPIRATION`
- `JWT_ALGORITHM`
- `PORT`

O token JWT usado pela aplicação é assinado com `ACCESS_TOKEN_SECRET`. O campo `JWT_SECRET` ainda aparece no `.env.example`, mas hoje não é o segredo utilizado no fluxo principal.

### Obrigatórias para integração local com o frontend

- `APP_URL`
- `CORS_ALLOWED_ORIGINS`

### Opcionais por funcionalidade

- `OPENAI_API_KEY` e `OPENAI_MODEL`: necessários para o chatbot
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `MAIL_FROM`: necessários para envio de e-mails
- `RESET_PASSWORD_EXPIRES_MINUTES`: validade do link de redefinição de senha
- `TICKET_AUTOMATION_INTERVAL_MS`: intervalo da automação de tickets
- `DB_SYNC_ALTER`: usa `sequelize.sync({ alter: true })`

## Scripts disponíveis

- `npm run dev`: inicia a API com `nodemon`
- `npm start`: inicia a API com `node index.js`
- `npm test`: executa a suíte de testes
- `npm run test:watch`: executa os testes em modo watch
- `npm run test:coverage`: gera cobertura de testes

## Rotas base da API

- `/api/auth`
- `/api/chatbot`
- `/api/companies`
- `/api/tickets`
- `/api/users`

## Observações importantes

- O chatbot retorna erro de serviço se `OPENAI_API_KEY` não estiver configurada.
- O fluxo de redefinição de senha depende de `APP_URL` e das variáveis SMTP.
- O backend aplica CORS com base em `CORS_ALLOWED_ORIGINS` ou `ALLOWED_ORIGINS`.
- A aplicação exporta o `app` para testes e só inicia o servidor automaticamente fora de `NODE_ENV=test` e fora do ambiente Vercel.
