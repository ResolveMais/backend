module.exports = (sequelize, Sequelize) => {
  const Role = sequelize.define('Role', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    roleName: {
      type: Sequelize.STRING(50),
      allowNull: false,
      unique: true,
    },
    description: {
      type: Sequelize.STRING,
    },
  }, {
    tableName: 'Role',
    timestamps: false,
  });

  Role.associate = (models) => {
    // One role can have many employees
    Role.hasMany(models.Employee, {
      foreignKey: 'role_id',
      as: 'employees',
    });
  };

  return Role;
};
