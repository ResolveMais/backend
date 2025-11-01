const { Ticket: TicketModel, Company, ComplaintTitle, User } = require('../models');

module.exports = {
    create: async ({ description, userId, companyId, complaintTitleId }) => {
        try {
            console.log('💽 ========== REPOSITORY: CRIANDO TICKET ==========');
            console.log('📊 Dados para criação:', { 
                description: description?.substring(0, 50) + '...', 
                userId, 
                companyId, 
                complaintTitleId 
            });

            // Verificar se as foreign keys existem
            console.log('🔍 REPOSITORY: Verificando existência das entidades...');
            
            const userExists = await User.findByPk(userId);
            const companyExists = await Company.findByPk(companyId);
            const complaintTitleExists = await ComplaintTitle.findByPk(complaintTitleId);

            console.log('👤 REPOSITORY: User exists:', !!userExists, `(ID: ${userId})`);
            console.log('🏢 REPOSITORY: Company exists:', !!companyExists, `(ID: ${companyId})`);
            console.log('📋 REPOSITORY: ComplaintTitle exists:', !!complaintTitleExists, `(ID: ${complaintTitleId})`);

            if (!userExists) {
                throw new Error(`Usuário com ID ${userId} não encontrado`);
            }
            if (!companyExists) {
                throw new Error(`Empresa com ID ${companyId} não encontrada`);
            }
            if (!complaintTitleExists) {
                throw new Error(`Assunto com ID ${complaintTitleId} não encontrado`);
            }

            console.log('✅ REPOSITORY: Todas as entidades existem');
            console.log('💾 REPOSITORY: Criando ticket no banco...');

            const newTicket = await TicketModel.create({
                description,
                user_id: userId,
                company_id: companyId,
                complaintTitle_id: complaintTitleId,
                status: 'aberto'
            });

            const ticketData = newTicket.toJSON();
            console.log('✅ REPOSITORY: Ticket criado com sucesso no banco');
            console.log('📄 REPOSITORY: Ticket criado:', ticketData);
            
            return newTicket;

        } catch (error) {
            console.error('💥 ========== ERRO NO REPOSITORY ==========');
            console.error('❌ REPOSITORY Erro:', error.message);
            console.error('📜 REPOSITORY Stack trace:', error.stack);
            console.error('🔍 REPOSITORY Error name:', error.name);
            
            // Log detalhado para erros do Sequelize
            if (error.name === 'SequelizeValidationError') {
                console.error('❌ REPOSITORY: Erros de validação:');
                error.errors.forEach((err, index) => {
                    console.error(`   ${index + 1}. Campo: ${err.path}, Valor: ${err.value}, Mensagem: ${err.message}`);
                });
            }
            
            if (error.name === 'SequelizeForeignKeyConstraintError') {
                console.error('❌ REPOSITORY: Erro de chave estrangeira:');
                console.error('   Tabela:', error.table);
                console.error('   Detalhes:', error.parent?.detail);
                console.error('   SQL:', error.parent?.sql);
            }
            
            if (error.name === 'SequelizeDatabaseError') {
                console.error('❌ REPOSITORY: Erro de banco de dados:');
                console.error('   Código:', error.parent?.code);
                console.error('   Mensagem:', error.parent?.message);
                console.error('   SQL:', error.parent?.sql);
            }
            
            if (error.name === 'SequelizeUniqueConstraintError') {
                console.error('❌ REPOSITORY: Erro de unique constraint:');
                console.error('   Campos:', error.fields);
            }
            
            throw error;
        }
    },

    getComplaintTitlesByCompany: async (companyId) => {
        try {
            console.log(`📋 REPOSITORY: Buscando assuntos para empresa ${companyId}...`);
            
            const complaintTitles = await ComplaintTitle.findAll({
                where: { company_id: companyId },
                attributes: ['id', 'title', 'description'],
                include: [{
                    model: Company,
                    as: 'empresa',
                    attributes: ['id', 'name']
                }]
            });

            console.log(`✅ REPOSITORY: ${complaintTitles.length} assuntos encontrados`);
            return complaintTitles;
        } catch (error) {
            console.error('❌ REPOSITORY: Erro ao buscar assuntos:', error);
            throw error;
        }
    },

    getByUserId: async (userId) => {
        try {
            console.log(`🎫 REPOSITORY: Buscando tickets do usuário ${userId}...`);
            
            const tickets = await TicketModel.findAll({
                where: { user_id: userId },
                include: [
                    {
                        model: Company,
                        as: 'empresa',
                        attributes: ['id', 'name']
                    },
                    {
                        model: ComplaintTitle,
                        as: 'tituloReclamacao',
                        attributes: ['id', 'title']
                    }
                ],
                order: [['createdAt', 'DESC']]
            });

            console.log(`✅ REPOSITORY: ${tickets.length} tickets encontrados`);
            return tickets;
        } catch (error) {
            console.error('❌ REPOSITORY: Erro ao buscar tickets:', error);
            throw error;
        }
    }
};