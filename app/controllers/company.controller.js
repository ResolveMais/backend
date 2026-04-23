import companyService from "../services/company.service.js";

const getAll = async (req, res) => {
  try {
    const response = await companyService.getAllCompanies();
    return res.status(response.status).json(response);
  } catch (error) {
    console.error("Error fetching companies: " + error);
    return res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

const getPublicDashboard = async (req, res) => {
  try {
    const response = await companyService.getPublicCompanyDashboard(req.params.companyId);
    return res.status(response.status).json(response);
  } catch (error) {
    console.error("Error fetching public company dashboard: " + error);
    return res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

const getMyCompanyAdmins = async (req, res) => {
  try {
    const response = await companyService.getMyCompanyAdmins(req.user.id);
    return res.status(response.status).json(response);
  } catch (error) {
    console.error("Error fetching company admins: " + error);
    return res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

const getMyCompanyEmployees = async (req, res) => {
  try {
    const response = await companyService.getMyCompanyEmployees(req.user.id);
    return res.status(response.status).json(response);
  } catch (error) {
    console.error("Error fetching company employees: " + error);
    return res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

const getMyCompanyComplaintTitles = async (req, res) => {
  try {
    const response = await companyService.getMyCompanyComplaintTitles(req.user.id);
    return res.status(response.status).json(response);
  } catch (error) {
    console.error("Error fetching company complaint titles: " + error);
    return res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

const updateMyCompanyProfile = async (req, res) => {
  try {
    const response = await companyService.updateMyCompanyProfile(req.user.id, req.body || {});
    return res.status(response.status).json(response);
  } catch (error) {
    console.error("Error updating company profile: " + error);
    return res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

const addMyCompanyComplaintTitle = async (req, res) => {
  try {
    const response = await companyService.addMyCompanyComplaintTitle(req.user.id, req.body || {});
    return res.status(response.status).json(response);
  } catch (error) {
    console.error("Error adding company complaint title: " + error);
    return res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

const addMyCompanyAdmin = async (req, res) => {
  try {
    const response = await companyService.addMyCompanyAdmin(req.user.id, req.body || {});
    return res.status(response.status).json(response);
  } catch (error) {
    console.error("Error adding company admin: " + error);
    return res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

const addMyCompanyEmployee = async (req, res) => {
  try {
    const response = await companyService.addMyCompanyEmployee(req.user.id, req.body || {});
    return res.status(response.status).json(response);
  } catch (error) {
    console.error("Error adding company employee: " + error);
    return res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

const updateMyCompanyEmployee = async (req, res) => {
  try {
    const response = await companyService.updateMyCompanyEmployee(
      req.user.id,
      req.params.employeeUserId,
      req.body || {}
    );
    return res.status(response.status).json(response);
  } catch (error) {
    console.error("Error updating company employee: " + error);
    return res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

const setMyCompanyPrimaryAdmin = async (req, res) => {
  try {
    const response = await companyService.setMyCompanyPrimaryAdmin(req.user.id, req.params.adminUserId);
    return res.status(response.status).json(response);
  } catch (error) {
    console.error("Error setting company primary admin: " + error);
    return res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

const removeMyCompanyAdmin = async (req, res) => {
  try {
    const response = await companyService.removeMyCompanyAdmin(req.user.id, req.params.adminUserId);
    return res.status(response.status).json(response);
  } catch (error) {
    console.error("Error removing company admin: " + error);
    return res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

const removeMyCompanyEmployee = async (req, res) => {
  try {
    const response = await companyService.removeMyCompanyEmployee(req.user.id, req.params.employeeUserId);
    return res.status(response.status).json(response);
  } catch (error) {
    console.error("Error removing company employee: " + error);
    return res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

const removeMyCompanyComplaintTitle = async (req, res) => {
  try {
    const response = await companyService.removeMyCompanyComplaintTitle(
      req.user.id,
      req.params.complaintTitleId
    );
    return res.status(response.status).json(response);
  } catch (error) {
    console.error("Error removing company complaint title: " + error);
    return res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

export {
  addMyCompanyAdmin,
  addMyCompanyComplaintTitle,
  addMyCompanyEmployee,
  getAll,
  getPublicDashboard,
  getMyCompanyAdmins,
  getMyCompanyComplaintTitles,
  getMyCompanyEmployees,
  removeMyCompanyAdmin,
  removeMyCompanyComplaintTitle,
  removeMyCompanyEmployee,
  setMyCompanyPrimaryAdmin,
  updateMyCompanyEmployee,
  updateMyCompanyProfile,
};

export default {
  getAll,
  getPublicDashboard,
  getMyCompanyAdmins,
  getMyCompanyEmployees,
  getMyCompanyComplaintTitles,
  updateMyCompanyProfile,
  addMyCompanyComplaintTitle,
  addMyCompanyAdmin,
  addMyCompanyEmployee,
  updateMyCompanyEmployee,
  setMyCompanyPrimaryAdmin,
  removeMyCompanyAdmin,
  removeMyCompanyEmployee,
  removeMyCompanyComplaintTitle,
};
