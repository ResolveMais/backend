const express = require('express');
const router = express.Router();

const UserController = require('../controllers/user.controller.js');
const authMiddleware = require('../middlewares/auth.middleware.js');

router.patch("/update-profile", authMiddleware, UserController.updateProfile);

module.exports = { alias: "/api/users", router };