const express = require('express');
const router = express.Router();

const TicketController = require('../controllers/ticket.controller.js');
const authMiddleware = require('../middlewares/auth.middleware.js');

// Todas as rotas precisam de autenticação
router.use(authMiddleware);

// Buscar empresas disponíveis
router.get("/companies", TicketController.getCompanies);

// Buscar assuntos por empresa
router.get("/complaint-titles/:companyId", TicketController.getComplaintTitles);

// Buscar tickets do usuário
router.get("/my-tickets", TicketController.getUserTickets);

// Criar novo ticket
router.post("/create", TicketController.create);

module.exports = { alias: "/api/tickets", router };