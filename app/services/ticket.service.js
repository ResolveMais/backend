const { ticket: Ticket, user: User } = require('../models');
const NotificationService = require('./notification.service');
const logger = require('../utils/logger');

class TicketService {
    static async create(ticketData) {
        const ticket = await Ticket.create(ticketData);
        
        // Notificar administradores
        const admins = await User.findAll({ where: { role: 'admin' } });
        await Promise.all(admins.map(admin => 
            NotificationService.sendEmail(
                admin.email,
                'Novo Ticket Criado',
                `Um novo ticket foi criado: ${ticket.title}`
            )
        ));
        
        return ticket;
    }

    static async assignTicket(ticketId, agentId) {
        const ticket = await Ticket.findByPk(ticketId);
        ticket.agentId = agentId;
        ticket.status = 'in_progress';
        await ticket.save();
        
        // Notificar agente
        const agent = await User.findByPk(agentId);
        await NotificationService.sendEmail(
            agent.email,
            'Novo Ticket Atribuído',
            `Você foi designado para o ticket: ${ticket.title}`
        );
        
        return ticket;
    }
}

module.exports = TicketService;