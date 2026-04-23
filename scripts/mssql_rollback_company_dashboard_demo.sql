SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRAN;

    /*
      Rollback for:
      backend/scripts/mssql_seed_company_dashboard_demo.sql

      Behavior:
      1. removes all demo tickets created by the seed
      2. if a snapshot from the current seed version exists, restores the
         original User and ComplaintTitle state for the target company
      3. if no snapshot exists, falls back to deleting only the demo users and,
         optionally, empty complaint titles created for the demo

      If there is more than one company in the database, fill:
      - @TargetCompanyId
      or
      - @TargetCompanyCnpj
      or
      - @TargetCompanyName
    */

    DECLARE @TargetCompanyId INT = 1;
    DECLARE @TargetCompanyCnpj VARCHAR(18) = NULL;
    DECLARE @TargetCompanyName NVARCHAR(200) = NULL;
    DECLARE @AllowSingleCompanyFallback BIT = 1;
    DECLARE @RemoveEmptySeedComplaintTitlesWithoutSnapshot BIT = 0;

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

        THROW 51001, 'Empresa alvo nao encontrada. Preencha @TargetCompanyId, @TargetCompanyCnpj ou @TargetCompanyName.', 1;
    END;

    DECLARE @SeedComplaintTitles TABLE (
        title NVARCHAR(100) PRIMARY KEY
    );

    INSERT INTO @SeedComplaintTitles (title)
    VALUES
        (N'Problemas no site'),
        (N'Problemas com produto'),
        (N'Problemas ao alterar senha'),
        (N'Demora na entrega'),
        (N'Cobrança indevida');

    DECLARE @SeedTickets TABLE (ticket_id INT PRIMARY KEY);

    INSERT INTO @SeedTickets (ticket_id)
    SELECT t.id
    FROM dbo.Ticket AS t
    WHERE t.company_id = @CompanyId
      AND t.description LIKE N'seed-dashboard:%';

    DECLARE @DeletedTickets INT = (SELECT COUNT(*) FROM @SeedTickets);
    DECLARE @UsedSnapshot BIT = 0;
    DECLARE @RestoredUsers INT = 0;
    DECLARE @DeletedNewUsers INT = 0;
    DECLARE @RestoredComplaintTitles INT = 0;
    DECLARE @DeletedNewComplaintTitles INT = 0;

    IF EXISTS (SELECT 1 FROM @SeedTickets)
    BEGIN
        DELETE cm
        FROM dbo.ChatMessage AS cm
        INNER JOIN dbo.ChatConversation AS cc
            ON cc.id = cm.conversation_id
        INNER JOIN @SeedTickets AS st
            ON st.ticket_id = cc.ticket_id;

        DELETE cc
        FROM dbo.ChatConversation AS cc
        INNER JOIN @SeedTickets AS st
            ON st.ticket_id = cc.ticket_id;

        DELETE tu
        FROM dbo.TicketUpdate AS tu
        INNER JOIN @SeedTickets AS st
            ON st.ticket_id = tu.ticket_id;

        DELETE t
        FROM dbo.Ticket AS t
        INNER JOIN @SeedTickets AS st
            ON st.ticket_id = t.id;
    END;

    IF OBJECT_ID('dbo.CompanyDashboardSeedSnapshot', 'U') IS NOT NULL
       AND OBJECT_ID('dbo.CompanyDashboardSeedUserSnapshot', 'U') IS NOT NULL
       AND OBJECT_ID('dbo.CompanyDashboardSeedComplaintTitleSnapshot', 'U') IS NOT NULL
       AND EXISTS (
            SELECT 1
            FROM dbo.CompanyDashboardSeedSnapshot AS s
            WHERE s.company_id = @CompanyId
       )
    BEGIN
        SET @UsedSnapshot = 1;

        UPDATE restore_user
        SET
            restore_user.name = snapshot_user.name,
            restore_user.user_type = snapshot_user.user_type,
            restore_user.phone = snapshot_user.phone,
            restore_user.cpf = snapshot_user.cpf,
            restore_user.cnpj = snapshot_user.cnpj,
            restore_user.avatar_url = snapshot_user.avatar_url,
            restore_user.job_title = snapshot_user.job_title,
            restore_user.company_id = snapshot_user.user_company_id,
            restore_user.[password] = snapshot_user.password_hash,
            restore_user.birthDate = snapshot_user.birthDate
        FROM dbo.[User] AS restore_user
        INNER JOIN dbo.CompanyDashboardSeedUserSnapshot AS snapshot_user
            ON snapshot_user.company_id = @CompanyId
           AND snapshot_user.email = restore_user.email
        WHERE snapshot_user.existed_before = 1;

        SET @RestoredUsers = @@ROWCOUNT;

        DELETE restore_user
        FROM dbo.[User] AS restore_user
        INNER JOIN dbo.CompanyDashboardSeedUserSnapshot AS snapshot_user
            ON snapshot_user.company_id = @CompanyId
           AND snapshot_user.email = restore_user.email
        WHERE snapshot_user.existed_before = 0;

        SET @DeletedNewUsers = @@ROWCOUNT;

        UPDATE restore_title
        SET restore_title.description = snapshot_title.description_before
        FROM dbo.ComplaintTitle AS restore_title
        INNER JOIN dbo.CompanyDashboardSeedComplaintTitleSnapshot AS snapshot_title
            ON snapshot_title.company_id = @CompanyId
           AND snapshot_title.title = restore_title.title
        WHERE restore_title.company_id = @CompanyId
          AND snapshot_title.existed_before = 1;

        SET @RestoredComplaintTitles = @@ROWCOUNT;

        DELETE restore_title
        FROM dbo.ComplaintTitle AS restore_title
        INNER JOIN dbo.CompanyDashboardSeedComplaintTitleSnapshot AS snapshot_title
            ON snapshot_title.company_id = @CompanyId
           AND snapshot_title.title = restore_title.title
        WHERE restore_title.company_id = @CompanyId
          AND snapshot_title.existed_before = 0
          AND NOT EXISTS (
              SELECT 1
              FROM dbo.Ticket AS t
              WHERE t.company_id = @CompanyId
                AND t.complaintTitle_id = restore_title.id
          );

        SET @DeletedNewComplaintTitles = @@ROWCOUNT;

        DELETE FROM dbo.CompanyDashboardSeedUserSnapshot
        WHERE company_id = @CompanyId;

        DELETE FROM dbo.CompanyDashboardSeedComplaintTitleSnapshot
        WHERE company_id = @CompanyId;

        DELETE FROM dbo.CompanyDashboardSeedSnapshot
        WHERE company_id = @CompanyId;
    END
    ELSE
    BEGIN
        DELETE u
        FROM dbo.[User] AS u
        WHERE u.email LIKE CONCAT('cliente%.company', @CompanyId, '@seed.local');

        SET @DeletedNewUsers = @DeletedNewUsers + @@ROWCOUNT;

        DELETE u
        FROM dbo.[User] AS u
        WHERE u.email IN (
            CONCAT('clara.company', @CompanyId, '@seed.local'),
            CONCAT('diego.company', @CompanyId, '@seed.local'),
            CONCAT('renata.company', @CompanyId, '@seed.local')
        );

        SET @DeletedNewUsers = @DeletedNewUsers + @@ROWCOUNT;

        IF @RemoveEmptySeedComplaintTitlesWithoutSnapshot = 1
        BEGIN
            DELETE cleanup_title
            FROM dbo.ComplaintTitle AS cleanup_title
            INNER JOIN @SeedComplaintTitles AS seed_title
                ON seed_title.title = cleanup_title.title
            WHERE cleanup_title.company_id = @CompanyId
              AND NOT EXISTS (
                  SELECT 1
                  FROM dbo.Ticket AS t
                  WHERE t.company_id = @CompanyId
                    AND t.complaintTitle_id = cleanup_title.id
              );

            SET @DeletedNewComplaintTitles = @@ROWCOUNT;
        END;
    END;

    COMMIT;

    SELECT
        @CompanyId AS company_id,
        @CompanyName AS company_name,
        @CompanyCnpj AS company_cnpj,
        @UsedSnapshot AS restored_from_snapshot,
        @DeletedTickets AS deleted_seed_tickets,
        @RestoredUsers AS restored_existing_users,
        @DeletedNewUsers AS deleted_seed_users,
        @RestoredComplaintTitles AS restored_complaint_titles,
        @DeletedNewComplaintTitles AS deleted_new_complaint_titles;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK;

    THROW;
END CATCH;
