module.exports = (sequelize, Sequelize) => {
  const Ticket = sequelize.define('Ticket', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    description: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    status: {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'aberto',
    },
    createdAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
    },
  }, {
    tableName: 'Ticket',
    timestamps: false,
  });

  Ticket.associate = (models) => {
    // Cada ticket pertence a um cliente
    Ticket.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'cliente',
    });

    // Cada ticket pertence a uma empresa
    Ticket.belongsTo(models.Company, {
      foreignKey: 'company_id',
      as: 'empresa',
    });

    // Cada ticket está vinculado a um título padrão de reclamação
    Ticket.belongsTo(models.ComplaintTitle, {
      foreignKey: 'complaintTitle_id',
      as: 'tituloReclamacao',
    });
  };

  return Ticket;
};
