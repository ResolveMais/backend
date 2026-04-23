import bcrypt from "bcrypt";
import companyRepository from "../repositories/company.repository.js";
import ticketRepository from "../repositories/ticket.repository.js";
import userRepository from "../repositories/user.repository.js";
import { TICKET_STATUS, normalizeTicketStatus } from "../utils/ticketStatus.js";
import db from "../models/index.js";

const { sequelize } = db;

const USER_TYPES = Object.freeze({
  CLIENTE: "cliente",
  FUNCIONARIO: "funcionario",
  EMPRESA: "empresa",
});

const normalizeDigits = (value = "") => String(value).replace(/\D/g, "");
const normalizeText = (value = "") => String(value).trim();
const toPlain = (value) =>
  value && typeof value.get === "function" ? value.get({ plain: true }) : value;

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
  avatarUrl: adminLink?.user?.avatarUrl || null,
  jobTitle: adminLink?.user?.jobTitle || null,
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
  avatarUrl: user.avatarUrl || null,
  jobTitle: user.jobTitle || null,
  userType: user.userType,
  companyId: user.companyId,
});

const formatComplaintTitleResponse = (complaintTitle) => ({
  id: complaintTitle.id,
  title: complaintTitle.title,
  description: complaintTitle.description || "",
});

const getCustomerInitials = (name) => {
  const normalizedName = normalizeText(name);
  if (!normalizedName) return "CL";

  const parts = normalizedName.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
};

const getPublicReviewerLabel = (customer) =>
  customer?.name ? `Cliente ${getCustomerInitials(customer.name)}` : "Cliente";

const getTrustLevel = ({ averageRating, ratingCount }) => {
  if (!ratingCount || !averageRating) {
    return {
      label: "Sem avaliações suficientes",
      tone: "neutral",
    };
  }

  if (averageRating >= 4.5 && ratingCount >= 5) {
    return {
      label: "Alta confiabilidade",
      tone: "success",
    };
  }

  if (averageRating >= 4) {
    return {
      label: "Boa confiabilidade",
      tone: "success",
    };
  }

  if (averageRating >= 3) {
    return {
      label: "Confiabilidade moderada",
      tone: "warning",
    };
  }

  return {
    label: "Confiabilidade baixa",
    tone: "danger",
  };
};

const buildEvaluationHighlights = (tickets) => {
  const ratedTickets = tickets.filter((ticket) => Number(ticket.customerRating || 0) > 0);
  const withComment = ratedTickets.filter((ticket) => normalizeText(ticket.customerFeedback || "").length > 0);
  const withoutComment = ratedTickets.filter((ticket) => normalizeText(ticket.customerFeedback || "").length === 0);
  const sortByRelevance = (left, right) => {
    const leftSubmittedAt = new Date(left.customerEvaluatedAt || left.updatedAt || left.createdAt || 0).getTime();
    const rightSubmittedAt = new Date(right.customerEvaluatedAt || right.updatedAt || right.createdAt || 0).getTime();
    const leftRelevance = Math.abs(Number(left.customerRating || 0) - 3);
    const rightRelevance = Math.abs(Number(right.customerRating || 0) - 3);

    if (rightRelevance !== leftRelevance) {
      return rightRelevance - leftRelevance;
    }

    return rightSubmittedAt - leftSubmittedAt;
  };

  return [...withComment.sort(sortByRelevance), ...withoutComment.sort(sortByRelevance)]
    .slice(0, 6)
    .map((ticket) => ({
      ticketId: ticket.id,
      rating: Number(ticket.customerRating || 0),
      comment: normalizeText(ticket.customerFeedback || "") || null,
      submittedAt: ticket.customerEvaluatedAt || null,
      resolutionSource: ticket.resolutionSource || null,
      reviewerLabel: getPublicReviewerLabel(ticket.cliente),
      complaintTitle: ticket.tituloReclamacao?.title || "Sem assunto",
    }));
};

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
    return { error: { status: 403, message: "User is not an admin of any company" } };
  }

  return { company };
};

const getAllCompanies = async () => {
  const companies = await companyRepository.getAll();
  return { status: 200, result: companies };
};

