import express from "express";
import UserController from "../controllers/user.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.patch("/update-profile", authMiddleware, UserController.updateProfile);

export default { alias: "/api/users", router };
