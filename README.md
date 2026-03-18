# Backend - Resolve Mais

API REST do projeto `Resolve Mais`, construída com `Node.js`, `Express` e `Sequelize`, usando `SQL Server` como banco de dados.

## O que este repositório faz

O backend é responsável por:

- autenticação de usuários com JWT
- cadastro de novos usuários
- validação de sessão
- atualização de perfil
- listagem de empresas
- listagem de assuntos por empresa
- criação de tickets
- consulta de tickets abertos, finalizados e atualizações recentes

## Stack

- `Node.js`
- `Express`
- `Sequelize`
- `mssql` / `tedious`
- `bcrypt`
- `jsonwebtoken`
- `dotenv`
- `nodemon`

## Estrutura

```text
backend/
├── app/
│   ├── config/        # Configuração do banco
│   ├── controllers/   # Camada HTTP
│   ├── middlewares/   # Autenticação
│   ├── models/        # Models e associações
│   ├── repositories/  # Acesso ao banco
│   ├── routes/        # Rotas da API
│   ├── services/      # Regras de negócio
│   └── utils/         # JWT e utilitários
├── .env.example
├── index.js
├── package.json
└── README.md
```

## Requisitos

- `Node.js` 22+
- `npm`
- `SQL Server` em execução e acessível

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
```

### O que cada variável significa

- `DB_HOST`: host do SQL Server
- `DB_PORT`: porta do SQL Server
- `DB_NAME`: nome do banco que a API vai usar
- `DB_USER`: usuário do SQL Server
- `DB_PASS`: senha do SQL Server
- `JWT_EXPIRATION`: validade do token
- `ACCESS_TOKEN_SECRET`: chave usada para assinar os tokens
- `JWT_ALGORITHM`: algoritmo do JWT
- `PORT`: porta HTTP da API

## Como preparar o banco

### Importante

O projeto **não cria o banco de dados automaticamente**.

Ele apenas:

- conecta no banco informado em `DB_NAME`
- cria/sincroniza as tabelas automaticamente com `sequelize.sync()`

Ou seja:

- você precisa criar o banco `resolve_mais` manualmente no SQL Server
- depois disso, ao subir a API, o Sequelize cria as tabelas necessárias

### Exemplo para criar o banco

```sql
CREATE DATABASE resolve_mais;
```

## Como rodar localmente

### 1. Instale as dependências

```powershell
npm install
```

### 2. Configure o `.env`

Crie o arquivo:

```powershell
Copy-Item .env.example .env
```

Depois preencha os dados reais de conexão com o SQL Server.

### 3. Inicie o servidor

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
- `npm test`: placeholder, ainda não há testes configurados

## O que é criado automaticamente

Quando a API inicia com acesso correto ao SQL Server:

- a conexão com o banco é validada
- os models são carregados
- o Sequelize executa `sync()`
- as tabelas são criadas ou sincronizadas conforme os models

## O que não é criado automaticamente

Atualmente o projeto **não possui seed automática** para dados iniciais.

Isso significa que, após criar o banco e subir a API, pode ser necessário inserir manualmente alguns registros para o sistema fazer sentido, principalmente:

- empresas
- títulos de reclamação (`ComplaintTitle`) vinculados às empresas

Sem esses dados, o fluxo de abertura de ticket pode não ter opções para seleção no frontend.

## Rotas principais

### Autenticação - `/api/auth`

- `POST /login`
- `POST /register`
- `GET /me`

### Empresas - `/api/companies`

- `GET /all`

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

## Autenticação

As rotas protegidas esperam o header:

```http
Authorization: Bearer <token>
```

O token é gerado no login e também no cadastro do usuário.

## Integração com o frontend

O frontend consome esta API usando:

```env
VITE_API_URL=http://localhost:3001/api
```

## Observações importantes

- o dialeto configurado no Sequelize é `mssql`
- a conexão usa `trustServerCertificate: true`, o que ajuda em ambiente local
- o projeto hoje depende de `sequelize.sync()` em vez de migrations
- o banco precisa existir antes de iniciar a API

## Melhorias futuras recomendadas

- adicionar migrations
- adicionar seed inicial de empresas e assuntos
- documentar payloads e respostas da API
- criar testes automatizados
