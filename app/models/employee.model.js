module.exports = (sequelize, Sequelize) => {
  const Employee = sequelize.define('Employee', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: Sequelize.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'Employee',
    timestamps: false,
  });

  Employee.associate = (models) => {
    // Each employee belongs to a role
    Employee.belongsTo(models.Role, {
      foreignKey: 'role_id',
      as: 'role',
    });

    // Each employee belongs to a company
    Employee.belongsTo(models.Company, {
      foreignKey: 'company_id',
      as: 'company',
    });
  };

  return Employee;
};
