const { company: CompanyModel } = require('../models');

module.exports = {
    getAll: async () => {
        try {
            let companies = await CompanyModel.findAll();

            if (!companies || companies.length === 0) companies = [];

            return companies;
        } catch (error) {
            console.error('Error fetching companies: ' + error.message);
        }
    },
};