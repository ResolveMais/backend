const { sequelize } = require('../models');
const logger = require('../utils/logger');

exports.checkStatus = async (req, res) => {
    try {
        // Testar conexão com o banco
        await sequelize.authenticate();
        
        res.status(200).json({
            status: 'UP',
            database: 'CONNECTED',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error(`Health check failed: ${error.message}`);
        res.status(503).json({
            status: 'DOWN',
            database: 'DISCONNECTED',
            error: error.message
        });
    }
};