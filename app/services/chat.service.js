const { ticket: Ticket, message: Message } = require('../models');
const SocketService = require('./socket.service');
const logger = require('../utils/logger');

class ChatService {
    static async sendMessage(ticketId, messageData) {
        const message = await Message.create({
            ...messageData,
            ticketId
        });

        const ticket = await Ticket.findByPk(ticketId);
        SocketService.emitToRoom(
            `ticket_${ticketId}`,
            'newMessage',
            { ...message.toJSON(), ticketStatus: ticket.status }
        );

        return message;
    }

    static async getMessages(ticketId) {
        return await Message.findAll({
            where: { ticketId },
            order: [['createdAt', 'ASC']]
        });
    }
}

module.exports = ChatService;