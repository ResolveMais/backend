const router = require('express').Router();

const AuthController = require('../controllers/auth.controller.js');

router.post("/login", AuthController.login);

module.exports = { alias: "/auth", router };