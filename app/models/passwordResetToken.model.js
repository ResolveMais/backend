module.exports = (sequelize, Sequelize) => {
  const PasswordResetToken = sequelize.define(
    "PasswordResetToken",
    {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        field: "user_id",
      },
      tokenHash: {
        type: Sequelize.STRING(128),
        allowNull: false,
        unique: true,
        field: "token_hash",
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
        field: "expires_at",
      },
      usedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        field: "used_at",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        field: "created_at",
      },
    },
    {
      tableName: "PasswordResetToken",
      timestamps: false,
    }
  );

  PasswordResetToken.associate = (models) => {
    PasswordResetToken.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "user",
    });
  };

  return PasswordResetToken;
};
