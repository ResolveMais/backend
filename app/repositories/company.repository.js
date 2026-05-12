import db from "../models/index.js";
import {
  filterAttributesBySchema,
  filterPayloadBySchema,
} from "../utils/dbSchemaCompat.js";

const {
  Company: CompanyModel,
  CompanyAdmin: CompanyAdminModel,
  ComplaintTitle: ComplaintTitleModel,
  Ticket: TicketModel,
  User: UserModel,
} = db;

const publicCompanyAttributes = ["id", "name", "description", "cnpj"];
const adminCompanyAttributes = [
  ...publicCompanyAttributes,
  "aiContext",
  "aiInstructions",
  "aiExamples",
];

const getPublicCompanyAttributes = async () =>
  filterAttributesBySchema(CompanyModel, publicCompanyAttributes);

const getAdminCompanyAttributes = async () =>
  filterAttributesBySchema(CompanyModel, adminCompanyAttributes);

const getAll = async () => {
  try {
    let companies = await CompanyModel.findAll({
      attributes: await getPublicCompanyAttributes(),
    });

    if (!companies || companies.length === 0) companies = [];

    return companies;
  } catch (error) {
    console.error("Error fetching companies: " + error.message);
    throw error;
  }
};

const getById = async (id, options = {}) => {
  const { includeAiSettings = false, ...queryOptions } = options;

  return CompanyModel.findByPk(id, {
    attributes: includeAiSettings
      ? await getAdminCompanyAttributes()
      : await getPublicCompanyAttributes(),
    ...queryOptions,
  });
};

const getByCnpj = async (cnpj, options = {}) =>
  CompanyModel.findOne({
    where: { cnpj },
    attributes: await getPublicCompanyAttributes(),
    ...options,
  });

const getByName = async (name, options = {}) =>
  CompanyModel.findOne({
    where: { name },
    attributes: await getPublicCompanyAttributes(),
    ...options,
  });

const create = async (
  { name, description, cnpj, aiContext = null, aiInstructions = null, aiExamples = null },
  options = {}
) =>
  CompanyModel.create(
    await filterPayloadBySchema(CompanyModel, {
      name,
      description,
      cnpj,
      aiContext,
      aiInstructions,
      aiExamples,
    }),
    options
  );

const update = async (id, payload, options = {}) => {
  const safePayload = await filterPayloadBySchema(CompanyModel, payload);

  if (Object.keys(safePayload).length === 0) {
    return false;
  }

  const [updatedRowsCount] = await CompanyModel.update(safePayload, {
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
        attributes: await getAdminCompanyAttributes(),
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