const getPublicCompanyDashboard = async (companyId) => {
  const parsedCompanyId = Number(companyId);

  if (!Number.isInteger(parsedCompanyId) || parsedCompanyId <= 0) {
    return { status: 400, message: "ID da empresa inválido" };
  }

  const company = await companyRepository.getById(parsedCompanyId);

  if (!company) {
    return { status: 404, message: "Empresa não encontrada" };
  }

  const rawTickets = await ticketRepository.listByCompanyId({ companyId: parsedCompanyId });
  const tickets = rawTickets.map((ticket) => toPlain(ticket));

  const openTickets = tickets.filter(
    (ticket) => normalizeTicketStatus(ticket.status) === TICKET_STATUS.ABERTO
  ).length;
  const inProgressTickets = tickets.filter(
    (ticket) => normalizeTicketStatus(ticket.status) === TICKET_STATUS.PENDENTE
  ).length;
  const resolvedTickets = tickets.filter(
    (ticket) => normalizeTicketStatus(ticket.status) === TICKET_STATUS.RESOLVIDO
  ).length;
  const closedTickets = tickets.filter(
    (ticket) => normalizeTicketStatus(ticket.status) === TICKET_STATUS.FECHADO
  ).length;
  const ratedTickets = tickets.filter((ticket) => Number(ticket.customerRating || 0) > 0);
  const totalRatings = ratedTickets.length;
  const averageRating =
    totalRatings > 0
      ? Number(
          (
            ratedTickets.reduce(
              (accumulator, ticket) => accumulator + Number(ticket.customerRating || 0),
              0
            ) / totalRatings
          ).toFixed(1)
        )
      : null;
  const ratingDistribution = {
    1: ratedTickets.filter((ticket) => Number(ticket.customerRating) === 1).length,
    2: ratedTickets.filter((ticket) => Number(ticket.customerRating) === 2).length,
    3: ratedTickets.filter((ticket) => Number(ticket.customerRating) === 3).length,
    4: ratedTickets.filter((ticket) => Number(ticket.customerRating) === 4).length,
    5: ratedTickets.filter((ticket) => Number(ticket.customerRating) === 5).length,
  };
  const trustLevel = getTrustLevel({
    averageRating,
    ratingCount: totalRatings,
  });

  return {
    status: 200,
    company: formatCompanySnapshot(toPlain(company)),
    summary: {
      totalTickets: tickets.length,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      resolvedOrClosedTickets: resolvedTickets + closedTickets,
      averageRating,
      totalRatings,
      ratingDistribution,
      trustLevel,
    },
    highlights: buildEvaluationHighlights(tickets),
  };
};

const getMyCompanyAdmins = async (authUserId) => {
  const context = await getCompanyDataForAdmin(authUserId);
  if (context.error) return context.error;

  const admins = await getCompanyAdmins(context.company.id);

  return {
    status: 200,
    company: formatCompanySnapshot(context.company),
    admins,
  };
};

const getMyCompanyEmployees = async (authUserId) => {
  const context = await getCompanyDataForAdmin(authUserId);
  if (context.error) return context.error;

  const employees = await getCompanyEmployees(context.company.id);

  return {
    status: 200,
    company: formatCompanySnapshot(context.company),
    employees,
  };
};

const getMyCompanyComplaintTitles = async (authUserId) => {
  const context = await getCompanyDataForAdmin(authUserId);
  if (context.error) return context.error;

  const complaintTitles = await companyRepository.listComplaintTitles(context.company.id);

  return {
    status: 200,
    company: formatCompanySnapshot(context.company),
    complaintTitles: complaintTitles.map((complaintTitle) =>
      formatComplaintTitleResponse(complaintTitle.get({ plain: true }))
    ),
  };
};

