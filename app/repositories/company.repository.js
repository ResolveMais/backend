const { Company: CompanyModel, CompanyAdmin: CompanyAdminModel, User: UserModel } = require('../models');

module.exports = {
  getAll: async () => {
    try {
      let companies = await CompanyModel.findAll();

      if (!companies || companies.length === 0) companies = [];

      return companies;
    } catch (error) {
      console.error('Error fetching companies: ' + error.message);
      throw error;
    }
  },

  getById: async (id, options = {}) => {
    return CompanyModel.findByPk(id, options);
  },

  getByCnpj: async (cnpj, options = {}) => {
    return CompanyModel.findOne({ where: { cnpj }, ...options });
  },

  create: async ({ name, description, cnpj }, options = {}) => {
    return CompanyModel.create({ name, description, cnpj }, options);
  },

  getByAdminUserId: async (userId, options = {}) => {
    const companyAdmin = await CompanyAdminModel.findOne({
      where: { user_id: userId },
      include: [
        {
          model: CompanyModel,
          as: 'company',
        },
      ],
      ...options,
    });

    return companyAdmin?.company || null;
  },

  listAdmins: async (companyId, options = {}) => {
    return CompanyAdminModel.findAll({
      where: { company_id: companyId },
      attributes: ['id', 'isPrimary'],
      include: [
        {
          model: UserModel,
          as: 'user',
          attributes: ['id', 'name', 'email', 'phone', 'cpf', 'userType'],
        },
      ],
      order: [['isPrimary', 'DESC'], ['id', 'ASC']],
      ...options,
    });
  },

  getAdminLink: async ({ companyId, userId }, options = {}) => {
    return CompanyAdminModel.findOne({
      where: {
        company_id: companyId,
        user_id: userId,
      },
      ...options,
    });
  },

  addAdminLink: async ({ companyId, userId, isPrimary = false }, options = {}) => {
    return CompanyAdminModel.create(
      {
        company_id: companyId,
        user_id: userId,
        isPrimary,
      },
      options
    );
  },

  clearPrimaryAdmin: async (companyId, options = {}) => {
    return CompanyAdminModel.update(
      { isPrimary: false },
      {
        where: { company_id: companyId },
        ...options,
      }
    );
  },

  setPrimaryAdmin: async ({ companyId, userId }, options = {}) => {
    return CompanyAdminModel.update(
      { isPrimary: true },
      {
        where: {
          company_id: companyId,
          user_id: userId,
        },
        ...options,
      }
    );
  },

  countAdmins: async (companyId, options = {}) => {
    return CompanyAdminModel.count({
      where: { company_id: companyId },
      ...options,
    });
  },

  removeAdminLink: async ({ companyId, userId }, options = {}) => {
    return CompanyAdminModel.destroy({
      where: {
        company_id: companyId,
        user_id: userId,
      },
      ...options,
    });
  },
};
