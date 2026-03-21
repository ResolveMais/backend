const companyService = require('../services/company.service');

exports.getAll = async (req, res) => {
  try {
    const response = await companyService.getAllCompanies();
    return res.status(response.status).json(response);
  } catch (error) {
    console.error('Error fetching companies: ' + error.message);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
};

exports.getMyCompanyAdmins = async (req, res) => {
  try {
    const response = await companyService.getMyCompanyAdmins(req.user.id);
    return res.status(response.status).json(response);
  } catch (error) {
    console.error('Error fetching company admins: ' + error.message);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
};

exports.getMyCompanyEmployees = async (req, res) => {
  try {
    const response = await companyService.getMyCompanyEmployees(req.user.id);
    return res.status(response.status).json(response);
  } catch (error) {
    console.error('Error fetching company employees: ' + error.message);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
};

exports.addMyCompanyAdmin = async (req, res) => {
  try {
    const response = await companyService.addMyCompanyAdmin(req.user.id, req.body || {});
    return res.status(response.status).json(response);
  } catch (error) {
    console.error('Error adding company admin: ' + error.message);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
};

exports.addMyCompanyEmployee = async (req, res) => {
  try {
    const response = await companyService.addMyCompanyEmployee(req.user.id, req.body || {});
    return res.status(response.status).json(response);
  } catch (error) {
    console.error('Error adding company employee: ' + error.message);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
};

exports.setMyCompanyPrimaryAdmin = async (req, res) => {
  try {
    const response = await companyService.setMyCompanyPrimaryAdmin(req.user.id, req.params.adminUserId);
    return res.status(response.status).json(response);
  } catch (error) {
    console.error('Error setting company primary admin: ' + error.message);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
};

exports.removeMyCompanyAdmin = async (req, res) => {
  try {
    const response = await companyService.removeMyCompanyAdmin(req.user.id, req.params.adminUserId);
    return res.status(response.status).json(response);
  } catch (error) {
    console.error('Error removing company admin: ' + error.message);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
};

exports.removeMyCompanyEmployee = async (req, res) => {
  try {
    const response = await companyService.removeMyCompanyEmployee(req.user.id, req.params.employeeUserId);
    return res.status(response.status).json(response);
  } catch (error) {
    console.error('Error removing company employee: ' + error.message);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
};
