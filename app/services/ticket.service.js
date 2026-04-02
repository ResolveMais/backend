import companyRepository from "../repositories/company.repository.js";
import ticketRepository from "../repositories/ticket.repository.js";

const createTicket = async ({ description, userId, companyId, complaintTitleId }) => {
  try {
    console.log("Service: creating ticket...");
    if (!description?.trim()) return { status: 400, message: "Descrição é obrigatória" };
    if (!userId) return { status: 400, message: "Usuário não autenticado" };
    if (!companyId) return { status: 400, message: "Empresa é obrigatória" };
    if (!complaintTitleId) return { status: 400, message: "Assunto é obrigatório" };

    const newTicket = await ticketRepository.create({
      description: description.trim(),
      userId,
      companyId,
      complaintTitleId,
    });

    return {
      status: 201,
      message: "Ticket criado com sucesso",
      ticket: {
        id: newTicket.id,
        descricao: newTicket.description,
        status: newTicket.status,
        criadoEm: newTicket.createdAt,
      },
    };
  } catch (error) {
    console.error("Erro ao criar ticket:", error);
    return { status: 500, message: "Erro interno ao criar ticket. Tente novamente mais tarde." };
  }
};

const getCompanies = async () => {
  try {
    console.log("Service: fetching companies...");
    const companies = await companyRepository.getAll();
    return { status: 200, companies };
  } catch (error) {
    console.error("Erro ao buscar empresas:", error);
    return { status: 500, message: "Erro ao buscar empresas." };
  }
};

const getComplaintTitlesByCompany = async (companyId) => {
  try {
    if (!companyId) return { status: 400, message: "ID da empresa é obrigatório" };
    const complaintTitles = await ticketRepository.getComplaintTitlesByCompany(companyId);
    return { status: 200, complaintTitles };
  } catch (error) {
    console.error("Erro ao buscar assuntos:", error);
    return { status: 500, message: "Erro ao buscar assuntos." };
  }
};

const getUserTickets = async (userId) => {
  try {
    if (!userId) return { status: 400, message: "ID do usuário é obrigatório" };

    const tickets = await ticketRepository.getByUserId(userId);

    const sanitized = tickets.map((t) => ({
      id: t.id,
      empresa: t.empresa?.name || "Empresa não informada",
      tituloReclamacao: t.tituloReclamacao?.title || "Sem título",
      descricao: t.description,
      status: t.status,
      criadoEm: t.createdAt,
    }));

    return { status: 200, tickets: sanitized };
  } catch (error) {
    console.error("Erro ao buscar tickets:", error);
    return { status: 500, message: "Erro ao buscar tickets." };
  }
};

const getUserOpenAndPendingTickets = async (userId) => {
  try {
    if (!userId) return { status: 400, message: "ID do usuário é obrigatório" };

    const tickets = await ticketRepository.getOpenAndPendingByUserId(userId);

    const sanitized = tickets.map((t) => ({
      id: t.id,
      empresa: t.empresa?.name || "Empresa não informada",
      tituloReclamacao: t.tituloReclamacao?.title || "Sem título",
      descricao: t.description,
      status: t.status,
      criadoEm: t.createdAt,
    }));

    return { status: 200, tickets: sanitized };
  } catch (error) {
    console.error("Erro ao buscar tickets abertos/pendentes:", error);
    return { status: 500, message: "Erro ao buscar tickets." };
  }
};

const getUserClosedTickets = async (userId) => {
  try {
    if (!userId) return { status: 400, message: "ID do usuário é obrigatório" };

    const tickets = await ticketRepository.getClosedByUserId(userId);

    const sanitized = tickets.map((t) => ({
      id: t.id,
      empresa: t.empresa?.name || "Empresa não informada",
      tituloReclamacao: t.tituloReclamacao?.title || "Sem título",
      descricao: t.description,
      status: t.status,
      criadoEm: t.createdAt,
      finalizadoEm: t.updatedAt,
    }));

    return { status: 200, tickets: sanitized };
  } catch (error) {
    console.error("Erro ao buscar tickets finalizados:", error);
    return { status: 500, message: "Erro ao buscar tickets finalizados." };
  }
};

const getRecentUpdates = async (userId) => {
  try {
    if (!userId) return { status: 400, message: "ID do usuário é obrigatório" };

    const updates = await ticketRepository.getRecentUpdates(userId, 3);

    const formattedUpdates = updates.map((update) => ({
      id: update.id,
      message: update.message,
      type: update.type,
      createdAt: update.createdAt,
      ticket: {
        id: update.ticket?.id,
        description: update.ticket?.description,
        status: update.ticket?.status,
        company: update.ticket?.empresa?.name,
      },
      employee: update.employee
        ? {
          role: update.employee?.role?.roleName,
        }
        : null,
    }));

    return { status: 200, updates: formattedUpdates };
  } catch (error) {
    console.error("Erro ao buscar atualizações:", error);
    return { status: 500, message: "Erro ao buscar atualizações." };
  }
};

export {
  createTicket,
  getCompanies,
  getComplaintTitlesByCompany,
  getRecentUpdates,
  getUserClosedTickets,
  getUserOpenAndPendingTickets,
  getUserTickets,
};

export default {
  createTicket,
  getCompanies,
  getComplaintTitlesByCompany,
  getUserTickets,
  getUserOpenAndPendingTickets,
  getUserClosedTickets,
  getRecentUpdates,
};
