const express = require('express');
const router = express.Router();
const StatsController = require('../controllers/stats.controller');
const authMiddleware = require('../middlewares/auth');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.get(
    '/system',
    authMiddleware,
    roleMiddleware(['admin']),
    StatsController.getSystemStats
);

router.get(
    '/departments',
    authMiddleware,
    StatsController.getDepartmentStats
);

module.exports = { alias: "/stats", router };