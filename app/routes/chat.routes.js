const express = require('express');
const router = express.Router();
const ChatController = require('../controllers/chat.controller');
const authMiddleware = require('../middlewares/auth');

router.get('/ticket/:ticketId', authMiddleware, ChatController.getMessages);
router.post('/ticket/:ticketId', authMiddleware, ChatController.sendMessage);

module.exports = { alias: "/chat", router };

