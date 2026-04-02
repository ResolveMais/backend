import express from "express";
import CompanyController from "../controllers/company.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/all", CompanyController.getAll);
router.get("/my-company/admins", authMiddleware, CompanyController.getMyCompanyAdmins);
router.get("/my-company/complaint-titles", authMiddleware, CompanyController.getMyCompanyComplaintTitles);
router.patch("/my-company/profile", authMiddleware, CompanyController.updateMyCompanyProfile);
router.post("/my-company/complaint-titles", authMiddleware, CompanyController.addMyCompanyComplaintTitle);
router.post("/my-company/admins", authMiddleware, CompanyController.addMyCompanyAdmin);
router.patch("/my-company/admins/:adminUserId/primary", authMiddleware, CompanyController.setMyCompanyPrimaryAdmin);
router.delete("/my-company/admins/:adminUserId", authMiddleware, CompanyController.removeMyCompanyAdmin);
router.get("/my-company/employees", authMiddleware, CompanyController.getMyCompanyEmployees);
router.post("/my-company/employees", authMiddleware, CompanyController.addMyCompanyEmployee);
router.patch("/my-company/employees/:employeeUserId", authMiddleware, CompanyController.updateMyCompanyEmployee);
router.delete("/my-company/employees/:employeeUserId", authMiddleware, CompanyController.removeMyCompanyEmployee);
router.delete("/my-company/complaint-titles/:complaintTitleId", authMiddleware, CompanyController.removeMyCompanyComplaintTitle);

export default { alias: "/api/companies", router };
