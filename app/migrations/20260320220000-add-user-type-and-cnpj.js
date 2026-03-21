"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
          IF COL_LENGTH('User', 'user_type') IS NULL
          BEGIN
              ALTER TABLE [User] ADD [user_type] NVARCHAR(20) NULL;
          END;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          IF COL_LENGTH('User', 'cnpj') IS NULL
          BEGIN
              ALTER TABLE [User] ADD [cnpj] NVARCHAR(18) NULL;
          END;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          IF EXISTS (
              SELECT 1
              FROM sys.columns
              WHERE object_id = OBJECT_ID('[User]')
                AND name = 'cpf'
                AND is_nullable = 0
          )
          BEGIN
              ALTER TABLE [User] ALTER COLUMN [cpf] NVARCHAR(14) NULL;
          END;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          UPDATE [User]
          SET [user_type] = 'cliente'
          WHERE [user_type] IS NULL;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          UPDATE [User]
          SET [cpf] = REPLACE(REPLACE(REPLACE(REPLACE([cpf], '.', ''), '-', ''), '/', ''), ' ', '')
          WHERE [cpf] IS NOT NULL;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          UPDATE [User]
          SET [cnpj] = REPLACE(REPLACE(REPLACE(REPLACE([cnpj], '.', ''), '-', ''), '/', ''), ' ', '')
          WHERE [cnpj] IS NOT NULL;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          ALTER TABLE [User] ALTER COLUMN [user_type] NVARCHAR(20) NOT NULL;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          IF NOT EXISTS (
              SELECT 1
              FROM sys.default_constraints
              WHERE parent_object_id = OBJECT_ID('[User]')
                AND name = 'DF_User_user_type'
          )
          BEGIN
              ALTER TABLE [User]
              ADD CONSTRAINT [DF_User_user_type] DEFAULT 'cliente' FOR [user_type];
          END;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          IF NOT EXISTS (
              SELECT 1
              FROM sys.check_constraints
              WHERE parent_object_id = OBJECT_ID('[User]')
                AND name = 'CK_User_user_type'
          )
          BEGIN
              ALTER TABLE [User]
              ADD CONSTRAINT [CK_User_user_type]
              CHECK ([user_type] IN ('cliente', 'funcionario', 'empresa'));
          END;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          DECLARE @CpfConstraintName NVARCHAR(128);
          SELECT TOP 1 @CpfConstraintName = kc.name
          FROM sys.key_constraints kc
          JOIN sys.index_columns ic
              ON kc.parent_object_id = ic.object_id
             AND kc.unique_index_id = ic.index_id
          JOIN sys.columns c
              ON c.object_id = ic.object_id
             AND c.column_id = ic.column_id
          WHERE kc.parent_object_id = OBJECT_ID('[User]')
            AND kc.[type] = 'UQ'
            AND c.name = 'cpf';

          IF @CpfConstraintName IS NOT NULL
          BEGIN
              EXEC('ALTER TABLE [User] DROP CONSTRAINT [' + @CpfConstraintName + ']');
          END;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          DECLARE @CpfUniqueIndexName NVARCHAR(128);
          SELECT TOP 1 @CpfUniqueIndexName = i.name
          FROM sys.indexes i
          JOIN sys.index_columns ic
              ON i.object_id = ic.object_id
             AND i.index_id = ic.index_id
          JOIN sys.columns c
              ON c.object_id = ic.object_id
             AND c.column_id = ic.column_id
          WHERE i.object_id = OBJECT_ID('[User]')
            AND i.is_unique = 1
            AND i.is_primary_key = 0
            AND c.name = 'cpf'
            AND i.name <> 'IX_User_cpf_not_null';

          IF @CpfUniqueIndexName IS NOT NULL
          BEGIN
              EXEC('DROP INDEX [' + @CpfUniqueIndexName + '] ON [User]');
          END;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          IF NOT EXISTS (
              SELECT 1
              FROM sys.indexes
              WHERE object_id = OBJECT_ID('[User]')
                AND name = 'IX_User_cpf_not_null'
          )
          BEGIN
              CREATE UNIQUE INDEX [IX_User_cpf_not_null]
                  ON [User]([cpf])
                  WHERE [cpf] IS NOT NULL;
          END;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          IF NOT EXISTS (
              SELECT 1
              FROM sys.indexes
              WHERE object_id = OBJECT_ID('[User]')
                AND name = 'IX_User_cnpj_not_null'
          )
          BEGIN
              CREATE UNIQUE INDEX [IX_User_cnpj_not_null]
                  ON [User]([cnpj])
                  WHERE [cnpj] IS NOT NULL;
          END;
        `,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
          IF EXISTS (
              SELECT 1
              FROM sys.indexes
              WHERE object_id = OBJECT_ID('[User]')
                AND name = 'IX_User_cpf_not_null'
          )
          BEGIN
              DROP INDEX [IX_User_cpf_not_null] ON [User];
          END;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          IF EXISTS (
              SELECT 1
              FROM sys.indexes
              WHERE object_id = OBJECT_ID('[User]')
                AND name = 'IX_User_cnpj_not_null'
          )
          BEGIN
              DROP INDEX [IX_User_cnpj_not_null] ON [User];
          END;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          IF EXISTS (
              SELECT 1
              FROM sys.check_constraints
              WHERE parent_object_id = OBJECT_ID('[User]')
                AND name = 'CK_User_user_type'
          )
          BEGIN
              ALTER TABLE [User] DROP CONSTRAINT [CK_User_user_type];
          END;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          DECLARE @UserTypeDefaultConstraint NVARCHAR(128);
          SELECT TOP 1 @UserTypeDefaultConstraint = dc.name
          FROM sys.default_constraints dc
          JOIN sys.columns c
              ON dc.parent_object_id = c.object_id
             AND dc.parent_column_id = c.column_id
          WHERE dc.parent_object_id = OBJECT_ID('[User]')
            AND c.name = 'user_type';

          IF @UserTypeDefaultConstraint IS NOT NULL
          BEGIN
              EXEC('ALTER TABLE [User] DROP CONSTRAINT [' + @UserTypeDefaultConstraint + ']');
          END;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          IF COL_LENGTH('User', 'cnpj') IS NOT NULL
          BEGIN
              ALTER TABLE [User] DROP COLUMN [cnpj];
          END;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          IF COL_LENGTH('User', 'user_type') IS NOT NULL
          BEGIN
              ALTER TABLE [User] DROP COLUMN [user_type];
          END;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          IF EXISTS (SELECT 1 FROM [User] WHERE [cpf] IS NULL)
          BEGIN
              THROW 50001, 'Nao foi possivel desfazer: existem usuarios sem CPF.', 1;
          END;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          ALTER TABLE [User] ALTER COLUMN [cpf] NVARCHAR(14) NOT NULL;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          IF NOT EXISTS (
              SELECT 1
              FROM sys.key_constraints
              WHERE parent_object_id = OBJECT_ID('[User]')
                AND name = 'UQ_User_cpf'
          )
          BEGIN
              ALTER TABLE [User] ADD CONSTRAINT [UQ_User_cpf] UNIQUE ([cpf]);
          END;
        `,
        { transaction }
      );
    });
  },
};
