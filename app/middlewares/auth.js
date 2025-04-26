const AuthService = require('../services/auth.service');
const NotificationService = require('../services/notification.service');
const logger = require('../utils/logger');

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await AuthService.login(email, password);
        
        // Exemplo: Notificar login bem-sucedido
        await NotificationService.sendEmail(
            email,
            'Novo login detectado',
            'Você acabou de fazer login no sistema SAC'
        );
        
        res.status(200).json(result);
    } catch (error) {
        logger.error(`Login error: ${error.message}`);
        res.status(401).json({ message: error.message });
    }
};

exports.register = async (req, res) => {
    try {
        const userData = req.body;
        const result = await AuthService.register(userData);
        res.status(201).json(result);
    } catch (error) {
        logger.error(`Registration error: ${error.message}`);
        res.status(400).json({ message: error.message });
    }
};