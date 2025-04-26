const { department: Department, user: User, ticket: Ticket } = require('../../app/models');
const bcrypt = require('bcryptjs');

module.exports = async () => {
    try {
        console.log('Creating departments...');
        const departments = await Department.bulkCreate([
            { name: 'Suporte Técnico', description: 'Atendimento técnico' },
            { name: 'Financeiro', description: 'Cobrança e pagamentos' },
            { name: 'Vendas', description: 'Pré-venda e comercial' }
        ]);

        console.log('Creating admin user...');
        await User.create({
            name: 'Admin',
            email: 'admin@sac.com',
            password: bcrypt.hashSync('admin123', 10),
            role: 'admin',
            departmentId: departments[0].id
        });

        console.log('Creating sample tickets...');
        await Ticket.bulkCreate([
            {
                title: 'Problema com login',
                description: 'Não consigo acessar minha conta',
                status: 'open',
                priority: 'high'
            },
            {
                title: 'Dúvida sobre fatura',
                description: 'Preciso de explicação sobre cobrança',
                status: 'open',
                priority: 'medium',
                departmentId: departments[1].id
            }
        ]);

        console.log('Database seeded successfully!');
    } catch (error) {
        console.error('Error in seed data:', error);
        throw error;
    }
};