const updateMyCompanyProfile = async (authUserId, payload) => {
  const context = await getCompanyDataForAdmin(authUserId);
  if (context.error) return context.error;

  if (payload?.cnpj !== undefined) {
    return { status: 400, message: "CNPJ cannot be updated after company registration" };
  }

  const updatePayload = {};

  if (payload?.name !== undefined) {
    const normalizedName = normalizeText(payload.name);
    if (!normalizedName) {
      return { status: 400, message: "Company name cannot be empty" };
    }

    const duplicatedName = await companyRepository.getByName(normalizedName);
    if (duplicatedName && Number(duplicatedName.id) !== Number(context.company.id)) {
      return { status: 400, message: "Company name already in use" };
    }

    updatePayload.name = normalizedName;
  }

  if (payload?.description !== undefined) {
    updatePayload.description = normalizeText(payload.description);
  }

  if (Object.keys(updatePayload).length === 0) {
    return { status: 400, message: "No company profile fields provided for update" };
  }

  await companyRepository.update(context.company.id, updatePayload);

  const company = await companyRepository.getById(context.company.id);

  return {
    status: 200,
    message: "Company profile updated successfully",
    company: formatCompanySnapshot(company),
  };
};

const addMyCompanyComplaintTitle = async (authUserId, payload) => {
  const context = await getCompanyDataForAdmin(authUserId);
  if (context.error) return context.error;

  const title = normalizeText(payload?.title || "");
  const description = normalizeText(payload?.description || "");

  if (!title) {
    return { status: 400, message: "O assunto da reclamação não pode ficar vazio" };
  }

  if (title.length > 100) {
    return { status: 400, message: "O assunto da reclamação deve ter no máximo 100 caracteres" };
  }

  if (description.length > 255) {
    return { status: 400, message: "A descrição do assunto deve ter no máximo 255 caracteres" };
  }

  const currentComplaintTitles = await companyRepository.listComplaintTitles(context.company.id);
  const duplicatedComplaintTitle = currentComplaintTitles.find(
    (complaintTitle) => normalizeText(complaintTitle.title).toLowerCase() === title.toLowerCase()
  );

  if (duplicatedComplaintTitle) {
    return { status: 400, message: "Já existe um assunto com esse nome para a empresa" };
  }

  await companyRepository.createComplaintTitle({
    companyId: context.company.id,
    title,
    description: description || null,
  });

  const complaintTitles = await companyRepository.listComplaintTitles(context.company.id);

  return {
    status: 201,
    message: "Assunto cadastrado com sucesso",
    company: formatCompanySnapshot(context.company),
    complaintTitles: complaintTitles.map((complaintTitle) =>
      formatComplaintTitleResponse(complaintTitle.get({ plain: true }))
    ),
  };
};

const removeMyCompanyComplaintTitle = async (authUserId, complaintTitleId) => {
  const context = await getCompanyDataForAdmin(authUserId);
  if (context.error) return context.error;

  const parsedComplaintTitleId = Number(complaintTitleId);

  if (!Number.isInteger(parsedComplaintTitleId) || parsedComplaintTitleId <= 0) {
    return { status: 400, message: "Assunto de reclamação inválido" };
  }

  const complaintTitle = await companyRepository.getComplaintTitleById(parsedComplaintTitleId);

  if (!complaintTitle || Number(complaintTitle.company_id) !== Number(context.company.id)) {
    return { status: 404, message: "Assunto de reclamação não encontrado para a empresa" };
  }

  const linkedTicketsCount = await companyRepository.countTicketsByComplaintTitle({
    companyId: context.company.id,
    complaintTitleId: parsedComplaintTitleId,
  });

  if (linkedTicketsCount > 0) {
    return {
      status: 400,
      message: "Não é possível remover um assunto já utilizado em tickets",
    };
  }

  await companyRepository.removeComplaintTitle({
    companyId: context.company.id,
    complaintTitleId: parsedComplaintTitleId,
  });

  const complaintTitles = await companyRepository.listComplaintTitles(context.company.id);

  return {
    status: 200,
    message: "Assunto removido com sucesso",
    company: formatCompanySnapshot(context.company),
    complaintTitles: complaintTitles.map((complaintTitle) =>
      formatComplaintTitleResponse(complaintTitle.get({ plain: true }))
    ),
  };
};

