SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRAN;

    /*
      Seed de demonstração para a tela de Insights da empresa.

      O script:
      1. localiza uma empresa existente
      2. cria 3 atendentes (User com user_type = funcionario)
      3. cria clientes de apoio
      4. cria assuntos recorrentes se faltarem
      5. remove apenas os tickets seedados anteriormente para a empresa alvo
      6. insere tickets, avaliações, logs e trocas de mensagem

      Senha dos atendentes e clientes seedados:
      Atendente@123

      Observação:
      - se houver apenas uma empresa na base, o script usa essa empresa automaticamente
      - se houver mais de uma empresa, preencha @TargetCompanyId, @TargetCompanyCnpj ou @TargetCompanyName
    */

    DECLARE @TargetCompanyId INT = 1;
    DECLARE @TargetCompanyCnpj VARCHAR(18) = NULL;
    DECLARE @TargetCompanyName NVARCHAR(200) = NULL;
    DECLARE @AllowSingleCompanyFallback BIT = 1;

    DECLARE @SeedPasswordHash VARCHAR(100) = '$2b$10$tVxDWxwp/vjb1VLYNnXTVuNheqJlxtiGgt/Lc0JCJemdwGp8aJz06';

    IF COL_LENGTH('dbo.Ticket', 'assigned_user_id') IS NULL
       OR COL_LENGTH('dbo.Ticket', 'customer_rating') IS NULL
       OR COL_LENGTH('dbo.ChatConversation', 'ticket_id') IS NULL
       OR COL_LENGTH('dbo.ChatMessage', 'sender_type') IS NULL
       OR COL_LENGTH('dbo.ChatMessage', 'conversation_id') IS NULL
    BEGIN
        THROW 50001, 'O schema atual nao contem as colunas esperadas pelo seed do dashboard.', 1;
    END;

    DECLARE @CompanyId INT = NULL;
    DECLARE @CompanyName NVARCHAR(200) = NULL;
    DECLARE @CompanyCnpj VARCHAR(18) = NULL;

    SELECT TOP (1)
        @CompanyId = c.id,
        @CompanyName = c.name,
        @CompanyCnpj = c.cnpj
    FROM dbo.Company AS c
    WHERE (@TargetCompanyId IS NOT NULL AND c.id = @TargetCompanyId)
       OR (@TargetCompanyCnpj IS NOT NULL AND c.cnpj = @TargetCompanyCnpj)
       OR (@TargetCompanyName IS NOT NULL AND c.name = @TargetCompanyName)
    ORDER BY c.id;

    IF @CompanyId IS NULL
       AND @AllowSingleCompanyFallback = 1
       AND (SELECT COUNT(*) FROM dbo.Company) = 1
    BEGIN
        SELECT TOP (1)
            @CompanyId = c.id,
            @CompanyName = c.name,
            @CompanyCnpj = c.cnpj
        FROM dbo.Company AS c
        ORDER BY c.id;
    END;

    IF @CompanyId IS NULL
    BEGIN
        SELECT
            c.id AS company_id,
            c.name AS company_name,
            c.cnpj AS company_cnpj
        FROM dbo.Company AS c
        ORDER BY c.id;

        THROW 50002, 'Empresa alvo nao encontrada. Preencha @TargetCompanyId, @TargetCompanyCnpj ou @TargetCompanyName.', 1;
    END;

    DECLARE @Now DATETIME2(0) = SYSDATETIME();

    IF OBJECT_ID('dbo.CompanyDashboardSeedSnapshot', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.CompanyDashboardSeedSnapshot (
            company_id INT NOT NULL PRIMARY KEY,
            company_name NVARCHAR(200) NULL,
            company_cnpj VARCHAR(18) NULL,
            created_at DATETIME2(0) NOT NULL
                CONSTRAINT DF_CompanyDashboardSeedSnapshot_created_at DEFAULT SYSDATETIME()
        );
    END;

    IF OBJECT_ID('dbo.CompanyDashboardSeedUserSnapshot', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.CompanyDashboardSeedUserSnapshot (
            company_id INT NOT NULL,
            email NVARCHAR(200) NOT NULL,
            user_id INT NULL,
            existed_before BIT NOT NULL,
            name NVARCHAR(120) NULL,
            user_type VARCHAR(20) NULL,
            phone VARCHAR(20) NULL,
            cpf VARCHAR(14) NULL,
            cnpj VARCHAR(18) NULL,
            avatar_url NVARCHAR(500) NULL,
            job_title NVARCHAR(120) NULL,
            user_company_id INT NULL,
            password_hash VARCHAR(255) NULL,
            birthDate DATETIME NULL,
            CONSTRAINT PK_CompanyDashboardSeedUserSnapshot PRIMARY KEY (company_id, email)
        );
    END;

    IF OBJECT_ID('dbo.CompanyDashboardSeedComplaintTitleSnapshot', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.CompanyDashboardSeedComplaintTitleSnapshot (
            company_id INT NOT NULL,
            title NVARCHAR(100) NOT NULL,
            complaint_title_id INT NULL,
            existed_before BIT NOT NULL,
            description_before NVARCHAR(255) NULL,
            CONSTRAINT PK_CompanyDashboardSeedComplaintTitleSnapshot PRIMARY KEY (company_id, title)
        );
    END;

    DECLARE @ComplaintTitles TABLE (
        slot TINYINT PRIMARY KEY,
        title NVARCHAR(100) NOT NULL,
        description NVARCHAR(255) NULL,
        complaint_title_id INT NULL
    );

    INSERT INTO @ComplaintTitles (slot, title, description)
    VALUES
        (1, N'Problemas no site', N'Falhas no checkout, login ou navegação.'),
        (2, N'Problemas com produto', N'Defeitos, avarias ou divergências do item recebido.'),
        (3, N'Problemas ao alterar senha', N'Erros no fluxo de recuperação ou atualização de senha.'),
        (4, N'Demora na entrega', N'Atrasos no prazo e dificuldades com rastreio.'),
        (5, N'Cobrança indevida', N'Cobranças duplicadas ou valores divergentes.');

    DECLARE @Employees TABLE (
        slot TINYINT PRIMARY KEY,
        name NVARCHAR(120) NOT NULL,
        email NVARCHAR(200) NOT NULL,
        cpf VARCHAR(11) NOT NULL,
        phone VARCHAR(20) NULL,
        job_title NVARCHAR(120) NULL,
        user_id INT NULL
    );

    INSERT INTO @Employees (slot, name, email, cpf, phone, job_title)
    VALUES
        (
            1,
            N'Clara Sousa',
            CONCAT('clara.company', @CompanyId, '@seed.local'),
            RIGHT(CONCAT('00000000000', CAST(CAST(81000000000 AS BIGINT) + (@CompanyId * 10) + 1 AS VARCHAR(20))), 11),
            '(11) 98888-1101',
            N'Especialista de Atendimento'
        ),
        (
            2,
            N'Diego Lima',
            CONCAT('diego.company', @CompanyId, '@seed.local'),
            RIGHT(CONCAT('00000000000', CAST(CAST(81000000000 AS BIGINT) + (@CompanyId * 10) + 2 AS VARCHAR(20))), 11),
            '(11) 98888-1102',
            N'Analista de Relacionamento'
        ),
        (
            3,
            N'Renata Costa',
            CONCAT('renata.company', @CompanyId, '@seed.local'),
            RIGHT(CONCAT('00000000000', CAST(CAST(81000000000 AS BIGINT) + (@CompanyId * 10) + 3 AS VARCHAR(20))), 11),
            '(11) 98888-1103',
            N'Supervisora de Suporte'
        );

    DECLARE @Customers TABLE (
        slot TINYINT PRIMARY KEY,
        name NVARCHAR(120) NOT NULL,
        email NVARCHAR(200) NOT NULL,
        cpf VARCHAR(11) NOT NULL,
        phone VARCHAR(20) NULL,
        user_id INT NULL
    );

    INSERT INTO @Customers (slot, name, email, cpf, phone)
    VALUES
        (1, N'Ana Martins', CONCAT('cliente01.company', @CompanyId, '@seed.local'), RIGHT(CONCAT('00000000000', CAST(CAST(82000000000 AS BIGINT) + (@CompanyId * 100) + 1 AS VARCHAR(20))), 11), '(11) 97777-2101'),
        (2, N'Bruno Oliveira', CONCAT('cliente02.company', @CompanyId, '@seed.local'), RIGHT(CONCAT('00000000000', CAST(CAST(82000000000 AS BIGINT) + (@CompanyId * 100) + 2 AS VARCHAR(20))), 11), '(11) 97777-2102'),
        (3, N'Carla Mendes', CONCAT('cliente03.company', @CompanyId, '@seed.local'), RIGHT(CONCAT('00000000000', CAST(CAST(82000000000 AS BIGINT) + (@CompanyId * 100) + 3 AS VARCHAR(20))), 11), '(11) 97777-2103'),
        (4, N'Daniel Rocha', CONCAT('cliente04.company', @CompanyId, '@seed.local'), RIGHT(CONCAT('00000000000', CAST(CAST(82000000000 AS BIGINT) + (@CompanyId * 100) + 4 AS VARCHAR(20))), 11), '(11) 97777-2104'),
        (5, N'Elisa Ferreira', CONCAT('cliente05.company', @CompanyId, '@seed.local'), RIGHT(CONCAT('00000000000', CAST(CAST(82000000000 AS BIGINT) + (@CompanyId * 100) + 5 AS VARCHAR(20))), 11), '(11) 97777-2105'),
        (6, N'Felipe Gomes', CONCAT('cliente06.company', @CompanyId, '@seed.local'), RIGHT(CONCAT('00000000000', CAST(CAST(82000000000 AS BIGINT) + (@CompanyId * 100) + 6 AS VARCHAR(20))), 11), '(11) 97777-2106'),
        (7, N'Gabriela Nunes', CONCAT('cliente07.company', @CompanyId, '@seed.local'), RIGHT(CONCAT('00000000000', CAST(CAST(82000000000 AS BIGINT) + (@CompanyId * 100) + 7 AS VARCHAR(20))), 11), '(11) 97777-2107'),
        (8, N'Heitor Alves', CONCAT('cliente08.company', @CompanyId, '@seed.local'), RIGHT(CONCAT('00000000000', CAST(CAST(82000000000 AS BIGINT) + (@CompanyId * 100) + 8 AS VARCHAR(20))), 11), '(11) 97777-2108'),
        (9, N'Isabela Castro', CONCAT('cliente09.company', @CompanyId, '@seed.local'), RIGHT(CONCAT('00000000000', CAST(CAST(82000000000 AS BIGINT) + (@CompanyId * 100) + 9 AS VARCHAR(20))), 11), '(11) 97777-2109'),
        (10, N'João Ribeiro', CONCAT('cliente10.company', @CompanyId, '@seed.local'), RIGHT(CONCAT('00000000000', CAST(CAST(82000000000 AS BIGINT) + (@CompanyId * 100) + 10 AS VARCHAR(20))), 11), '(11) 97777-2110'),
        (11, N'Karen Teixeira', CONCAT('cliente11.company', @CompanyId, '@seed.local'), RIGHT(CONCAT('00000000000', CAST(CAST(82000000000 AS BIGINT) + (@CompanyId * 100) + 11 AS VARCHAR(20))), 11), '(11) 97777-2111'),
        (12, N'Lucas Barbosa', CONCAT('cliente12.company', @CompanyId, '@seed.local'), RIGHT(CONCAT('00000000000', CAST(CAST(82000000000 AS BIGINT) + (@CompanyId * 100) + 12 AS VARCHAR(20))), 11), '(11) 97777-2112');

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.CompanyDashboardSeedSnapshot AS s
        WHERE s.company_id = @CompanyId
    )
    BEGIN
        INSERT INTO dbo.CompanyDashboardSeedSnapshot (
            company_id,
            company_name,
            company_cnpj
        )
        VALUES (
            @CompanyId,
            @CompanyName,
            @CompanyCnpj
        );

        INSERT INTO dbo.CompanyDashboardSeedUserSnapshot (
            company_id,
            email,
            user_id,
            existed_before,
            name,
            user_type,
            phone,
            cpf,
            cnpj,
            avatar_url,
            job_title,
            user_company_id,
            password_hash,
            birthDate
        )
        SELECT
            @CompanyId,
            seed_users.email,
            existing_user.id,
            CASE
                WHEN existing_user.id IS NULL THEN 0
                ELSE 1
            END,
            existing_user.name,
            existing_user.user_type,
            existing_user.phone,
            existing_user.cpf,
            existing_user.cnpj,
            existing_user.avatar_url,
            existing_user.job_title,
            existing_user.company_id,
            existing_user.[password],
            existing_user.birthDate
        FROM (
            SELECT email FROM @Employees
            UNION
            SELECT email FROM @Customers
        ) AS seed_users
        LEFT JOIN dbo.[User] AS existing_user
            ON existing_user.email = seed_users.email;

        INSERT INTO dbo.CompanyDashboardSeedComplaintTitleSnapshot (
            company_id,
            title,
            complaint_title_id,
            existed_before,
            description_before
        )
        SELECT
            @CompanyId,
            seed_titles.title,
            existing_title.id,
            CASE
                WHEN existing_title.id IS NULL THEN 0
                ELSE 1
            END,
            existing_title.description
        FROM @ComplaintTitles AS seed_titles
        LEFT JOIN dbo.ComplaintTitle AS existing_title
            ON existing_title.company_id = @CompanyId
           AND existing_title.title = seed_titles.title;
    END;

    DECLARE @slot TINYINT;
    DECLARE @name NVARCHAR(120);
    DECLARE @email NVARCHAR(200);
    DECLARE @cpf VARCHAR(11);
    DECLARE @phone VARCHAR(20);
    DECLARE @jobTitle NVARCHAR(120);
    DECLARE @userId INT;

    DECLARE employee_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT slot, name, email, cpf, phone, job_title
        FROM @Employees
        ORDER BY slot;

    OPEN employee_cursor;
    FETCH NEXT FROM employee_cursor INTO @slot, @name, @email, @cpf, @phone, @jobTitle;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @userId = NULL;

        SELECT @userId = u.id
        FROM dbo.[User] AS u
        WHERE u.email = @email;

        IF @userId IS NULL
        BEGIN
            INSERT INTO dbo.[User] (
                name,
                email,
                user_type,
                phone,
                cpf,
                cnpj,
                avatar_url,
                job_title,
                company_id,
                [password],
                birthDate
            )
            VALUES (
                @name,
                @email,
                'funcionario',
                @phone,
                @cpf,
                NULL,
                NULL,
                @jobTitle,
                @CompanyId,
                @SeedPasswordHash,
                NULL
            );

            SET @userId = CAST(SCOPE_IDENTITY() AS INT);
        END
        ELSE
        BEGIN
            UPDATE dbo.[User]
            SET
                name = @name,
                user_type = 'funcionario',
                phone = @phone,
                cpf = @cpf,
                cnpj = NULL,
                job_title = @jobTitle,
                company_id = @CompanyId,
                [password] = @SeedPasswordHash
            WHERE id = @userId;
        END;

        UPDATE @Employees
        SET user_id = @userId
        WHERE slot = @slot;

        FETCH NEXT FROM employee_cursor INTO @slot, @name, @email, @cpf, @phone, @jobTitle;
    END;

    CLOSE employee_cursor;
    DEALLOCATE employee_cursor;

    DECLARE customer_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT slot, name, email, cpf, phone
        FROM @Customers
        ORDER BY slot;

    OPEN customer_cursor;
    FETCH NEXT FROM customer_cursor INTO @slot, @name, @email, @cpf, @phone;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @userId = NULL;

        SELECT @userId = u.id
        FROM dbo.[User] AS u
        WHERE u.email = @email;

        IF @userId IS NULL
        BEGIN
            INSERT INTO dbo.[User] (
                name,
                email,
                user_type,
                phone,
                cpf,
                cnpj,
                avatar_url,
                job_title,
                company_id,
                [password],
                birthDate
            )
            VALUES (
                @name,
                @email,
                'cliente',
                @phone,
                @cpf,
                NULL,
                NULL,
                NULL,
                NULL,
                @SeedPasswordHash,
                NULL
            );

            SET @userId = CAST(SCOPE_IDENTITY() AS INT);
        END
        ELSE
        BEGIN
            UPDATE dbo.[User]
            SET
                name = @name,
                user_type = 'cliente',
                phone = @phone,
                cpf = @cpf,
                cnpj = NULL,
                job_title = NULL,
                company_id = NULL,
                [password] = @SeedPasswordHash
            WHERE id = @userId;
        END;

        UPDATE @Customers
        SET user_id = @userId
        WHERE slot = @slot;

        FETCH NEXT FROM customer_cursor INTO @slot, @name, @email, @cpf, @phone;
    END;

    CLOSE customer_cursor;
    DEALLOCATE customer_cursor;

    DECLARE @titleSlot TINYINT;
    DECLARE @titleName NVARCHAR(100);
    DECLARE @titleDescription NVARCHAR(255);
    DECLARE @complaintTitleId INT;

    DECLARE title_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT slot, title, description
        FROM @ComplaintTitles
        ORDER BY slot;

    OPEN title_cursor;
    FETCH NEXT FROM title_cursor INTO @titleSlot, @titleName, @titleDescription;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @complaintTitleId = NULL;

        SELECT @complaintTitleId = ct.id
        FROM dbo.ComplaintTitle AS ct
        WHERE ct.company_id = @CompanyId
          AND ct.title = @titleName;

        IF @complaintTitleId IS NULL
        BEGIN
            INSERT INTO dbo.ComplaintTitle (
                title,
                description,
                company_id
            )
            VALUES (
                @titleName,
                @titleDescription,
                @CompanyId
            );

            SET @complaintTitleId = CAST(SCOPE_IDENTITY() AS INT);
        END
        ELSE
        BEGIN
            UPDATE dbo.ComplaintTitle
            SET description = @titleDescription
            WHERE id = @complaintTitleId;
        END;

        UPDATE @ComplaintTitles
        SET complaint_title_id = @complaintTitleId
        WHERE slot = @titleSlot;

        FETCH NEXT FROM title_cursor INTO @titleSlot, @titleName, @titleDescription;
    END;

    CLOSE title_cursor;
    DEALLOCATE title_cursor;

    DECLARE @ExistingSeedTickets TABLE (ticket_id INT PRIMARY KEY);

    INSERT INTO @ExistingSeedTickets (ticket_id)
    SELECT t.id
    FROM dbo.Ticket AS t
    WHERE t.company_id = @CompanyId
      AND t.description LIKE N'seed-dashboard:%';

    IF EXISTS (SELECT 1 FROM @ExistingSeedTickets)
    BEGIN
        DELETE cm
        FROM dbo.ChatMessage AS cm
        INNER JOIN dbo.ChatConversation AS cc
            ON cc.id = cm.conversation_id
        INNER JOIN @ExistingSeedTickets AS st
            ON st.ticket_id = cc.ticket_id;

        DELETE cc
        FROM dbo.ChatConversation AS cc
        INNER JOIN @ExistingSeedTickets AS st
            ON st.ticket_id = cc.ticket_id;

        DELETE tu
        FROM dbo.TicketUpdate AS tu
        INNER JOIN @ExistingSeedTickets AS st
            ON st.ticket_id = tu.ticket_id;

        DELETE t
        FROM dbo.Ticket AS t
        INNER JOIN @ExistingSeedTickets AS st
            ON st.ticket_id = t.id;
    END;

    DECLARE @TicketSeeds TABLE (
        seed_id INT IDENTITY(1,1) PRIMARY KEY,
        customer_slot TINYINT NOT NULL,
        title_slot TINYINT NOT NULL,
        employee_slot TINYINT NULL,
        status VARCHAR(20) NOT NULL,
        days_ago INT NOT NULL,
        created_hour TINYINT NOT NULL,
        description NVARCHAR(300) NOT NULL,
        customer_message NVARCHAR(MAX) NOT NULL,
        employee_message NVARCHAR(MAX) NULL,
        resolution_message NVARCHAR(MAX) NULL,
        rating TINYINT NULL,
        feedback NVARCHAR(400) NULL
    );

    INSERT INTO @TicketSeeds (
        customer_slot,
        title_slot,
        employee_slot,
        status,
        days_ago,
        created_hour,
        description,
        customer_message,
        employee_message,
        resolution_message,
        rating,
        feedback
    )
    VALUES
        (1, 1, NULL, 'aberto',    0,  9, N'seed-dashboard: checkout com erro ao finalizar pedido',              N'Nao consigo finalizar a compra porque o botao de pagamento trava no checkout.', NULL, NULL, NULL, NULL),
        (2, 2, NULL, 'aberto',    0, 11, N'seed-dashboard: produto entregue com avaria na embalagem',          N'O produto chegou com a embalagem rasgada e preciso de orientacao para troca.', NULL, NULL, NULL, NULL),
        (3, 5, NULL, 'aberto',    1,  8, N'seed-dashboard: cliente relata cobranca duplicada',                 N'Foi cobrado duas vezes no meu cartao e preciso confirmar o estorno.', NULL, NULL, NULL, NULL),
        (4, 4, 1,    'pendente',  1, 10, N'seed-dashboard: atraso no pedido premium',                          N'O rastreio nao atualiza e o prazo informado ja passou.', N'Eu ja acionei a transportadora e vou acompanhar esse envio para voce.', NULL, NULL, NULL),
        (5, 3, 1,    'pendente',  2, 14, N'seed-dashboard: erro para redefinir senha do portal',               N'Recebo mensagem de token invalido toda vez que tento alterar a senha.', N'Vou revisar o fluxo da sua conta e validar o token gerado pelo sistema.', NULL, NULL, NULL),
        (6, 1, 2,    'pendente',  2,  9, N'seed-dashboard: instabilidade na area logada',                      N'Depois do login a pagina principal fica em branco no navegador.', N'Consegui reproduzir a falha e estou validando com o time tecnico.', NULL, NULL, NULL),
        (7, 2, 2,    'pendente',  3, 13, N'seed-dashboard: divergencia entre item comprado e entregue',        N'Recebi uma versao diferente do produto anunciado na vitrine.', N'Vou comparar o pedido com a nota fiscal e seguir com a tratativa.', NULL, NULL, NULL),
        (8, 4, 2,    'pendente',  4, 15, N'seed-dashboard: remessa parada ha varios dias',                     N'O pedido foi postado, mas ficou parado no mesmo centro de distribuicao.', N'Estou acompanhando com a operacao logistica para destravar a remessa.', NULL, NULL, NULL),
        (9, 5, 3,    'pendente',  4, 10, N'seed-dashboard: desconto nao aplicado e cobranca acima do esperado', N'O cupom foi aceito, mas o valor final nao refletiu o desconto prometido.', N'Vou revisar o pedido e retornar com o ajuste do valor cobrado.', NULL, NULL, NULL),
        (10, 1, 1,   'resolvido', 5,  9, N'seed-dashboard: erro pontual no checkout resolvido apos suporte',   N'O site travou no fechamento do pedido depois que escolhi a forma de entrega.', N'Ajustei a sessao da sua conta e validei o checkout novamente.', N'Acabei de confirmar que o checkout voltou a funcionar corretamente.', 5, N'Atendimento muito rapido e objetivo.'),
        (11, 3, 3,   'resolvido', 6, 11, N'seed-dashboard: recuperacao de senha normalizada',                  N'Eu nao recebia o e-mail de redefinicao de senha mesmo tentando varias vezes.', N'Reconfigurei o envio do token e fiz um teste com sucesso.', N'Agora o fluxo de redefinicao esta normalizado para sua conta.', 4, N'Resolveu bem e explicou o passo a passo.'),
        (12, 2, 2,   'resolvido', 7, 16, N'seed-dashboard: troca por item com defeito ainda gerando duvidas',  N'O produto veio com defeito, mas a tratativa da troca demorou bastante.', N'Identifiquei o lote do item e segui com a solicitacao de troca.', N'A troca foi liberada e voce ja pode acompanhar o novo envio.', 2, N'Demorou mais do que eu esperava para ter uma resposta final.'),
        (13, 4, 1,   'fechado',   8, 10, N'seed-dashboard: entrega reprogramada e concluida',                  N'Preciso saber o novo prazo da entrega porque o original venceu ontem.', N'Conferi com a transportadora e trouxe a nova previsao para voce.', N'A entrega foi concluida e o pedido ja consta como recebido.', 5, N'Excelente acompanhamento do inicio ao fim.'),
        (14, 1, 1,   'fechado',  10,  9, N'seed-dashboard: pedido voltou a passar no checkout apos ajuste',    N'Eu nao conseguia fechar a compra em nenhum navegador ou dispositivo.', N'Corrigi uma inconsistencia do seu cadastro e refiz os testes.', N'Validei novamente e o pedido foi concluido sem erros.', 4, N'Boa resposta e boa comunicacao durante o atendimento.'),
        (15, 5, 3,   'fechado',  12, 14, N'seed-dashboard: cobranca ajustada com estorno confirmado',          N'Apareceu uma cobranca duplicada depois do fechamento do pedido.', N'Localizei o pagamento em duplicidade e abri o pedido de estorno.', N'O estorno ja foi confirmado pela operadora do cartao.', 5, N'Muito claro no retorno e resolveu o problema.'),
        (16, 2, 2,   'fechado',  14, 13, N'seed-dashboard: troca liberada apos analise tecnica',               N'Precisei acionar a garantia porque o produto apresentou falha em poucos dias.', N'Recebi as evidencias e segui com a aprovacao da troca.', N'A troca foi concluida e o novo produto ja esta em uso.', 3, N'Resolveu, mas a comunicacao poderia ter sido mais agil.'),
        (17, 3, 3,   'fechado',  16, 10, N'seed-dashboard: senha redefinida e acesso recuperado',              N'Nao conseguia entrar na area do cliente porque o fluxo de redefinicao falhava.', N'Atualizei os dados da sua conta e refiz o envio do token.', N'O acesso foi restabelecido e o login voltou ao normal.', 4, N'Foi uma boa experiencia e resolveu sem retrabalho.'),
        (18, 4, 1,   'fechado',  18, 15, N'seed-dashboard: atraso compensado com nova entrega prioritaria',    N'Preciso de uma posicao porque a entrega passou muito do prazo informado.', N'Priorizei a remessa e acompanhei a liberacao com a transportadora.', N'A nova entrega foi concluida com prioridade e sem novas falhas.', 5, N'Equipe muito eficiente e prestativa.'),
        (19, 1, 2,   'pendente',  1, 16, N'seed-dashboard: erro intermitente na area de pedidos',              N'A lista de pedidos abre vazia algumas vezes e so volta depois de atualizar.', N'Estou cruzando os logs do portal para encontrar a origem da instabilidade.', NULL, NULL, NULL),
        (20, 2, NULL,'aberto',    0, 14, N'seed-dashboard: cliente quer orientacao sobre processo de troca',    N'O produto nao atendeu a expectativa e quero entender como funciona a troca.', NULL, NULL, NULL, NULL);

    DECLARE
        @SeedId INT,
        @CustomerSlot TINYINT,
        @TitleSlotSeed TINYINT,
        @EmployeeSlotSeed TINYINT,
        @StatusSeed VARCHAR(20),
        @DaysAgo INT,
        @CreatedHour TINYINT,
        @DescriptionSeed NVARCHAR(300),
        @CustomerMessageSeed NVARCHAR(MAX),
        @EmployeeMessageSeed NVARCHAR(MAX),
        @ResolutionMessageSeed NVARCHAR(MAX),
        @RatingSeed TINYINT,
        @FeedbackSeed NVARCHAR(400);

    DECLARE
        @CustomerId INT,
        @CustomerName NVARCHAR(120),
        @ComplaintTitleSeedId INT,
        @AssignedUserId INT,
        @AssignedUserName NVARCHAR(120),
        @CreatedAt DATETIME2(0),
        @AcceptedAt DATETIME2(0),
        @ResolvedAt DATETIME2(0),
        @ClosedAt DATETIME2(0),
        @EvaluatedAt DATETIME2(0),
        @UpdatedAt DATETIME2(0),
        @LastInteractionAt DATETIME2(0),
        @LastUpdateMessage NVARCHAR(300),
        @ResolutionSource VARCHAR(20),
        @TicketId INT,
        @ConversationId INT,
        @CustomerFollowupMessage NVARCHAR(300),
        @SystemMessage NVARCHAR(300);

    DECLARE ticket_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT
            seed_id,
            customer_slot,
            title_slot,
            employee_slot,
            status,
            days_ago,
            created_hour,
            description,
            customer_message,
            employee_message,
            resolution_message,
            rating,
            feedback
        FROM @TicketSeeds
        ORDER BY seed_id;

    OPEN ticket_cursor;
    FETCH NEXT FROM ticket_cursor INTO
        @SeedId,
        @CustomerSlot,
        @TitleSlotSeed,
        @EmployeeSlotSeed,
        @StatusSeed,
        @DaysAgo,
        @CreatedHour,
        @DescriptionSeed,
        @CustomerMessageSeed,
        @EmployeeMessageSeed,
        @ResolutionMessageSeed,
        @RatingSeed,
        @FeedbackSeed;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @CustomerId = NULL;
        SET @CustomerName = NULL;
        SET @ComplaintTitleSeedId = NULL;
        SET @AssignedUserId = NULL;
        SET @AssignedUserName = NULL;

        SELECT
            @CustomerId = c.user_id,
            @CustomerName = c.name
        FROM @Customers AS c
        WHERE c.slot = @CustomerSlot;

        SELECT
            @ComplaintTitleSeedId = ct.complaint_title_id
        FROM @ComplaintTitles AS ct
        WHERE ct.slot = @TitleSlotSeed;

        SELECT
            @AssignedUserId = e.user_id,
            @AssignedUserName = e.name
        FROM @Employees AS e
        WHERE e.slot = @EmployeeSlotSeed;

        SET @CreatedAt = DATEADD(
            HOUR,
            @CreatedHour,
            CAST(CAST(DATEADD(DAY, -@DaysAgo, @Now) AS DATE) AS DATETIME2(0))
        );

        SET @AcceptedAt = CASE
            WHEN @AssignedUserId IS NOT NULL THEN DATEADD(HOUR, 1, @CreatedAt)
            ELSE NULL
        END;

        SET @ResolvedAt = CASE
            WHEN @StatusSeed IN ('resolvido', 'fechado') THEN DATEADD(HOUR, 6, @CreatedAt)
            ELSE NULL
        END;

        SET @ClosedAt = CASE
            WHEN @StatusSeed = 'fechado' THEN DATEADD(HOUR, 12, @ResolvedAt)
            ELSE NULL
        END;

        SET @EvaluatedAt = CASE
            WHEN @RatingSeed IS NOT NULL THEN DATEADD(HOUR, 2, COALESCE(@ClosedAt, @ResolvedAt))
            ELSE NULL
        END;

        SET @UpdatedAt = COALESCE(@EvaluatedAt, @ClosedAt, @ResolvedAt, @AcceptedAt, @CreatedAt);
        SET @LastInteractionAt = @UpdatedAt;
        SET @ResolutionSource = CASE
            WHEN @StatusSeed IN ('resolvido', 'fechado') AND @AssignedUserId IS NOT NULL THEN 'human'
            ELSE NULL
        END;

        SET @LastUpdateMessage = CASE
            WHEN @RatingSeed IS NOT NULL THEN N'Cliente avaliou o atendimento.'
            WHEN @StatusSeed = 'fechado' THEN N'Ticket encerrado pelo cliente.'
            WHEN @StatusSeed = 'resolvido' THEN N'Ticket marcado como resolvido.'
            WHEN @StatusSeed = 'pendente' THEN N'Atendimento humano em andamento.'
            ELSE N'Novo ticket criado.'
        END;

        SET @CustomerFollowupMessage = CASE
            WHEN @AssignedUserId IS NOT NULL THEN N'Enviei prints e detalhes adicionais para acelerar a analise.'
            ELSE NULL
        END;

        SET @SystemMessage = CASE
            WHEN @AssignedUserId IS NOT NULL THEN CONCAT(N'Resolve Mais direcionou o ticket para ', @AssignedUserName, N'.')
            ELSE NULL
        END;

        INSERT INTO dbo.Ticket (
            description,
            status,
            createdAt,
            updatedAt,
            lastUpdateMessage,
            assigned_user_id,
            accepted_at,
            resolved_at,
            closed_at,
            reopened_at,
            last_interaction_at,
            auto_closed_at,
            resolution_source,
            customer_rating,
            customer_feedback,
            customer_evaluated_at,
            user_id,
            company_id,
            complaintTitle_id
        )
        VALUES (
            @DescriptionSeed,
            @StatusSeed,
            @CreatedAt,
            @UpdatedAt,
            @LastUpdateMessage,
            @AssignedUserId,
            @AcceptedAt,
            @ResolvedAt,
            @ClosedAt,
            NULL,
            @LastInteractionAt,
            NULL,
            @ResolutionSource,
            @RatingSeed,
            @FeedbackSeed,
            @EvaluatedAt,
            @CustomerId,
            @CompanyId,
            @ComplaintTitleSeedId
        );

        SET @TicketId = CAST(SCOPE_IDENTITY() AS INT);

        INSERT INTO dbo.TicketUpdate (message, type, createdAt, ticket_id)
        VALUES (N'Novo ticket criado', 'creation', DATEADD(MINUTE, 1, @CreatedAt), @TicketId);

        IF @AssignedUserId IS NOT NULL
        BEGIN
            INSERT INTO dbo.TicketUpdate (message, type, createdAt, ticket_id)
            VALUES (CONCAT(N'Responsavel definido para ', @AssignedUserName), 'response', DATEADD(MINUTE, 2, @AcceptedAt), @TicketId);
        END;

        IF @StatusSeed IN ('resolvido', 'fechado')
        BEGIN
            INSERT INTO dbo.TicketUpdate (message, type, createdAt, ticket_id)
            VALUES (N'Ticket marcado como resolvido', 'status_change', @ResolvedAt, @TicketId);
        END;

        IF @RatingSeed IS NOT NULL
        BEGIN
            INSERT INTO dbo.TicketUpdate (message, type, createdAt, ticket_id)
            VALUES (
                CONCAT(N'Cliente avaliou o atendimento com ', @RatingSeed, N' estrela(s).'),
                'status_change',
                @EvaluatedAt,
                @TicketId
            );
        END;

        IF @StatusSeed = 'fechado'
        BEGIN
            INSERT INTO dbo.TicketUpdate (message, type, createdAt, ticket_id)
            VALUES (N'Ticket encerrado pelo cliente', 'closure', @ClosedAt, @TicketId);
        END;

        INSERT INTO dbo.ChatConversation (
            del,
            deletedAt,
            ticket_id,
            createdAt,
            updatedAt,
            user_id
        )
        VALUES (
            0,
            NULL,
            @TicketId,
            @CreatedAt,
            @UpdatedAt,
            @CustomerId
        );

        SET @ConversationId = CAST(SCOPE_IDENTITY() AS INT);

        INSERT INTO dbo.ChatMessage (
            role,
            content,
            sender_type,
            sender_name,
            sender_user_id,
            message_type,
            customer_read_at,
            company_read_at,
            reminder_sent_at,
            del,
            deletedAt,
            createdAt,
            conversation_id
        )
        VALUES (
            'assistant',
            N'Oi! Sou o Resolve Assist. Recebi a sua solicitação e já organizei o contexto inicial deste atendimento.',
            'bot',
            N'Resolve Assist',
            NULL,
            'chat',
            DATEADD(MINUTE, 1, @CreatedAt),
            DATEADD(MINUTE, 1, @CreatedAt),
            DATEADD(MINUTE, 1, @CreatedAt),
            0,
            NULL,
            DATEADD(MINUTE, 1, @CreatedAt),
            @ConversationId
        );

        INSERT INTO dbo.ChatMessage (
            role,
            content,
            sender_type,
            sender_name,
            sender_user_id,
            message_type,
            customer_read_at,
            company_read_at,
            reminder_sent_at,
            del,
            deletedAt,
            createdAt,
            conversation_id
        )
        VALUES (
            'user',
            @CustomerMessageSeed,
            'cliente',
            @CustomerName,
            @CustomerId,
            'chat',
            DATEADD(MINUTE, 5, @CreatedAt),
            DATEADD(MINUTE, 5, @CreatedAt),
            DATEADD(MINUTE, 5, @CreatedAt),
            0,
            NULL,
            DATEADD(MINUTE, 5, @CreatedAt),
            @ConversationId
        );

        IF @AssignedUserId IS NOT NULL
        BEGIN
            INSERT INTO dbo.ChatMessage (
                role,
                content,
                sender_type,
                sender_name,
                sender_user_id,
                message_type,
                customer_read_at,
                company_read_at,
                reminder_sent_at,
                del,
                deletedAt,
                createdAt,
                conversation_id
            )
            VALUES (
                'system',
                @SystemMessage,
                'sistema',
                N'Resolve Mais',
                NULL,
                'system',
                @AcceptedAt,
                @AcceptedAt,
                @AcceptedAt,
                0,
                NULL,
                @AcceptedAt,
                @ConversationId
            );

            INSERT INTO dbo.ChatMessage (
                role,
                content,
                sender_type,
                sender_name,
                sender_user_id,
                message_type,
                customer_read_at,
                company_read_at,
                reminder_sent_at,
                del,
                deletedAt,
                createdAt,
                conversation_id
            )
            VALUES (
                'assistant',
                @EmployeeMessageSeed,
                'funcionario',
                @AssignedUserName,
                @AssignedUserId,
                'chat',
                DATEADD(MINUTE, 15, @AcceptedAt),
                DATEADD(MINUTE, 15, @AcceptedAt),
                DATEADD(MINUTE, 15, @AcceptedAt),
                0,
                NULL,
                DATEADD(MINUTE, 15, @AcceptedAt),
                @ConversationId
            );

            INSERT INTO dbo.ChatMessage (
                role,
                content,
                sender_type,
                sender_name,
                sender_user_id,
                message_type,
                customer_read_at,
                company_read_at,
                reminder_sent_at,
                del,
                deletedAt,
                createdAt,
                conversation_id
            )
            VALUES (
                'user',
                @CustomerFollowupMessage,
                'cliente',
                @CustomerName,
                @CustomerId,
                'chat',
                DATEADD(MINUTE, 40, @AcceptedAt),
                DATEADD(MINUTE, 40, @AcceptedAt),
                DATEADD(MINUTE, 40, @AcceptedAt),
                0,
                NULL,
                DATEADD(MINUTE, 40, @AcceptedAt),
                @ConversationId
            );
        END;

        IF @ResolutionMessageSeed IS NOT NULL
        BEGIN
            INSERT INTO dbo.ChatMessage (
                role,
                content,
                sender_type,
                sender_name,
                sender_user_id,
                message_type,
                customer_read_at,
                company_read_at,
                reminder_sent_at,
                del,
                deletedAt,
                createdAt,
                conversation_id
            )
            VALUES (
                'assistant',
                @ResolutionMessageSeed,
                'funcionario',
                @AssignedUserName,
                @AssignedUserId,
                'chat',
                DATEADD(MINUTE, -15, @ResolvedAt),
                DATEADD(MINUTE, -15, @ResolvedAt),
                DATEADD(MINUTE, -15, @ResolvedAt),
                0,
                NULL,
                DATEADD(MINUTE, -15, @ResolvedAt),
                @ConversationId
            );
        END;

        UPDATE dbo.ChatConversation
        SET updatedAt = @UpdatedAt
        WHERE id = @ConversationId;

        FETCH NEXT FROM ticket_cursor INTO
            @SeedId,
            @CustomerSlot,
            @TitleSlotSeed,
            @EmployeeSlotSeed,
            @StatusSeed,
            @DaysAgo,
            @CreatedHour,
            @DescriptionSeed,
            @CustomerMessageSeed,
            @EmployeeMessageSeed,
            @ResolutionMessageSeed,
            @RatingSeed,
            @FeedbackSeed;
    END;

    CLOSE ticket_cursor;
    DEALLOCATE ticket_cursor;

    COMMIT;

    SELECT
        @CompanyId AS company_id,
        @CompanyName AS company_name,
        @CompanyCnpj AS company_cnpj,
        'Atendente@123' AS seed_password;

    SELECT
        e.name,
        e.email,
        e.job_title
    FROM @Employees AS e
    ORDER BY e.slot;

    SELECT
        COUNT(*) AS seeded_tickets
    FROM dbo.Ticket
    WHERE company_id = @CompanyId
      AND description LIKE N'seed-dashboard:%';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK;

    THROW;
END CATCH;
