import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { sequelize } from "../models/index.js";
import companyRepository from "../repositories/company.repository.js";
import passwordResetTokenRepository from "../repositories/passwordResetToken.repository.js";
import userRepository from "../repositories/user.repository.js";
import jwt from "../utils/jwt.js";
import { sendPasswordResetEmail } from "../utils/mailer.js";

const USER_TYPES = Object.freeze({
  CLIENTE: "cliente",
  FUNCIONARIO: "funcionario",
  EMPRESA: "empresa",
});

const USER_TYPE_ALIASES = Object.freeze({
  cliente: USER_TYPES.CLIENTE,
  client: USER_TYPES.CLIENTE,
  funcionario: USER_TYPES.FUNCIONARIO,
  employee: USER_TYPES.FUNCIONARIO,
  empresa: USER_TYPES.EMPRESA,
  company: USER_TYPES.EMPRESA,
});

const normalizeDigits = (value = "") => String(value).replace(/\D/g, "");
const normalizeText = (value = "") => String(value).trim();
const hashToken = (value = "") => crypto.createHash("sha256").update(String(value)).digest("hex");
const RESET_PASSWORD_EXPIRES_MINUTES = (() => {
  const parsed = Number(process.env.RESET_PASSWORD_EXPIRES_MINUTES || 30);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
})();
const RESET_PASSWORD_SUCCESS_MESSAGE = "Se uma conta com esse e-mail existir, um link para redefinir a senha foi enviado.";

const normalizeUserType = (userType = "") => USER_TYPE_ALIASES[String(userType).trim().toLowerCase()] || null;

const sanitizeUserPayload = (user) => {
  if (!user) return null;
  const plainUser = typeof user.get === "function" ? user.get({ plain: true }) : { ...user };
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
    return { error: { status: 400, message: "CPF must have 11 digits" } };
  }

  const existingEmail = await userRepository.getByEmail(email);
  if (existingEmail) return { error: { status: 400, message: "User already exists" } };

  const existingCpf = await userRepository.getByCpf(documentDigits);
  if (existingCpf) return { error: { status: 400, message: "CPF already registered" } };

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

const login = async ({ email, password }) => {
  try {
    let user = await userRepository.getByEmail(email, true);

    if (!user) return { status: 400, message: "Invalid credentials" };

    user = user.get({ plain: true });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return { status: 400, message: "Invalid credentials" };

    const token = jwt.sign(user);
    const sanitizedUser = sanitizeUserPayload(user);

    return {
      status: 200,
      message: "Login successful",
      user: sanitizedUser,
      token,
    };
  } catch (error) {
    console.error("Error during login: " + error);
    return { status: 500, message: "Login failed" };
  }
};

const forgotPassword = async ({ email }) => {
  try {
    const normalizedEmail = normalizeText(email);
    if (!normalizedEmail) {
      return { status: 400, message: "E-mail is required" };
    }

    const user = await userRepository.getByEmail(normalizedEmail);
    if (!user) {
      return { status: 200, message: RESET_PASSWORD_SUCCESS_MESSAGE };
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_PASSWORD_EXPIRES_MINUTES * 60 * 1000);

    await sequelize.transaction(async (transaction) => {
      await passwordResetTokenRepository.markAllAsUsedByUserId(user.id, { transaction });
      await passwordResetTokenRepository.create(
        {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
        { transaction }
      );
    });

    const appUrl = normalizeText(process.env.APP_URL || "http://localhost:5173");
    const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

    try {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
        expiresInMinutes: RESET_PASSWORD_EXPIRES_MINUTES,
      });
    } catch (mailError) {
      console.error("Error sending password reset e-mail: " + mailError.message);
    }

    return { status: 200, message: RESET_PASSWORD_SUCCESS_MESSAGE };
  } catch (error) {
    console.error("Error during forgotPassword: " + error.message);
    return { status: 500, message: "Failed to process password reset request" };
  }
};

