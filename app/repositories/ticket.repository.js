const { Ticket: TicketModel, Company, ComplaintTitle, User, TicketUpdate, Employee, Role } = require('../models');

module.exports = {
  create: async ({ description, userId, companyId, complaintTitleId }) => {
    try {
      console.log('💾 REPOSITORY: Criando ticket no banco...');

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

      await TicketUpdate.create({
        message: 'Novo ticket criado',
        type: 'creation',
        ticket_id: newTicket.id
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
        attributes: ['id', 'description', 'status', 'createdAt'],
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

  getClosedByUserId: async (userId) => {
    try {
      const tickets = await TicketModel.findAll({
        where: { user_id: userId, status: 'finalizado' },
        attributes: ['id', 'description', 'status', 'createdAt', 'updatedAt'],
        include: [
          { model: Company, as: 'empresa', attributes: ['name'] },
          { model: ComplaintTitle, as: 'tituloReclamacao', attributes: ['title'] }
        ],
        order: [['createdAt', 'DESC']]
      });
      return tickets;
    } catch (error) {
      console.error('❌ REPOSITORY: Erro ao buscar tickets resolvidos:', error);
      throw error;
    }
  },

  // ✅ NOVO MÉTODO: Buscar tickets abertos E pendentes
  getOpenAndPendingByUserId: async (userId) => {
    try {
      const tickets = await TicketModel.findAll({
        where: { 
          user_id: userId, 
          status: ['aberto', 'pendente']
        },
        attributes: ['id', 'description', 'status', 'createdAt'],
        include: [
          { model: Company, as: 'empresa', attributes: ['name'] },
          { model: ComplaintTitle, as: 'tituloReclamacao', attributes: ['title'] }
        ],
        order: [['createdAt', 'DESC']]
      });
      return tickets;
    } catch (error) {
      console.error('❌ REPOSITORY: Erro ao buscar tickets abertos/pendentes:', error);
      throw error;
    }
  },

  getRecentUpdates: async (userId, limit = 3) => {
    try {
      const updates = await TicketUpdate.findAll({
        include: [
          {
            model: TicketModel,
            as: 'ticket',
            where: { user_id: userId },
            attributes: ['id', 'description', 'status'],
            include: [
              { 
                model: Company, 
                as: 'empresa', 
                attributes: ['name'] 
              }
            ]
          },
          {
            model: Employee,
            as: 'employee',
            attributes: ['id', 'email'],
            include: [
              {
                model: Role,
                as: 'role',
                attributes: ['roleName']
              }
            ]
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: limit
      });

      return updates;
    } catch (error) {
      console.error('❌ REPOSITORY: Erro ao buscar atualizações:', error);
      throw error;
    }
  },

  createUpdate: async ({ ticketId, message, type, employeeId = null }) => {
    try {
      const update = await TicketUpdate.create({
        message,
        type,
        ticket_id: ticketId,
        employee_id: employeeId
      });

      await TicketModel.update(
        { 
          updatedAt: new Date(),
          lastUpdateMessage: message 
        },
        { where: { id: ticketId } }
      );

      return update;
    } catch (error) {
      console.error('❌ REPOSITORY: Erro ao criar atualização:', error);
      throw error;
    }
  }
};