const ChatService = require('../services/chat.service');
const logger = require('../utils/logger');

exports.getMessages = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const messages = await ChatService.getMessages(ticketId);
        res.status(200).json(messages);
    } catch (error) {
        logger.error(`Error getting messages: ${error.message}`);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const message = await ChatService.sendMessage(ticketId, {
            content: req.body.content,
            userId: req.userData.id
        });
        res.status(201).json(message);
    } catch (error) {
        logger.error(`Error sending message: ${error.message}`);
        res.status(500).json({ message: 'Internal server error' });
    }
};