const CompanyRepository = require("../repositories/company.repository");

exports.getAll = async (req, res) => {
    try {
        const companies = await CompanyRepository.getAll();

        res.status(200).json({ status: 200, result: companies });
    } catch (error) {
        console.error("Error fetching companies: " + error.message);
        res.status(500).json({ status: 500, message: "Internal server error" });
    }
};