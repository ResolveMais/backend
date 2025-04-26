const socketIO = require('socket.io');

class SocketService {
    constructor(server) {
        this.io = socketIO(server, {
            cors: {
                origin: process.env.FRONTEND_URL,
                methods: ["GET", "POST"]
            }
        });
        this.setupEvents();
    }

    setupEvents() {
        this.io.on('connection', (socket) => {
            logger.info(`New client connected: ${socket.id}`);

            // Eventos de Ticket
            socket.on('ticketUpdated', (data) => {
                this.io.emit('ticketStatusChanged', data);
            });

            // Eventos de Chat
            socket.on('joinTicketRoom', (ticketId) => {
                socket.join(`ticket_${ticketId}`);
            });
        });
    }

    emitToRoom(room, event, data) {
        this.io.to(room).emit(event, data);
    }

    notifyTicketUpdate(ticket) {
        this.io.emit('ticketUpdated', ticket);
        this.emitToRoom(`ticket_${ticket.id}`, 'ticketStatusChanged', ticket);
    }
}

module.exports = new SocketService();