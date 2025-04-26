const StatsService = require('../services/stats.service');
const logger = require('../utils/logger');

exports.getSystemStats = async (req, res) => {
    try {
        const stats = await StatsService.getSystemStats();
        res.status(200).json(stats);
    } catch (error) {
        logger.error(`erro ao obter estatisticas do sistema: ${error.message}`);
        res.status(500).json({ message: 'erro ao obter estatisticas' });
    }
};

exports.getDepartmentStats = async (req, res) => {
    try {
        const stats = await StatsService.getDepartmentStats();
        res.status(200).json(stats);
    } catch (error) {
        logger.error(`Erro ao obter estatistica do departamentp: ${error.message}`);
        res.status(500).json({ message: 'erro ao obter estatisticas' });
    }
};