const addMyCompanyEmployee = async (authUserId, payload) => {
  const context = await getCompanyDataForAdmin(authUserId);
  if (context.error) return context.error;

  const name = normalizeText(payload?.name || "");
  const email = normalizeText(payload?.email || "");
  const password = normalizeText(payload?.password || "");
  const phone = payload?.phone ? normalizeText(payload.phone) : null;
  const jobTitle = payload?.jobTitle ? normalizeText(payload.jobTitle) : null;
  const cpfDigits = normalizeDigits(payload?.cpf);

  if (!name || !email || !password || cpfDigits.length !== 11) {
    return {
      status: 400,
      message: "Name, e-mail, password and CPF are required to create an employee",
    };
  }

  const [existingEmail, existingCpf] = await Promise.all([
    userRepository.getByEmail(email),
    userRepository.getByCpf(cpfDigits),
  ]);

  if (existingEmail) return { status: 400, message: "E-mail already registered" };
  if (existingCpf) return { status: 400, message: "CPF already registered" };

  const hashedPassword = await bcrypt.hash(password, 10);

  await userRepository.create({
    name,
    email,
    password: hashedPassword,
    userType: USER_TYPES.FUNCIONARIO,
    cpf: cpfDigits,
    cnpj: null,
    phone,
    jobTitle,
    birthDate: null,
    companyId: context.company.id,
  });

  const employees = await getCompanyEmployees(context.company.id);

  return {
    status: 201,
    message: "Employee created successfully",
    company: formatCompanySnapshot(context.company),
    employees,
  };
};

const updateMyCompanyEmployee = async (authUserId, employeeUserId, payload) => {
  const context = await getCompanyDataForAdmin(authUserId);
  if (context.error) return context.error;

  if (payload?.cpf !== undefined || payload?.cnpj !== undefined) {
    return { status: 400, message: "CPF/CNPJ cannot be updated after registration" };
  }

  const employee = await userRepository.getById(Number(employeeUserId));
  if (!employee) return { status: 404, message: "Employee not found" };

  if (employee.userType !== USER_TYPES.FUNCIONARIO || employee.companyId !== context.company.id) {
    return { status: 400, message: "User is not an employee of this company" };
  }

  const updatePayload = {};

  if (payload?.name !== undefined) {
    const normalizedName = normalizeText(payload.name);
    if (!normalizedName) return { status: 400, message: "Name cannot be empty" };
    updatePayload.name = normalizedName;
  }

  if (payload?.email !== undefined) {
    const normalizedEmail = normalizeText(payload.email);
    if (!normalizedEmail) return { status: 400, message: "E-mail cannot be empty" };

    const existingEmail = await userRepository.getByEmail(normalizedEmail);
    if (existingEmail && Number(existingEmail.id) !== Number(employee.id)) {
      return { status: 400, message: "E-mail already registered" };
    }

    updatePayload.email = normalizedEmail;
  }

  if (payload?.phone !== undefined) {
    updatePayload.phone = payload?.phone ? normalizeText(payload.phone) : null;
  }

  if (payload?.jobTitle !== undefined) {
    updatePayload.jobTitle = payload?.jobTitle ? normalizeText(payload.jobTitle) : null;
  }

  if (Object.keys(updatePayload).length === 0) {
    return { status: 400, message: "No employee fields provided for update" };
  }

  await userRepository.update(employee.id, updatePayload);

  const employees = await getCompanyEmployees(context.company.id);

  return {
    status: 200,
    message: "Employee updated successfully",
    company: formatCompanySnapshot(context.company),
    employees,
  };
};

const removeMyCompanyEmployee = async (authUserId, employeeUserId) => {
  const context = await getCompanyDataForAdmin(authUserId);
  if (context.error) return context.error;

  const employee = await userRepository.getById(Number(employeeUserId));
  if (!employee) return { status: 404, message: "Employee not found" };

  if (employee.userType !== USER_TYPES.FUNCIONARIO || employee.companyId !== context.company.id) {
    return { status: 400, message: "User is not an employee of this company" };
  }

  await userRepository.update(employee.id, { companyId: null });

  const employees = await getCompanyEmployees(context.company.id);

  return {
    status: 200,
    message: "Employee removed from company",
    company: formatCompanySnapshot(context.company),
    employees,
  };
};

