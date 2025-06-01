const express = require('express');
const router = express.Router();

const CompanyController = require('../controllers/company.controller.js');

router.get("/all", CompanyController.getAll);

module.exports = { alias: "/api/companies", router };
