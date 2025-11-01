module.exports = (sequelize, Sequelize) => {
  const ComplaintTitle = sequelize.define('ComplaintTitle', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: Sequelize.STRING(100),
      allowNull: false,
    },
    description: {
      type: Sequelize.STRING,
      allowNull: true,
    },
  }, {
    tableName: 'ComplaintTitle',
    timestamps: false,
  });

  ComplaintTitle.associate = (models) => {
    // Cada título pertence a uma empresa
    ComplaintTitle.belongsTo(models.Company, {
      foreignKey: 'company_id',
      as: 'empresa',
    });

    // Um título pode estar vinculado a vários tickets
    ComplaintTitle.hasMany(models.Ticket, {
      foreignKey: 'complaintTitle_id',
      as: 'tickets',
    });
  };

  return ComplaintTitle;
};
