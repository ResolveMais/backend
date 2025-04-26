const { department: Department } = require('../models');

module.exports = {
    findAll: async () => {
        return await Department.findAll();
    },
   
};