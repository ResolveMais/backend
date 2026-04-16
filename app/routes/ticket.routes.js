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

router.get("/workspace", TicketController.getWorkspace);
router.get("/company-logs", TicketController.getCompanyLogs);
router.get("/message-notifications", TicketController.getUnreadMessageNotifications);

router.get("/:ticketId/detail", TicketController.getTicketDetail);
router.get("/:ticketId/messages", TicketController.getTicketMessages);
router.post("/:ticketId/messages/read", TicketController.markMessagesAsRead);
router.post("/:ticketId/messages", TicketController.sendMessage);
router.post("/:ticketId/accept", TicketController.acceptTicket);
router.patch("/:ticketId/status", TicketController.updateStatus);
router.patch("/:ticketId/assignment", TicketController.updateAssignment);
router.get("/:ticketId/logs", TicketController.getTicketLogs);
router.get("/:ticketId/events/stream", TicketController.streamTicketEvents);

export default { alias: "/api/tickets", router };
