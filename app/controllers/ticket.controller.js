const ticketService = require('../services/ticket.service');

exports.create = async (req, res) => {
    try {
        console.log('🎫 ========== INICIANDO CRIAÇÃO DE TICKET ==========');
        console.log('📝 Dados recebidos no controller:', req.body);
        console.log('👤 User ID do token:', req.user?.id);

        const { description, companyId, complaintTitleId } = req.body;
        const userId = req.user.id;

        if (!description || !description.trim()) {
            return res.status(400).json({ status: 400, message: 'Descrição é obrigatória' });
        }

        if (!companyId) {
            return res.status(400).json({ status: 400, message: 'Empresa é obrigatória' });
        }

        if (!complaintTitleId) {
            return res.status(400).json({ status: 400, message: 'Assunto é obrigatório' });
        }

        if (!userId) {
            return res.status(401).json({ status: 401, message: 'Usuário não autenticado' });
        }

        const response = await ticketService.createTicket({
            description,
            userId,
            companyId,
            complaintTitleId
        });

        return res.status(response.status).json(response);

    } catch (error) {
        console.error('💥 ========== ERRO NO CONTROLLER ==========');
        console.error('❌ Erro:', error.message);
        
        return res.status(500).json({ 
            status: 500, 
            message: 'Erro interno do servidor: ' + error.message 
        });
    }
};

exports.getCompanies = async (req, res) => {
    try {
        console.log('🏢 Buscando empresas...');
        const response = await ticketService.getCompanies();
        return res.status(response.status).json(response);
    } catch (error) {
        console.error('❌ Erro ao buscar empresas:', error);
        return res.status(500).json({ status: 500, message: 'Erro interno do servidor' });
    }
};

exports.getComplaintTitles = async (req, res) => {
    try {
        const { companyId } = req.params;
        console.log(`📋 Buscando assuntos para empresa ${companyId}...`);
        
        const response = await ticketService.getComplaintTitlesByCompany(companyId);
        return res.status(response.status).json(response);
    } catch (error) {
        console.error('❌ Erro ao buscar assuntos:', error);
        return res.status(500).json({ status: 500, message: 'Erro interno do servidor' });
    }
};

exports.getUserTickets = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`🎫 Buscando tickets do usuário ${userId}...`);
        
        const response = await ticketService.getUserTickets(userId);
        return res.status(response.status).json(response);
    } catch (error) {
        console.error('❌ Erro ao buscar tickets:', error);
        return res.status(500).json({ status: 500, message: 'Erro interno do servidor' });
    }
};

exports.getUserPendingTickets = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`🎫 Buscando tickets PENDENTES do usuário ${userId}...`);
        
        const response = await ticketService.getUserPendingTickets(userId);
        return res.status(response.status).json(response);
    } catch (error) {
        console.error('❌ Erro ao buscar tickets pendentes:', error);
        return res.status(500).json({ status: 500, message: 'Erro interno do servidor' });
    }
};

// ✅ NOVO CONTROLLER: Buscar tickets abertos e pendentes
exports.getUserOpenAndPendingTickets = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`🎫 Buscando tickets ABERTOS E PENDENTES do usuário ${userId}...`);
        
        const response = await ticketService.getUserOpenAndPendingTickets(userId);
        console.log(`✅ ${response.tickets?.length || 0} tickets abertos/pendentes encontrados`);
        
        return res.status(response.status).json(response);
    } catch (error) {
        console.error('❌ Erro ao buscar tickets abertos/pendentes:', error);
        return res.status(500).json({ status: 500, message: 'Erro interno do servidor' });
    }
};

exports.getRecentUpdates = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`🔄 Buscando últimas atualizações do usuário ${userId}...`);
        
        const response = await ticketService.getRecentUpdates(userId);
        return res.status(response.status).json(response);
    } catch (error) {
        console.error('❌ Erro ao buscar atualizações:', error);
        return res.status(500).json({ status: 500, message: 'Erro interno do servidor' });
    }
};