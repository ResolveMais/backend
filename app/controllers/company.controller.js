const companyService = require('../services/company.service');

exports.getAll = async (req, res) => {
  try {
    const response = await companyService.getAllCompanies();
    return res.status(response.status).json(response);
  } catch (error) {
    console.error('Error fetching companies: ' + error);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
};

exports.getMyCompanyAdmins = async (req, res) => {
  try {
    const response = await companyService.getMyCompanyAdmins(req.user.id);
    return res.status(response.status).json(response);
  } catch (error) {
    console.error('Error fetching company admins: ' + error);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
};

exports.getMyCompanyEmployees = async (req, res) => {
  try {
    const response = await companyService.getMyCompanyEmployees(req.user.id);
    return res.status(response.status).json(response);
  } catch (error) {
    console.error('Error fetching company employees: ' + error);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
};

exports.getMyCompanyComplaintTitles = async (req, res) => {
  try {
    const response = await companyService.getMyCompanyComplaintTitles(req.user.id);
    return res.status(response.status).json(response);
  } catch (error) {
    console.error('Error fetching company complaint titles: ' + error);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
};

exports.updateMyCompanyProfile = async (req, res) => {
  try {
    const response = await companyService.updateMyCompanyProfile(req.user.id, req.body || {});
    return res.status(response.status).json(response);
  } catch (error) {
    console.error('Error updating company profile: ' + error);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
};

exports.addMyCompanyComplaintTitle = async (req, res) => {
  try {
    const response = await companyService.addMyCompanyComplaintTitle(req.user.id, req.body || {});
    return res.status(response.status).json(response);
  } catch (error) {
    console.error('Error adding company complaint title: ' + error);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
};

exports.addMyCompanyAdmin = async (req, res) => {
  try {
    const response = await companyService.addMyCompanyAdmin(req.user.id, req.body || {});
    return res.status(response.status).json(response);
  } catch (error) {
    console.error('Error adding company admin: ' + error);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
};

exports.addMyCompanyEmployee = async (req, res) => {
  try {
    const response = await companyService.addMyCompanyEmployee(req.user.id, req.body || {});
    return res.status(response.status).json(response);
  } catch (error) {
    console.error('Error adding company employee: ' + error);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
};

exports.updateMyCompanyEmployee = async (req, res) => {
  try {
    const response = await companyService.updateMyCompanyEmployee(
      req.user.id,
      req.params.employeeUserId,
      req.body || {}
    );
    return res.status(response.status).json(response);
  } catch (error) {
    console.error('Error updating company employee: ' + error);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
};

exports.setMyCompanyPrimaryAdmin = async (req, res) => {
  try {
    const response = await companyService.setMyCompanyPrimaryAdmin(req.user.id, req.params.adminUserId);
    return res.status(response.status).json(response);
  } catch (error) {
    console.error('Error setting company primary admin: ' + error);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
};

exports.removeMyCompanyAdmin = async (req, res) => {
  try {
    const response = await companyService.removeMyCompanyAdmin(req.user.id, req.params.adminUserId);
    return res.status(response.status).json(response);
  } catch (error) {
    console.error('Error removing company admin: ' + error);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
};

exports.removeMyCompanyEmployee = async (req, res) => {
  try {
    const response = await companyService.removeMyCompanyEmployee(req.user.id, req.params.employeeUserId);
    return res.status(response.status).json(response);
  } catch (error) {
    console.error('Error removing company employee: ' + error);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
};

exports.removeMyCompanyComplaintTitle = async (req, res) => {
  try {
    const response = await companyService.removeMyCompanyComplaintTitle(
      req.user.id,
      req.params.complaintTitleId
    );
    return res.status(response.status).json(response);
  } catch (error) {
    console.error('Error removing company complaint title: ' + error);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
};
