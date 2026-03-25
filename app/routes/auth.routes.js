const router = require('express').Router();

const AuthController = require('../controllers/auth.controller.js');
const authMiddleware = require('../middlewares/auth.middleware.js');

router.post("/login", AuthController.login);
router.post("/register", AuthController.register);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/reset-password", AuthController.resetPassword);
router.post("/reset-password/validate", AuthController.validateResetToken);
router.get("/me", authMiddleware, AuthController.validateToken);

module.exports = { alias: "/api/auth", router };
