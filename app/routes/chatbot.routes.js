import express from "express";
import chatbotController from "../controllers/chatbot.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/conversation", chatbotController.getConversation);
router.post("/conversation/clear", chatbotController.clearConversation);
router.post("/message/stream", chatbotController.streamMessage);

export default { alias: "/api/chatbot", router };
