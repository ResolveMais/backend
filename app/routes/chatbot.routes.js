const router = require("express").Router();

const chatbotController = require("../controllers/chatbot.controller");
const authMiddleware = require("../middlewares/auth.middleware");

router.use(authMiddleware);

router.get("/conversation", chatbotController.getConversation);
router.post("/conversation/clear", chatbotController.clearConversation);
router.post("/message/stream", chatbotController.streamMessage);

module.exports = { alias: "/api/chatbot", router };
