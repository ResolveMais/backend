import ticketService from "../services/ticket.service.js";

const create = async (req, res) => {
  try {
    console.log("Starting ticket creation");
    console.log("Payload received in controller:", req.body);
    console.log("User ID from token:", req.user?.id);

    const { description, companyId, complaintTitleId } = req.body;
    const userId = req.user.id;

    if (!description || !description.trim()) {
      return res.status(400).json({ status: 400, message: "Descrição é obrigatória" });
    }

    if (!companyId) {
      return res.status(400).json({ status: 400, message: "Empresa é obrigatória" });
    }

    if (!complaintTitleId) {
      return res.status(400).json({ status: 400, message: "Assunto é obrigatório" });
    }

    if (!userId) {
      return res.status(401).json({ status: 401, message: "Usuário não autenticado" });
    }

    const response = await ticketService.createTicket({
      description,
      userId,
      companyId,
      complaintTitleId,
    });

    return res.status(response.status).json(response);
  } catch (error) {
    console.error("Controller error:", error.message);

    return res.status(500).json({
      status: 500,
      message: "Erro interno do servidor: " + error.message,
    });
  }
};

const getCompanies = async (req, res) => {
  try {
    console.log("Fetching companies...");
    const response = await ticketService.getCompanies();
    return res.status(response.status).json(response);
  } catch (error) {
    console.error("Erro ao buscar empresas:", error);
    return res.status(500).json({ status: 500, message: "Erro interno do servidor" });
  }
};

const getComplaintTitles = async (req, res) => {
  try {
    const { companyId } = req.params;
    console.log(`Buscando assuntos para empresa ${companyId}...`);

    const response = await ticketService.getComplaintTitlesByCompany(companyId);
    return res.status(response.status).json(response);
  } catch (error) {
    console.error("Erro ao buscar assuntos:", error);
    return res.status(500).json({ status: 500, message: "Erro interno do servidor" });
  }
};

const getUserTickets = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`Buscando tickets do usuario ${userId}...`);

    const response = await ticketService.getUserTickets(userId);
    return res.status(response.status).json(response);
  } catch (error) {
    console.error("Erro ao buscar tickets:", error);
    return res.status(500).json({ status: 500, message: "Erro interno do servidor" });
  }
};

const getUserClosedTickets = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`Buscando tickets pendentes do usuario ${userId}...`);

    const response = await ticketService.getUserClosedTickets(userId);
    return res.status(response.status).json(response);
  } catch (error) {
    console.error("Erro ao buscar tickets finalizados:", error);
    return res.status(500).json({ status: 500, message: "Erro interno do servidor" });
  }
};

const getUserOpenAndPendingTickets = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`Buscando tickets abertos e pendentes do usuario ${userId}...`);

    const response = await ticketService.getUserOpenAndPendingTickets(userId);
    console.log(`${response.tickets?.length || 0} tickets abertos/pendentes encontrados`);

    return res.status(response.status).json(response);
  } catch (error) {
    console.error("Erro ao buscar tickets abertos/pendentes:", error);
    return res.status(500).json({ status: 500, message: "Erro interno do servidor" });
  }
};

const getRecentUpdates = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`Buscando ultimas atualizacoes do usuario ${userId}...`);

    const response = await ticketService.getRecentUpdates(userId);
    return res.status(response.status).json(response);
  } catch (error) {
    console.error("Erro ao buscar atualizacoes:", error);
    return res.status(500).json({ status: 500, message: "Erro interno do servidor" });
  }
};

export {
  create,
  getCompanies,
  getComplaintTitles,
  getRecentUpdates,
  getUserClosedTickets,
  getUserOpenAndPendingTickets,
  getUserTickets,
};

export default {
  create,
  getCompanies,
  getComplaintTitles,
  getUserTickets,
  getUserClosedTickets,
  getUserOpenAndPendingTickets,
  getRecentUpdates,
};
