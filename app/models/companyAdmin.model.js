const initCompanyAdminModel = (sequelize, Sequelize) => {
  const CompanyAdmin = sequelize.define(
    "CompanyAdmin",
    {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      isPrimary: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_primary",
      },
    },
    {
      tableName: "CompanyAdmin",
      timestamps: false,
    }
  );

  CompanyAdmin.associate = (models) => {
    CompanyAdmin.belongsTo(models.Company, {
      foreignKey: "company_id",
      as: "company",
    });

    CompanyAdmin.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "user",
    });
  };

  return CompanyAdmin;
};

export default initCompanyAdminModel;
