const express = require(`express`);
const router = express.Router();
const TicketController = require(`../middlewares/auth`);
const ticketControllers = require("../controllers/ticket.controllers");

router.get("/", authMiddleware, TicketController.getAll);
router.post("/", authMiddleware, ticketControllers.create);
router.get("/:id", authMiddleware, ticketControllers, getById);
router.put("/:id", authMiddleware, ticketControllers.update);
router.delete("/:id", authMiddleware, ticketControllers.delete);

module.exports = {alias: "/tickets", router};