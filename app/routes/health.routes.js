const express = require('express');
const router = express.Router();
const HealthController = require('../controllers/health.controller');

router.get('/status', HealthController.checkStatus);

module.exports = { alias: "/health", router };