const addMyCompanyAdmin = async (authUserId, payload) => {
  const context = await getCompanyDataForAdmin(authUserId);
  if (context.error) return context.error;

  const makePrimary = Boolean(payload?.makePrimary);
  const existingEmail = String(payload?.email || "").trim();
  const shouldCreateUser = Boolean(payload?.name && payload?.password && payload?.cpf);

  if (!existingEmail) {
    return { status: 400, message: "E-mail is required to associate an admin" };
  }

  let targetUser = await userRepository.getByEmail(existingEmail);
  let newUserPayload = null;

  if (!targetUser && !shouldCreateUser) {
    return { status: 404, message: "User not found for this e-mail" };
  }

  if (!targetUser && shouldCreateUser) {
    const cpfDigits = normalizeDigits(payload?.cpf);

    if (cpfDigits.length !== 11) {
      return { status: 400, message: "CPF must have 11 digits" };
    }

    const existingCpf = await userRepository.getByCpf(cpfDigits);
    if (existingCpf) {
      return { status: 400, message: "CPF already registered" };
    }

    const hashedPassword = await bcrypt.hash(String(payload.password), 10);

    newUserPayload = {
      name: normalizeText(payload.name),
      email: existingEmail,
      password: hashedPassword,
      userType: USER_TYPES.FUNCIONARIO,
      cpf: cpfDigits,
      cnpj: null,
      phone: payload.phone ? normalizeText(payload.phone) : null,
      jobTitle: payload?.jobTitle ? normalizeText(payload.jobTitle) : null,
      birthDate: null,
      companyId: context.company.id,
    };
  }

  if (!targetUser && !newUserPayload) {
    return { status: 500, message: "Failed to create/find admin user" };
  }

  if (targetUser && ![USER_TYPES.EMPRESA, USER_TYPES.FUNCIONARIO].includes(targetUser.userType)) {
    return {
      status: 400,
      message: "Only users with type empresa or funcionario can be admins",
    };
  }

  if (targetUser?.companyId && targetUser.companyId !== context.company.id) {
    return {
      status: 400,
      message: "User is already associated with another company",
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
        throw new Error("ADMIN_ALREADY_LINKED");
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
    if (error.message === "ADMIN_ALREADY_LINKED") {
      return { status: 400, message: "User is already an admin of this company" };
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

const setMyCompanyPrimaryAdmin = async (authUserId, adminUserId) => {
  const context = await getCompanyDataForAdmin(authUserId);
  if (context.error) return context.error;

  const targetAdmin = await companyRepository.getAdminLink({
    companyId: context.company.id,
    userId: Number(adminUserId),
  });

  if (!targetAdmin) {
    return { status: 404, message: "Admin user not linked to this company" };
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

const removeMyCompanyAdmin = async (authUserId, adminUserId) => {
  const context = await getCompanyDataForAdmin(authUserId);
  if (context.error) return context.error;

  const targetAdmin = await companyRepository.getAdminLink({
    companyId: context.company.id,
    userId: Number(adminUserId),
  });

  if (!targetAdmin) {
    return { status: 404, message: "Admin user not linked to this company" };
  }

  const adminsCount = await companyRepository.countAdmins(context.company.id);
  if (adminsCount <= 1) {
    return { status: 400, message: "A company must have at least one admin" };
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

export {
  addMyCompanyAdmin,
  addMyCompanyComplaintTitle,
  addMyCompanyEmployee,
  getAllCompanies,
  getPublicCompanyDashboard,
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
  getAllCompanies,
  getPublicCompanyDashboard,
  getMyCompanyAdmins,
  getMyCompanyEmployees,
  getMyCompanyComplaintTitles,
  updateMyCompanyProfile,
  addMyCompanyComplaintTitle,
  removeMyCompanyComplaintTitle,
  addMyCompanyEmployee,
  updateMyCompanyEmployee,
  removeMyCompanyEmployee,
  addMyCompanyAdmin,
  setMyCompanyPrimaryAdmin,
  removeMyCompanyAdmin,
};
