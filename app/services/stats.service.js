const { 
    ticket: Ticket, 
    user: User,
    department: Department
} = require('../models');

class StatsService {
    static async getSystemStats() {
        const [
            totalTickets,
            openTickets,
            totalUsers,
            totalDepartments
        ] = await Promise.all([
            Ticket.count(),
            Ticket.count({ where: { status: 'open' } }),
            User.count(),
            Department.count()
        ]);

        return {
            totalTickets,
            openTickets,
            resolvedTickets: totalTickets - openTickets,
            totalUsers,
            totalDepartments
        };
    }

    static async getDepartmentStats() {
        return Department.findAll({
            attributes: [
                'id',
                'name',
                [sequelize.fn('COUNT', sequelize.col('tickets.id')), 'ticketCount'],
                [sequelize.literal(`SUM(CASE WHEN tickets.status = 'open' THEN 1 ELSE 0 END)`), 'openTickets']
            ],
            include: [{
                model: Ticket,
                attributes: []
            }],
            group: ['Department.id']
        });
    }
}

module.exports = StatsService;