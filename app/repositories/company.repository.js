const {
  Company: CompanyModel,
  CompanyAdmin: CompanyAdminModel,
  User: UserModel,
  ComplaintTitle: ComplaintTitleModel,
  Ticket: TicketModel,
} = require('../models');

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

  getByName: async (name, options = {}) => {
    return CompanyModel.findOne({ where: { name }, ...options });
  },

  create: async ({ name, description, cnpj }, options = {}) => {
    return CompanyModel.create({ name, description, cnpj }, options);
  },

  update: async (id, payload, options = {}) => {
    const [updatedRowsCount] = await CompanyModel.update(payload, {
      where: { id },
      ...options,
    });

    return updatedRowsCount > 0;
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
          attributes: ['id', 'name', 'email', 'phone', 'cpf', 'avatarUrl', 'jobTitle', 'userType'],
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

  listComplaintTitles: async (companyId, options = {}) => {
    return ComplaintTitleModel.findAll({
      where: { company_id: companyId },
      attributes: ['id', 'title', 'description'],
      order: [['title', 'ASC'], ['id', 'ASC']],
      ...options,
    });
  },

  getComplaintTitleById: async (complaintTitleId, options = {}) => {
    return ComplaintTitleModel.findByPk(complaintTitleId, options);
  },

  createComplaintTitle: async ({ companyId, title, description = null }, options = {}) => {
    return ComplaintTitleModel.create(
      {
        company_id: companyId,
        title,
        description,
      },
      options
    );
  },

  countTicketsByComplaintTitle: async ({ companyId, complaintTitleId }, options = {}) => {
    return TicketModel.count({
      where: {
        company_id: companyId,
        complaintTitle_id: complaintTitleId,
      },
      ...options,
    });
  },

  removeComplaintTitle: async ({ companyId, complaintTitleId }, options = {}) => {
    return ComplaintTitleModel.destroy({
      where: {
        id: complaintTitleId,
        company_id: companyId,
      },
      ...options,
    });
  },
};
