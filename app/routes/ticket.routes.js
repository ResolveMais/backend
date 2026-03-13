const express = require('express');
const router = express.Router();

const TicketController = require('../controllers/ticket.controller.js');
const authMiddleware = require('../middlewares/auth.middleware.js');

router.use(authMiddleware);

router.get("/companies", TicketController.getCompanies);
router.get("/complaint-titles/:companyId", TicketController.getComplaintTitles);
router.get("/my-tickets", TicketController.getUserTickets);
router.post("/create", TicketController.create);
router.get("/user-closed-tickets", TicketController.getUserClosedTickets);
router.get("/user-open-pending-tickets", TicketController.getUserOpenAndPendingTickets);
router.get("/recent-updates", TicketController.getRecentUpdates);

module.exports = { alias: "/api/tickets", router };