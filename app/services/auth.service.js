const bcrypt = require('bcrypt');
const { sequelize } = require('../models');
const userRepository = require('../repositories/user.repository');
const companyRepository = require('../repositories/company.repository');
const jwt = require('../utils/jwt');

const USER_TYPES = Object.freeze({
  CLIENTE: 'cliente',
  FUNCIONARIO: 'funcionario',
  EMPRESA: 'empresa',
});

const USER_TYPE_ALIASES = Object.freeze({
  cliente: USER_TYPES.CLIENTE,
  client: USER_TYPES.CLIENTE,
  funcionario: USER_TYPES.FUNCIONARIO,
  employee: USER_TYPES.FUNCIONARIO,
  empresa: USER_TYPES.EMPRESA,
  company: USER_TYPES.EMPRESA,
});

const normalizeDigits = (value = '') => String(value).replace(/\D/g, '');

const normalizeUserType = (userType = '') => USER_TYPE_ALIASES[String(userType).trim().toLowerCase()] || null;

const sanitizeUserPayload = (user) => {
  if (!user) return null;
  const plainUser = typeof user.get === 'function' ? user.get({ plain: true }) : { ...user };
  delete plainUser.password;
  return plainUser;
};

const createStandardUser = async ({
  name,
  email,
  password,
  userType,
  cpf,
  phone = null,
  birthDate = null,
  companyId = null,
  transaction,
}) => {
  const documentDigits = normalizeDigits(cpf);

  if (documentDigits.length !== 11) {
    return { error: { status: 400, message: 'CPF must have 11 digits' } };
  }

  const existingEmail = await userRepository.getByEmail(email);
  if (existingEmail) return { error: { status: 400, message: 'User already exists' } };

  const existingCpf = await userRepository.getByCpf(documentDigits);
  if (existingCpf) return { error: { status: 400, message: 'CPF already registered' } };

  const hashedPassword = await bcrypt.hash(password, 10);

  const createdUser = await userRepository.create(
    {
      name,
      email,
      password: hashedPassword,
      userType,
      cpf: documentDigits,
      cnpj: null,
      phone,
      birthDate,
      companyId,
    },
    { transaction }
  );

  return { user: createdUser };
};

exports.login = async ({ email, password }) => {
  try {
    let user = await userRepository.getByEmail(email, true);

    if (!user) return { status: 400, message: 'Invalid credentials' };

    user = user.get({ plain: true });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return { status: 400, message: 'Invalid credentials' };

    const token = jwt.sign(user);
    const sanitizedUser = sanitizeUserPayload(user);

    return {
      status: 200,
      message: 'Login successful',
      user: sanitizedUser,
      token,
    };
  } catch (error) {
    console.error('Error during login: ' + error.message);
    return { status: 500, message: 'Login failed' };
  }
};

exports.register = async ({
  name,
  email,
  password,
  userType,
  cpf,
  phone = null,
  birthDate = null,
  companyName,
  companyDescription,
  companyCnpj,
  adminUser,
}) => {
  try {
    const normalizedUserType = normalizeUserType(userType || USER_TYPES.CLIENTE);

    if (!normalizedUserType) {
      return { status: 400, message: 'Invalid userType' };
    }

    if (normalizedUserType === USER_TYPES.FUNCIONARIO) {
      return {
        status: 403,
        message: 'Employee registration is only allowed by company admins',
      };
    }

    if (normalizedUserType !== USER_TYPES.EMPRESA) {
      if (!name || !email || !password || !cpf) {
        return { status: 400, message: 'Name, email, password and CPF are required' };
      }

      const result = await createStandardUser({
        name,
        email,
        password,
        userType: normalizedUserType,
        cpf,
        phone,
        birthDate,
      });

      if (result.error) return result.error;

      const token = jwt.sign(result.user);
      const sanitizedUser = sanitizeUserPayload(result.user);

      return {
        status: 201,
        message: 'User registered successfully',
        user: sanitizedUser,
        token,
      };
    }

    const normalizedCompanyName = String(companyName || '').trim();
    const normalizedCompanyDescription = String(companyDescription || '').trim();
    const normalizedCompanyCnpj = normalizeDigits(companyCnpj);

    const normalizedAdminUser = adminUser || {
      name,
      email,
      password,
      cpf,
      phone,
      birthDate,
    };

    const adminName = String(normalizedAdminUser?.name || '').trim();
    const adminEmail = String(normalizedAdminUser?.email || '').trim();
    const adminPassword = String(normalizedAdminUser?.password || '');
    const adminPhone = normalizedAdminUser?.phone || null;
    const adminBirthDate = normalizedAdminUser?.birthDate || null;
    const adminCpfDigits = normalizeDigits(normalizedAdminUser?.cpf);

    if (!normalizedCompanyName || !normalizedCompanyDescription || normalizedCompanyCnpj.length !== 14) {
      return {
        status: 400,
        message: 'Company name, company description and company CNPJ are required',
      };
    }

    if (!adminName || !adminEmail || !adminPassword || adminCpfDigits.length !== 11) {
      return {
        status: 400,
        message: 'Admin name, email, password and CPF are required',
      };
    }

    const existingCompanyCnpj = await companyRepository.getByCnpj(normalizedCompanyCnpj);
    if (existingCompanyCnpj) {
      return { status: 400, message: 'Company CNPJ already registered' };
    }

    const [existingAdminEmail, existingAdminCpf] = await Promise.all([
      userRepository.getByEmail(adminEmail),
      userRepository.getByCpf(adminCpfDigits),
    ]);

    if (existingAdminEmail) return { status: 400, message: 'Admin e-mail already registered' };
    if (existingAdminCpf) return { status: 400, message: 'Admin CPF already registered' };

    const transactionResult = await sequelize.transaction(async (transaction) => {
      const createdCompany = await companyRepository.create(
        {
          name: normalizedCompanyName,
          description: normalizedCompanyDescription,
          cnpj: normalizedCompanyCnpj,
        },
        { transaction }
      );

      const createdAdminResult = await createStandardUser({
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        userType: USER_TYPES.EMPRESA,
        cpf: adminCpfDigits,
        phone: adminPhone,
        birthDate: adminBirthDate,
        companyId: createdCompany.id,
        transaction,
      });

      if (createdAdminResult.error) {
        throw new Error(createdAdminResult.error.message);
      }

      await companyRepository.addAdminLink(
        {
          companyId: createdCompany.id,
          userId: createdAdminResult.user.id,
          isPrimary: true,
        },
        { transaction }
      );

      return {
        company: createdCompany,
        adminUser: createdAdminResult.user,
      };
    });

    const token = jwt.sign(transactionResult.adminUser);
    const sanitizedUser = sanitizeUserPayload(transactionResult.adminUser);

    return {
      status: 201,
      message: 'Company and admin user registered successfully',
      user: sanitizedUser,
      company: {
        id: transactionResult.company.id,
        name: transactionResult.company.name,
        description: transactionResult.company.description,
        cnpj: transactionResult.company.cnpj,
      },
      token,
    };
  } catch (error) {
    console.error('Error during registration: ' + error.message);
    return { status: 500, message: 'Registration failed' };
  }
};
