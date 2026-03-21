const bcrypt = require('bcrypt');
const { sequelize } = require('../models');
const companyRepository = require('../repositories/company.repository');
const userRepository = require('../repositories/user.repository');

const USER_TYPES = Object.freeze({
  CLIENTE: 'cliente',
  FUNCIONARIO: 'funcionario',
  EMPRESA: 'empresa',
});

const normalizeDigits = (value = '') => String(value).replace(/\D/g, '');

const formatCompanySnapshot = (company) => ({
  id: company.id,
  name: company.name,
  description: company.description,
  cnpj: company.cnpj,
});

const formatAdminResponse = (adminLink) => ({
  id: adminLink?.user?.id,
  name: adminLink?.user?.name,
  email: adminLink?.user?.email,
  phone: adminLink?.user?.phone,
  cpf: adminLink?.user?.cpf,
  userType: adminLink?.user?.userType,
  companyId: adminLink?.user?.companyId,
  isPrimary: Boolean(adminLink?.isPrimary),
});

const formatEmployeeResponse = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  cpf: user.cpf,
  userType: user.userType,
  companyId: user.companyId,
});

const getCompanyFromAdminUser = async (userId) => {
  const company = await companyRepository.getByAdminUserId(userId);
  return company || null;
};

const getCompanyAdmins = async (companyId) => {
  const admins = await companyRepository.listAdmins(companyId);
  return admins.map(formatAdminResponse);
};

const getCompanyEmployees = async (companyId) => {
  const employees = await userRepository.listByCompanyAndType({
    companyId,
    userType: USER_TYPES.FUNCIONARIO,
  });

  return employees.map((employee) => formatEmployeeResponse(employee.get({ plain: true })));
};

const getCompanyDataForAdmin = async (authUserId) => {
  const company = await getCompanyFromAdminUser(authUserId);

  if (!company) {
    return { error: { status: 403, message: 'User is not an admin of any company' } };
  }

  return { company };
};

exports.getAllCompanies = async () => {
  const companies = await companyRepository.getAll();
  return { status: 200, result: companies };
};

exports.getMyCompanyAdmins = async (authUserId) => {
  const context = await getCompanyDataForAdmin(authUserId);
  if (context.error) return context.error;

  const admins = await getCompanyAdmins(context.company.id);

  return {
    status: 200,
    company: formatCompanySnapshot(context.company),
    admins,
  };
};

exports.getMyCompanyEmployees = async (authUserId) => {
  const context = await getCompanyDataForAdmin(authUserId);
  if (context.error) return context.error;

  const employees = await getCompanyEmployees(context.company.id);

  return {
    status: 200,
    company: formatCompanySnapshot(context.company),
    employees,
  };
};

exports.addMyCompanyEmployee = async (authUserId, payload) => {
  const context = await getCompanyDataForAdmin(authUserId);
  if (context.error) return context.error;

  const name = String(payload?.name || '').trim();
  const email = String(payload?.email || '').trim();
  const password = String(payload?.password || '').trim();
  const phone = payload?.phone || null;
  const cpfDigits = normalizeDigits(payload?.cpf);

  if (!name || !email || !password || cpfDigits.length !== 11) {
    return {
      status: 400,
      message: 'Name, e-mail, password and CPF are required to create an employee',
    };
  }

  const [existingEmail, existingCpf] = await Promise.all([
    userRepository.getByEmail(email),
    userRepository.getByCpf(cpfDigits),
  ]);

  if (existingEmail) return { status: 400, message: 'E-mail already registered' };
  if (existingCpf) return { status: 400, message: 'CPF already registered' };

  const hashedPassword = await bcrypt.hash(password, 10);

  await userRepository.create({
    name,
    email,
    password: hashedPassword,
    userType: USER_TYPES.FUNCIONARIO,
    cpf: cpfDigits,
    cnpj: null,
    phone,
    birthDate: null,
    companyId: context.company.id,
  });

  const employees = await getCompanyEmployees(context.company.id);

  return {
    status: 201,
    message: 'Employee created successfully',
    company: formatCompanySnapshot(context.company),
    employees,
  };
};

exports.removeMyCompanyEmployee = async (authUserId, employeeUserId) => {
  const context = await getCompanyDataForAdmin(authUserId);
  if (context.error) return context.error;

  const employee = await userRepository.getById(Number(employeeUserId));
  if (!employee) return { status: 404, message: 'Employee not found' };

  if (employee.userType !== USER_TYPES.FUNCIONARIO || employee.companyId !== context.company.id) {
    return { status: 400, message: 'User is not an employee of this company' };
  }

  await userRepository.update(employee.id, { companyId: null });

  const employees = await getCompanyEmployees(context.company.id);

  return {
    status: 200,
    message: 'Employee removed from company',
    company: formatCompanySnapshot(context.company),
    employees,
  };
};

