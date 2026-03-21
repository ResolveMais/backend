module.exports = (sequelize, Sequelize) => {
  const Company = sequelize.define('Company', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: Sequelize.STRING,
    },
    cnpj: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
  }, {
    tableName: "Company",
    timestamps: false,
  });

  Company.associate = (models) => {
    // A company has many employees
    Company.hasMany(models.Employee, {
      foreignKey: 'company_id',
      as: 'employees',
    });

    // A company has many tickets
    Company.hasMany(models.Ticket, {
      foreignKey: 'company_id',
      as: 'tickets',
    });

    // A company has many complaint titles
    Company.hasMany(models.ComplaintTitle, {
      foreignKey: 'company_id',
      as: 'complaintTitles',
    });

    Company.hasMany(models.CompanyAdmin, {
      foreignKey: "company_id",
      as: "companyAdmins",
    });

    Company.belongsToMany(models.User, {
      through: models.CompanyAdmin,
      foreignKey: "company_id",
      otherKey: "user_id",
      as: "adminUsers",
    });

    Company.hasMany(models.User, {
      foreignKey: "company_id",
      as: "users",
    });
  };

  return Company;
};