const resetPassword = async ({ token, newPassword }) => {
  try {
    const normalizedToken = normalizeText(token);
    const normalizedPassword = String(newPassword || "");

    if (!normalizedToken || !normalizedPassword) {
      return { status: 400, message: "Token and new password are required" };
    }

    if (normalizedPassword.length < 6) {
      return { status: 400, message: "Password must have at least 6 characters" };
    }

    const tokenHash = hashToken(normalizedToken);
    const tokenRecord = await passwordResetTokenRepository.getActiveByTokenHash(tokenHash);

    if (!tokenRecord) {
      return { status: 400, message: "O token está inválido ou expirado" };
    }

    if (new Date(tokenRecord.expiresAt).getTime() < Date.now()) {
      return { status: 400, message: "O token está inválido ou expirado" };
    }

    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);

    await sequelize.transaction(async (transaction) => {
      await userRepository.update(tokenRecord.user.id, { password: hashedPassword }, { transaction });
      await passwordResetTokenRepository.markAllAsUsedByUserId(tokenRecord.user.id, { transaction });
    });

    return { status: 200, message: "Senha redefinida com sucesso" };
  } catch (error) {
    console.error("Error during resetPassword: " + error.message);
    return { status: 500, message: "Erro ao redefinir senha" };
  }
};

const validateResetToken = async ({ token }) => {
  try {
    const normalizedToken = normalizeText(token);
    if (!normalizedToken) {
      return { status: 400, message: "Token is required" };
    }

    const tokenHash = hashToken(normalizedToken);
    const tokenRecord = await passwordResetTokenRepository.getActiveByTokenHash(tokenHash);

    if (!tokenRecord) {
      return { status: 400, message: "Invalid or expired reset token" };
    }

    if (new Date(tokenRecord.expiresAt).getTime() < Date.now()) {
      return { status: 400, message: "Invalid or expired reset token" };
    }

    return { status: 200, message: "Valid reset token" };
  } catch (error) {
    console.error("Error during validateResetToken: " + error.message);
    return { status: 500, message: "Failed to validate reset token" };
  }
};

const register = async ({
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
      return { status: 400, message: "Invalid userType" };
    }

    if (normalizedUserType === USER_TYPES.FUNCIONARIO) {
      return {
        status: 403,
        message: "Employee registration is only allowed by company admins",
      };
    }

    if (normalizedUserType !== USER_TYPES.EMPRESA) {
      if (!name || !email || !password || !cpf) {
        return {
          status: 400,
          message: "Name, email, password and CPF are required",
        };
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
        message: "User registered successfully",
        user: sanitizedUser,
        token,
      };
    }

    const normalizedCompanyName = String(companyName || "").trim();
    const normalizedCompanyDescription = String(companyDescription || "").trim();
    const normalizedCompanyCnpj = normalizeDigits(companyCnpj);

    const normalizedAdminUser = adminUser || {
      name,
      email,
      password,
      cpf,
      phone,
      birthDate,
    };

    const adminName = String(normalizedAdminUser?.name || "").trim();
    const adminEmail = String(normalizedAdminUser?.email || "").trim();
    const adminPassword = String(normalizedAdminUser?.password || "");
    const adminPhone = normalizedAdminUser?.phone || null;
    const adminBirthDate = normalizedAdminUser?.birthDate || null;
    const adminCpfDigits = normalizeDigits(normalizedAdminUser?.cpf);

    if (
      !normalizedCompanyName ||
      !normalizedCompanyDescription ||
      normalizedCompanyCnpj.length !== 14
    ) {
      return {
        status: 400,
        message: "Company name, company description and company CNPJ are required",
      };
    }

    if (!adminName || !adminEmail || !adminPassword || adminCpfDigits.length !== 11) {
      return {
        status: 400,
        message: "Admin name, email, password and CPF are required",
      };
    }

    const existingCompanyCnpj = await companyRepository.getByCnpj(
      normalizedCompanyCnpj
    );
    if (existingCompanyCnpj) {
      return { status: 400, message: "Company CNPJ already registered" };
    }

    const [existingAdminEmail, existingAdminCpf] = await Promise.all([
      userRepository.getByEmail(adminEmail),
      userRepository.getByCpf(adminCpfDigits),
    ]);

    if (existingAdminEmail) return { status: 400, message: "Admin e-mail already registered" };
    if (existingAdminCpf) return { status: 400, message: "Admin CPF already registered" };

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
      message: "Company and admin user registered successfully",
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
    console.error("Error during registration: " + error.message);
    return { status: 500, message: "Registration failed" };
  }
};

export { forgotPassword, login, register, resetPassword, validateResetToken };

export default {
  login,
  forgotPassword,
  resetPassword,
  validateResetToken,
  register,
};
