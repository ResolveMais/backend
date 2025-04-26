const { department: Department } = require('../models');
const logger = require('../utils/logger');

exports.getAll = async (req, res) => {
    try {
        const departments = await Department.findAll();
        res.status(200).json(departments);
    } catch (error) {
        logger.error(`Error fetching departments: ${error.message}`);
        res.status(500).json({ message: "Internal server error" });
    }
};