exports.addMyCompanyAdmin = async (authUserId, payload) => {
  const context = await getCompanyDataForAdmin(authUserId);
  if (context.error) return context.error;

  const makePrimary = Boolean(payload?.makePrimary);
  const existingEmail = String(payload?.email || '').trim();
  const shouldCreateUser = Boolean(payload?.name && payload?.password && payload?.cpf);

  if (!existingEmail) {
    return { status: 400, message: 'E-mail is required to associate an admin' };
  }

  let targetUser = await userRepository.getByEmail(existingEmail);
  let newUserPayload = null;

  if (!targetUser && !shouldCreateUser) {
    return { status: 404, message: 'User not found for this e-mail' };
  }

  if (!targetUser && shouldCreateUser) {
    const cpfDigits = normalizeDigits(payload?.cpf);

    if (cpfDigits.length !== 11) {
      return { status: 400, message: 'CPF must have 11 digits' };
    }

    const existingCpf = await userRepository.getByCpf(cpfDigits);
    if (existingCpf) {
      return { status: 400, message: 'CPF already registered' };
    }

    const hashedPassword = await bcrypt.hash(String(payload.password), 10);

    newUserPayload = {
      name: String(payload.name).trim(),
      email: existingEmail,
      password: hashedPassword,
      userType: USER_TYPES.FUNCIONARIO,
      cpf: cpfDigits,
      cnpj: null,
      phone: payload.phone || null,
      birthDate: null,
      companyId: context.company.id,
    };
  }

  if (!targetUser && !newUserPayload) {
    return { status: 500, message: 'Failed to create/find admin user' };
  }

  if (targetUser && ![USER_TYPES.EMPRESA, USER_TYPES.FUNCIONARIO].includes(targetUser.userType)) {
    return {
      status: 400,
      message: 'Only users with type empresa or funcionario can be admins',
    };
  }

  if (targetUser?.companyId && targetUser.companyId !== context.company.id) {
    return {
      status: 400,
      message: 'User is already associated with another company',
    };
  }

  try {
    await sequelize.transaction(async (transaction) => {
      if (newUserPayload) {
        targetUser = await userRepository.create(newUserPayload, { transaction });
      }

      if (!targetUser.companyId) {
        await userRepository.update(targetUser.id, { companyId: context.company.id }, { transaction });
      }

      const existingAdminLink = await companyRepository.getAdminLink(
        {
          companyId: context.company.id,
          userId: targetUser.id,
        },
        { transaction }
      );

      if (existingAdminLink) {
        throw new Error('ADMIN_ALREADY_LINKED');
      }

      if (makePrimary) {
        await companyRepository.clearPrimaryAdmin(context.company.id, { transaction });
      }

      await companyRepository.addAdminLink(
        {
          companyId: context.company.id,
          userId: targetUser.id,
          isPrimary: makePrimary,
        },
        { transaction }
      );
    });
  } catch (error) {
    if (error.message === 'ADMIN_ALREADY_LINKED') {
      return { status: 400, message: 'User is already an admin of this company' };
    }
    throw error;
  }

  const admins = await getCompanyAdmins(context.company.id);

  return {
    status: 200,
    company: formatCompanySnapshot(context.company),
    admins,
  };
};

exports.setMyCompanyPrimaryAdmin = async (authUserId, adminUserId) => {
  const context = await getCompanyDataForAdmin(authUserId);
  if (context.error) return context.error;

  const targetAdmin = await companyRepository.getAdminLink({
    companyId: context.company.id,
    userId: Number(adminUserId),
  });

  if (!targetAdmin) {
    return { status: 404, message: 'Admin user not linked to this company' };
  }

  await sequelize.transaction(async (transaction) => {
    await companyRepository.clearPrimaryAdmin(context.company.id, { transaction });
    await companyRepository.setPrimaryAdmin(
      {
        companyId: context.company.id,
        userId: Number(adminUserId),
      },
      { transaction }
    );
  });

  const admins = await getCompanyAdmins(context.company.id);

  return {
    status: 200,
    company: formatCompanySnapshot(context.company),
    admins,
  };
};

exports.removeMyCompanyAdmin = async (authUserId, adminUserId) => {
  const context = await getCompanyDataForAdmin(authUserId);
  if (context.error) return context.error;

  const targetAdmin = await companyRepository.getAdminLink({
    companyId: context.company.id,
    userId: Number(adminUserId),
  });

  if (!targetAdmin) {
    return { status: 404, message: 'Admin user not linked to this company' };
  }

  const adminsCount = await companyRepository.countAdmins(context.company.id);
  if (adminsCount <= 1) {
    return { status: 400, message: 'A company must have at least one admin' };
  }

  await sequelize.transaction(async (transaction) => {
    await companyRepository.removeAdminLink(
      {
        companyId: context.company.id,
        userId: Number(adminUserId),
      },
      { transaction }
    );

    if (targetAdmin.isPrimary) {
      const remainingAdmins = await companyRepository.listAdmins(context.company.id, { transaction });
      const fallbackAdmin = remainingAdmins[0];

      if (fallbackAdmin?.user?.id) {
        await companyRepository.setPrimaryAdmin(
          {
            companyId: context.company.id,
            userId: fallbackAdmin.user.id,
          },
          { transaction }
        );
      }
    }
  });

  const admins = await getCompanyAdmins(context.company.id);

  return {
    status: 200,
    company: formatCompanySnapshot(context.company),
    admins,
  };
};
