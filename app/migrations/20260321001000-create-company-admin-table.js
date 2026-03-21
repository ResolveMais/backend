"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("CompanyAdmin", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Company",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "User",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      is_primary: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    });

    await queryInterface.addConstraint("CompanyAdmin", {
      fields: ["company_id", "user_id"],
      type: "unique",
      name: "UQ_CompanyAdmin_company_user",
    });

    await queryInterface.addIndex("CompanyAdmin", ["company_id"], {
      name: "IX_CompanyAdmin_company_id",
    });

    await queryInterface.addIndex("CompanyAdmin", ["user_id"], {
      name: "IX_CompanyAdmin_user_id",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("CompanyAdmin");
  },
};
