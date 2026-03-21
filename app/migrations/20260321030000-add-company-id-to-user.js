"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDefinition = await queryInterface.describeTable("User");

    if (!tableDefinition.company_id) {
      await queryInterface.addColumn("User", "company_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Company",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }

    await queryInterface.addIndex("User", ["company_id"], {
      name: "IX_User_company_id",
    });
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex("User", "IX_User_company_id");
    } catch (error) {
      // ignore if index does not exist
    }

    const tableDefinition = await queryInterface.describeTable("User");
    if (tableDefinition.company_id) {
      await queryInterface.removeColumn("User", "company_id");
    }
  },
};
