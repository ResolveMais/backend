import { Op } from "sequelize";
import db from "../models/index.js";
const { User: UserModel } = db;

const baseUserAttributes = [
  "id",
  "name",
  "email",
  "userType",
  "cpf",
  "cnpj",
  "phone",
  "avatarUrl",
  "jobTitle",
  "birthDate",
  "companyId",
];

const searchableUserFields = ["name", "email", "jobTitle", "phone", "cpf"];

const buildUserSearchWhere = (search = "") => {
  const normalizedSearch = String(search || "").trim();

  if (!normalizedSearch) return {};

  const searchPattern = `%${normalizedSearch}%`;

  return {
    [Op.or]: searchableUserFields.map((field) => ({
      [field]: {
        [Op.like]: searchPattern,
      },
    })),
  };
};

const create = async (
  {
    name,
    email,
    password,
    userType,
    cpf,
    cnpj,
    phone,
    avatarUrl = null,
    jobTitle = null,
    birthDate,
    companyId = null,
  },
  options = {}
) => {
  try {
    const newUser = await UserModel.create(
      {
        name,
        email,
        password,
        userType,
        cpf,
        cnpj,
        phone,
        avatarUrl,
        jobTitle,
        birthDate,
        companyId,
      },
      {
        ...options,
      }
    );

    return newUser;
  } catch (error) {
    console.error("Error creating user: " + error);
    throw error;
  }
};

const getById = async (id) => {
  try {
    const user = await UserModel.findByPk(id, {
      attributes: baseUserAttributes,
    });

    if (!user) return null;

    return user;
  } catch (error) {
    console.error("Error fetching user by ID: " + error.message);
    throw error;
  }
};

const getByEmail = async (email, pass = false) => {
  try {
    const attributes = [...baseUserAttributes];
    if (pass) attributes.push("password");

    const user = await UserModel.findOne({ where: { email }, attributes });

    if (!user) return null;

    return user;
  } catch (error) {
    console.error("Error fetching user by email: " + error.message);
    throw error;
  }
};

const getByCpf = async (cpf) => {
  try {
    if (!cpf) return null;
    return await UserModel.findOne({ where: { cpf }, attributes: baseUserAttributes });
  } catch (error) {
    console.error("Error fetching user by CPF: " + error.message);
    throw error;
  }
};

const getByCnpj = async (cnpj) => {
  try {
    if (!cnpj) return null;
    return await UserModel.findOne({ where: { cnpj }, attributes: baseUserAttributes });
  } catch (error) {
    console.error("Error fetching user by CNPJ: " + error.message);
    throw error;
  }
};

const update = async (id, payload, options = {}) => {
  try {
    const [updatedRowsCount] = await UserModel.update(payload, { where: { id }, ...options });

    return updatedRowsCount > 0;
  } catch (error) {
    console.error("Error updating user: " + error.message);
    throw error;
  }
};

const listByCompanyAndType = async ({
  companyId,
  userType,
  search = "",
  limit = null,
  offset = 0,
}) => {
  try {
    const queryOptions = {
      where: {
        companyId,
        userType,
        ...buildUserSearchWhere(search),
      },
      attributes: baseUserAttributes,
      order: [["id", "ASC"]],
    };

    if (Number.isInteger(limit) && limit > 0) {
      return await UserModel.findAndCountAll({
        ...queryOptions,
        limit,
        offset: Number.isInteger(offset) && offset > 0 ? offset : 0,
      });
    }

    return await UserModel.findAll(queryOptions);
  } catch (error) {
    console.error("Error listing users by company/type: " + error.message);
    throw error;
  }
};

export {
  create,
  getByCnpj,
  getByCpf,
  getByEmail,
  getById,
  listByCompanyAndType,
  update,
};

export default {
  create,
  getById,
  getByEmail,
  getByCpf,
  getByCnpj,
  update,
  listByCompanyAndType,
};
