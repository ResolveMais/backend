const ticketService = require('../services/ticket.service');

exports.create = async (req, res) => {
    try {
        console.log('🎫 ========== INICIANDO CRIAÇÃO DE TICKET ==========');
        console.log('📝 Dados recebidos no controller:', req.body);
        console.log('👤 User ID do token:', req.user?.id);
        console.log('🔑 User object completo:', req.user);

        const { description, companyId, complaintTitleId } = req.body;
        const userId = req.user.id;

        // Validações detalhadas
        console.log('🔍 Validando dados...');
        
        if (!description || !description.trim()) {
            console.log('❌ VALIDAÇÃO FALHOU: Descrição vazia');
            return res.status(400).json({ status: 400, message: 'Descrição é obrigatória' });
        }

        if (!companyId) {
            console.log('❌ VALIDAÇÃO FALHOU: Company ID vazio');
            return res.status(400).json({ status: 400, message: 'Empresa é obrigatória' });
        }

        if (!complaintTitleId) {
            console.log('❌ VALIDAÇÃO FALHOU: Complaint Title ID vazio');
            return res.status(400).json({ status: 400, message: 'Assunto é obrigatório' });
        }

        if (!userId) {
            console.log('❌ VALIDAÇÃO FALHOU: User ID não encontrado');
            return res.status(401).json({ status: 401, message: 'Usuário não autenticado' });
        }

        console.log('✅ Todas validações passaram');
        console.log('🚀 Chamando service...');

        const response = await ticketService.createTicket({
            description,
            userId,
            companyId,
            complaintTitleId
        });

        console.log('✅ Ticket criado com sucesso no service:', response);
        console.log('🎉 ========== TICKET CRIADO COM SUCESSO ==========');
        
        return res.status(response.status).json(response);

    } catch (error) {
        console.error('💥 ========== ERRO NO CONTROLLER ==========');
        console.error('❌ Erro:', error.message);
        console.error('📜 Stack trace:', error.stack);
        console.error('🔍 Error name:', error.name);
        console.error('📄 Error details:', error);
        
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
        console.log(`✅ ${response.companies?.length || 0} empresas encontradas`);
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
        console.log(`✅ ${response.complaintTitles?.length || 0} assuntos encontrados`);
        
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
        console.log(`✅ ${response.tickets?.length || 0} tickets encontrados`);
        
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
        console.log(`✅ ${response.tickets?.length || 0} tickets PENDENTES encontrados`);
        
        return res.status(response.status).json(response);
    } catch (error) {
        console.error('❌ Erro ao buscar tickets pendentes:', error);
        return res.status(500).json({ status: 500, message: 'Erro interno do servidor' });
    }
};