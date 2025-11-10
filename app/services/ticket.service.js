const ticketRepository = require('../repositories/ticket.repository');
const companyRepository = require('../repositories/company.repository');

exports.createTicket = async ({ description, userId, companyId, complaintTitleId }) => {
  try {
    console.log('🔧 SERVICE: Criando ticket...');
    if (!description?.trim()) return { status: 400, message: 'Descrição é obrigatória' };
    if (!userId) return { status: 400, message: 'Usuário não autenticado' };
    if (!companyId) return { status: 400, message: 'Empresa é obrigatória' };
    if (!complaintTitleId) return { status: 400, message: 'Assunto é obrigatório' };

    const newTicket = await ticketRepository.create({
      description: description.trim(),
      userId,
      companyId,
      complaintTitleId
    });

    return {
      status: 201,
      message: 'Ticket criado com sucesso',
      ticket: {
        id: newTicket.id,
        descricao: newTicket.description,
        status: newTicket.status,
        criadoEm: newTicket.createdAt
      }
    };
  } catch (error) {
    console.error('❌ SERVICE: Erro ao criar ticket:', error);
    return { status: 500, message: 'Erro interno ao criar ticket. Tente novamente mais tarde.' };
  }
};

exports.getCompanies = async () => {
  try {
    console.log('🏢 SERVICE: Buscando empresas...');
    const companies = await companyRepository.getAll();
    return { status: 200, companies };
  } catch (error) {
    console.error('❌ SERVICE: Erro ao buscar empresas:', error);
    return { status: 500, message: 'Erro ao buscar empresas.' };
  }
};

exports.getComplaintTitlesByCompany = async (companyId) => {
  try {
    if (!companyId) return { status: 400, message: 'ID da empresa é obrigatório' };
    const complaintTitles = await ticketRepository.getComplaintTitlesByCompany(companyId);
    return { status: 200, complaintTitles };
  } catch (error) {
    console.error('❌ SERVICE: Erro ao buscar assuntos:', error);
    return { status: 500, message: 'Erro ao buscar assuntos.' };
  }
};

exports.getUserTickets = async (userId) => {
  try {
    if (!userId) return { status: 400, message: 'ID do usuário é obrigatório' };

    const tickets = await ticketRepository.getByUserId(userId);

    // 🔒 Sanitização — só envia campos necessários
    const sanitized = tickets.map((t) => ({
      id: t.id,
      empresa: t.empresa?.name || 'Empresa não informada',
      tituloReclamacao: t.tituloReclamacao?.title || 'Sem título',
      descricao: t.description,
      status: t.status,
      criadoEm: t.createdAt
    }));

    return { status: 200, tickets: sanitized };
  } catch (error) {
    console.error('❌ SERVICE: Erro ao buscar tickets:', error);
    return { status: 500, message: 'Erro ao buscar tickets.' };
  }
};

exports.getUserPendingTickets = async (userId) => {
  try {
    if (!userId) return { status: 400, message: 'ID do usuário é obrigatório' };

    const tickets = await ticketRepository.getPendingByUserId(userId);

    // 🔒 Sanitização
    const sanitized = tickets.map((t) => ({
      id: t.id,
      empresa: t.empresa?.name || 'Empresa não informada',
      tituloReclamacao: t.tituloReclamacao?.title || 'Sem título',
      descricao: t.description,
      status: t.status,
      criadoEm: t.createdAt
    }));

    return { status: 200, tickets: sanitized };
  } catch (error) {
    console.error('❌ SERVICE: Erro ao buscar tickets pendentes:', error);
    return { status: 500, message: 'Erro ao buscar tickets pendentes.' };
  }
};

// ✅ NOVO SERVICE: Buscar últimas atualizações
exports.getRecentUpdates = async (userId) => {
  try {
    if (!userId) return { status: 400, message: 'ID do usuário é obrigatório' };

    const updates = await ticketRepository.getRecentUpdates(userId, 5);

    // Formatar resposta para o frontend
    const formattedUpdates = updates.map(update => ({
      id: update.id,
      message: update.message,
      type: update.type,
      createdAt: update.createdAt,
      ticket: {
        id: update.ticket?.id,
        description: update.ticket?.description,
        status: update.ticket?.status,
        company: update.ticket?.empresa?.name
      },
      employee: update.employee ? {
        role: update.employee?.role?.roleName
      } : null
    }));

    return { status: 200, updates: formattedUpdates };
  } catch (error) {
    console.error('❌ SERVICE: Erro ao buscar atualizações:', error);
    return { status: 500, message: 'Erro ao buscar atualizações.' };
  }
};