import express from "express";
import AuthController from "../controllers/auth.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/login", AuthController.login);
router.post("/register", AuthController.register);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/reset-password", AuthController.resetPassword);
router.post("/reset-password/validate", AuthController.validateResetToken);
router.get("/me", authMiddleware, AuthController.validateToken);

export default { alias: "/api/auth", router };
