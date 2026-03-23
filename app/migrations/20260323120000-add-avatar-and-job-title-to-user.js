"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
          IF COL_LENGTH('User', 'avatar_url') IS NULL
          BEGIN
              ALTER TABLE [User] ADD [avatar_url] NVARCHAR(500) NULL;
          END;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          IF COL_LENGTH('User', 'job_title') IS NULL
          BEGIN
              ALTER TABLE [User] ADD [job_title] NVARCHAR(120) NULL;
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
          IF COL_LENGTH('User', 'job_title') IS NOT NULL
          BEGIN
              ALTER TABLE [User] DROP COLUMN [job_title];
          END;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          IF COL_LENGTH('User', 'avatar_url') IS NOT NULL
          BEGIN
              ALTER TABLE [User] DROP COLUMN [avatar_url];
          END;
        `,
        { transaction }
      );
    });
  },
};
