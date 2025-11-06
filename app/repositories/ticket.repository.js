const { Ticket: TicketModel, Company, ComplaintTitle, User } = require('../models');

module.exports = {
  create: async ({ description, userId, companyId, complaintTitleId }) => {
    try {
      console.log('💾 REPOSITORY: Criando ticket no banco...');

      // Verificar se as chaves estrangeiras existem
      const [userExists, companyExists, complaintTitleExists] = await Promise.all([
        User.findByPk(userId),
        Company.findByPk(companyId),
        ComplaintTitle.findByPk(complaintTitleId)
      ]);

      if (!userExists) throw new Error(`Usuário ID ${userId} não encontrado`);
      if (!companyExists) throw new Error(`Empresa ID ${companyId} não encontrada`);
      if (!complaintTitleExists) throw new Error(`Assunto ID ${complaintTitleId} não encontrado`);

      const newTicket = await TicketModel.create({
        description,
        user_id: userId,
        company_id: companyId,
        complaintTitle_id: complaintTitleId,
        status: 'aberto'
      });

      return newTicket;
    } catch (error) {
      console.error('❌ REPOSITORY: Erro ao criar ticket:', error.message);
      throw error;
    }
  },

  getComplaintTitlesByCompany: async (companyId) => {
    try {
      const complaintTitles = await ComplaintTitle.findAll({
        where: { company_id: companyId },
        attributes: ['id', 'title', 'description'],
        include: [{
          model: Company,
          as: 'empresa',
          attributes: ['id', 'name']
        }]
      });
      return complaintTitles;
    } catch (error) {
      console.error('❌ REPOSITORY: Erro ao buscar assuntos:', error);
      throw error;
    }
  },

  getByUserId: async (userId) => {
    try {
      const tickets = await TicketModel.findAll({
        where: { user_id: userId },
        attributes: ['id', 'description', 'status', 'createdAt'], // 🔒 só o necessário
        include: [
          { model: Company, as: 'empresa', attributes: ['name'] },
          { model: ComplaintTitle, as: 'tituloReclamacao', attributes: ['title'] }
        ],
        order: [['createdAt', 'DESC']]
      });
      return tickets;
    } catch (error) {
      console.error('❌ REPOSITORY: Erro ao buscar tickets:', error);
      throw error;
    }
  },

  getPendingByUserId: async (userId) => {
    try {
      const tickets = await TicketModel.findAll({
        where: { user_id: userId, status: 'aberto' },
        attributes: ['id', 'description', 'status', 'createdAt'],
        include: [
          { model: Company, as: 'empresa', attributes: ['name'] },
          { model: ComplaintTitle, as: 'tituloReclamacao', attributes: ['title'] }
        ],
        order: [['createdAt', 'DESC']]
      });
      return tickets;
    } catch (error) {
      console.error('❌ REPOSITORY: Erro ao buscar tickets pendentes:', error);
      throw error;
    }
  }
};
