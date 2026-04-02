import express from "express";
import TicketController from "../controllers/ticket.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/companies", TicketController.getCompanies);
router.get("/complaint-titles/:companyId", TicketController.getComplaintTitles);
router.get("/my-tickets", TicketController.getUserTickets);
router.post("/create", TicketController.create);
router.get("/user-closed-tickets", TicketController.getUserClosedTickets);
router.get("/user-open-pending-tickets", TicketController.getUserOpenAndPendingTickets);
router.get("/recent-updates", TicketController.getRecentUpdates);

export default { alias: "/api/tickets", router };
