"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("PasswordResetToken", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
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
      token_hash: {
        type: Sequelize.STRING(128),
        allowNull: false,
        unique: true,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      used_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("GETDATE()"),
      },
    });

    await queryInterface.addIndex("PasswordResetToken", ["user_id"], {
      name: "IX_PasswordResetToken_user_id",
    });

    await queryInterface.addIndex("PasswordResetToken", ["expires_at"], {
      name: "IX_PasswordResetToken_expires_at",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("PasswordResetToken");
  },
};

