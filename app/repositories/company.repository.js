import {
  Company as CompanyModel,
  CompanyAdmin as CompanyAdminModel,
  ComplaintTitle as ComplaintTitleModel,
  Ticket as TicketModel,
  User as UserModel,
} from "../models/index.js";

const getAll = async () => {
  try {
    let companies = await CompanyModel.findAll();

    if (!companies || companies.length === 0) companies = [];

    return companies;
  } catch (error) {
    console.error("Error fetching companies: " + error.message);
    throw error;
  }
};

const getById = async (id, options = {}) => CompanyModel.findByPk(id, options);

const getByCnpj = async (cnpj, options = {}) =>
  CompanyModel.findOne({ where: { cnpj }, ...options });

const getByName = async (name, options = {}) =>
  CompanyModel.findOne({ where: { name }, ...options });

const create = async ({ name, description, cnpj }, options = {}) =>
  CompanyModel.create({ name, description, cnpj }, options);

const update = async (id, payload, options = {}) => {
  const [updatedRowsCount] = await CompanyModel.update(payload, {
    where: { id },
    ...options,
  });

  return updatedRowsCount > 0;
};

const getByAdminUserId = async (userId, options = {}) => {
  const companyAdmin = await CompanyAdminModel.findOne({
    where: { user_id: userId },
    include: [
      {
        model: CompanyModel,
        as: "company",
      },
    ],
    ...options,
  });

  return companyAdmin?.company || null;
};

const listAdmins = async (companyId, options = {}) =>
  CompanyAdminModel.findAll({
    where: { company_id: companyId },
    attributes: ["id", "isPrimary"],
    include: [
      {
        model: UserModel,
        as: "user",
        attributes: ["id", "name", "email", "phone", "cpf", "avatarUrl", "jobTitle", "userType"],
      },
    ],
    order: [["isPrimary", "DESC"], ["id", "ASC"]],
    ...options,
  });

const getAdminLink = async ({ companyId, userId }, options = {}) =>
  CompanyAdminModel.findOne({
    where: {
      company_id: companyId,
      user_id: userId,
    },
    ...options,
  });

const addAdminLink = async ({ companyId, userId, isPrimary = false }, options = {}) =>
  CompanyAdminModel.create(
    {
      company_id: companyId,
      user_id: userId,
      isPrimary,
    },
    options
  );

const clearPrimaryAdmin = async (companyId, options = {}) =>
  CompanyAdminModel.update(
    { isPrimary: false },
    {
      where: { company_id: companyId },
      ...options,
    }
  );

const setPrimaryAdmin = async ({ companyId, userId }, options = {}) =>
  CompanyAdminModel.update(
    { isPrimary: true },
    {
      where: {
        company_id: companyId,
        user_id: userId,
      },
      ...options,
    }
  );

const countAdmins = async (companyId, options = {}) =>
  CompanyAdminModel.count({
    where: { company_id: companyId },
    ...options,
  });

const removeAdminLink = async ({ companyId, userId }, options = {}) =>
  CompanyAdminModel.destroy({
    where: {
      company_id: companyId,
      user_id: userId,
    },
    ...options,
  });

const listComplaintTitles = async (companyId, options = {}) =>
  ComplaintTitleModel.findAll({
    where: { company_id: companyId },
    attributes: ["id", "title", "description"],
    order: [["title", "ASC"], ["id", "ASC"]],
    ...options,
  });

const getComplaintTitleById = async (complaintTitleId, options = {}) => ComplaintTitleModel.findByPk(complaintTitleId, options);

const createComplaintTitle = async (
  { companyId, title, description = null },
  options = {}
) =>
  ComplaintTitleModel.create(
    {
      company_id: companyId,
      title,
      description,
    },
    options
  );

const countTicketsByComplaintTitle = async ({ companyId, complaintTitleId }, options = {}) =>
  TicketModel.count({
    where: {
      company_id: companyId,
      complaintTitle_id: complaintTitleId,
    },
    ...options,
  });

const removeComplaintTitle = async ({ companyId, complaintTitleId }, options = {}) =>
  ComplaintTitleModel.destroy({
    where: {
      id: complaintTitleId,
      company_id: companyId,
    },
    ...options,
  });

export {
  addAdminLink,
  clearPrimaryAdmin,
  countAdmins,
  countTicketsByComplaintTitle,
  create,
  createComplaintTitle,
  getAdminLink,
  getAll,
  getByAdminUserId,
  getByCnpj,
  getById,
  getByName,
  getComplaintTitleById,
  listAdmins,
  listComplaintTitles,
  removeAdminLink,
  removeComplaintTitle,
  setPrimaryAdmin,
  update,
};

export default {
  getAll,
  getById,
  getByCnpj,
  getByName,
  create,
  update,
  getByAdminUserId,
  listAdmins,
  getAdminLink,
  addAdminLink,
  clearPrimaryAdmin,
  setPrimaryAdmin,
  countAdmins,
  removeAdminLink,
  listComplaintTitles,
  getComplaintTitleById,
  createComplaintTitle,
  countTicketsByComplaintTitle,
  removeComplaintTitle,
};
