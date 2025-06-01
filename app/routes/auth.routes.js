const router = require('express').Router();

const AuthController = require('../controllers/auth.controller.js');

router.post("/login", AuthController.login);
router.post("/register", AuthController.register);

module.exports = { alias: "/api/auth", router };