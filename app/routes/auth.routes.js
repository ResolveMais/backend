const router = require('express').Router();

const AuthController = require('../controllers/auth.controller.js');
const authMiddleware = require('../middlewares/auth.middleware.js');

router.post("/login", AuthController.login);
router.post("/register", AuthController.register);
router.get("/me", authMiddleware, AuthController.validateToken);

module.exports = { alias: "/api/auth", router };