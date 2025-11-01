const ticketRepository = require('../repositories/ticket.repository');
const companyRepository = require('../repositories/company.repository');

exports.createTicket = async ({ description, userId, companyId, complaintTitleId }) => {
    try {
        console.log('🔧 ========== SERVICE: CRIANDO TICKET ==========');
        console.log('📦 Dados recebidos no service:', { 
            description: description?.substring(0, 50) + '...', 
            userId, 
            companyId, 
            complaintTitleId 
        });

        // Validações detalhadas
        console.log('🔍 Validando dados no service...');
        
        if (!description || !description.trim()) {
            console.log('❌ SERVICE: Descrição vazia');
            return { status: 400, message: 'Descrição é obrigatória' };
        }
        
        if (!userId) {
            console.log('❌ SERVICE: User ID vazio');
            return { status: 400, message: 'Usuário não autenticado' };
        }
        
        if (!companyId) {
            console.log('❌ SERVICE: Company ID vazio');
            return { status: 400, message: 'Empresa é obrigatória' };
        }
        
        if (!complaintTitleId) {
            console.log('❌ SERVICE: Complaint Title ID vazio');
            return { status: 400, message: 'Assunto é obrigatório' };
        }

        console.log('✅ SERVICE: Todas validações passaram');
        console.log('💾 SERVICE: Chamando repository...');

        const newTicket = await ticketRepository.create({
            description: description.trim(),
            userId,
            companyId, 
            complaintTitleId
        });

        console.log('✅ SERVICE: Ticket criado com sucesso no repository');
        console.log('📄 SERVICE: Ticket criado:', newTicket.toJSON ? newTicket.toJSON() : newTicket);
        
        return {
            status: 201,
            message: 'Ticket criado com sucesso',
            ticket: newTicket
        };
    } catch (error) {
        console.error('💥 ========== ERRO NO SERVICE ==========');
        console.error('❌ SERVICE Erro:', error.message);
        console.error('📜 SERVICE Stack trace:', error.stack);
        console.error('🔍 SERVICE Error name:', error.name);
        
        if (error.name === 'SequelizeValidationError') {
            console.error('❌ SERVICE: Erros de validação:', error.errors);
        }
        if (error.name === 'SequelizeForeignKeyConstraintError') {
            console.error('❌ SERVICE: Erro de chave estrangeira:', error.parent?.detail);
        }
        if (error.name === 'SequelizeDatabaseError') {
            console.error('❌ SERVICE: Erro de banco de dados:', error.parent);
        }
        
        return { 
            status: 500, 
            message: 'Erro ao criar ticket: ' + error.message 
        };
    }
};

exports.getCompanies = async () => {
    try {
        console.log('🏢 SERVICE: Buscando empresas...');
        const companies = await companyRepository.getAll();
        console.log(`✅ SERVICE: ${companies.length} empresas encontradas`);
        return { status: 200, companies };
    } catch (error) {
        console.error('❌ SERVICE: Erro ao buscar empresas:', error);
        return { status: 500, message: 'Erro ao buscar empresas' };
    }
};

exports.getComplaintTitlesByCompany = async (companyId) => {
    try {
        console.log(`📋 SERVICE: Buscando assuntos para empresa ${companyId}...`);
        
        if (!companyId) {
            return { status: 400, message: 'ID da empresa é obrigatório' };
        }

        const complaintTitles = await ticketRepository.getComplaintTitlesByCompany(companyId);
        console.log(`✅ SERVICE: ${complaintTitles.length} assuntos encontrados`);
        
        return {
            status: 200,
            complaintTitles
        };
    } catch (error) {
        console.error('❌ SERVICE: Erro ao buscar assuntos:', error);
        return { status: 500, message: 'Erro ao buscar assuntos' };
    }
};

exports.getUserTickets = async (userId) => {
    try {
        console.log(`🎫 SERVICE: Buscando tickets do usuário ${userId}...`);
        
        if (!userId) {
            return { status: 400, message: 'ID do usuário é obrigatório' };
        }

        const tickets = await ticketRepository.getByUserId(userId);
        console.log(`✅ SERVICE: ${tickets.length} tickets encontrados`);
        
        return {
            status: 200,
            tickets
        };
    } catch (error) {
        console.error('❌ SERVICE: Erro ao buscar tickets:', error);
        return { status: 500, message: 'Erro ao buscar tickets' };
    }
};