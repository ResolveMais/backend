import { Op } from "sequelize";
import {
  createRecordBySchema,
  filterAttributesBySchema,
  filterPayloadBySchema,
  hasColumnForAttribute,
} from "../utils/dbSchemaCompat.js";
import {
  ACTIVE_TICKET_STATUSES,
  CLOSED_TICKET_STATUSES,
  TICKET_LOG_TYPE,
  TICKET_STATUS,
  normalizeTicketLogTypeForPersistence,
  normalizeTicketStatus,
} from "../utils/ticketStatus.js";

import db from "../models/index.js";
const { Company, ComplaintTitle, Ticket: TicketModel, TicketUpdate, User } = db;

const baseTicketAttributes = [
  "id",
  "description",
  "status",
  "createdAt",
  "updatedAt",
  "lastUpdateMessage",
  "acceptedAt",
  "resolvedAt",
  "closedAt",
  "reopenedAt",
  "lastInteractionAt",
  "autoClosedAt",
  "assignedUserId",
];

const baseUserAttributes = ["id", "name", "email", "phone", "cpf", "userType", "avatarUrl"];
const supportUserAttributes = ["id", "name", "email", "phone", "jobTitle", "userType", "avatarUrl"];
const baseTicketUpdateAttributes = ["id", "message", "type", "actorUserId", "statusFrom", "statusTo", "details", "createdAt"];

const getTicketAttributes = async () => filterAttributesBySchema(TicketModel, baseTicketAttributes);

const getBaseUserAttributes = async () => filterAttributesBySchema(User, baseUserAttributes);

const getSupportUserAttributes = async () => filterAttributesBySchema(User, supportUserAttributes);

const getTicketUpdateAttributes = async () => filterAttributesBySchema(TicketUpdate, baseTicketUpdateAttributes);

const refetchRecentTicket = async ({
  description,
  userId,
  companyId,
  complaintTitleId,
  createdAt,
}) =>
  TicketModel.findOne({
    where: {
      description,
      user_id: userId,
      company_id: companyId,
      complaintTitle_id: complaintTitleId,
      createdAt: {
        [Op.gte]: new Date(createdAt.getTime() - 5000),
      },
    },
    attributes: await getTicketAttributes(),
    order: [["id", "DESC"]],
  });

const refetchRecentTicketUpdate = async ({
  ticketId,
  message,
  type,
  createdAt,
  transaction = undefined,
}) =>
  TicketUpdate.findOne({
    where: {
      ticket_id: ticketId,
      message,
      type,
      createdAt: {
        [Op.gte]: new Date(createdAt.getTime() - 5000),
      },
    },
    attributes: await getTicketUpdateAttributes(),
    order: [["id", "DESC"]],
    transaction,
  });

const buildTicketIncludes = async ({ includeCustomer = false } = {}) => {
  const supportUserAttrs = await getSupportUserAttributes();
  const includes = [
    {
      model: Company,
      as: "empresa",
      attributes: ["id", "name", "description", "cnpj"],
    },
    {
      model: ComplaintTitle,
      as: "tituloReclamacao",
      attributes: ["id", "title", "description"],
    },
    {
      model: User,
      as: "assignedEmployee",
      attributes: supportUserAttrs,
      required: false,
    },
  ];

  const hasAssignedUserId = await hasColumnForAttribute(TicketModel, "assignedUserId");

  if (!hasAssignedUserId) {
    includes.pop();
  }

  if (includeCustomer) {
    const customerAttrs = await getBaseUserAttributes();
    includes.push({
      model: User,
      as: "cliente",
      attributes: customerAttrs,
    });
  }

  return includes;
};

const normalizeStatusesForQuery = (statuses = []) => {
  const uniqueStatuses = Array.from(
    new Set(
      (Array.isArray(statuses) ? statuses : [statuses])
        .map((status) => normalizeTicketStatus(status))
        .filter(Boolean)
    )
  );

  if (uniqueStatuses.includes(TICKET_STATUS.FECHADO)) {
    uniqueStatuses.push(TICKET_STATUS.FINALIZADO_LEGACY);
  }

  return Array.from(new Set(uniqueStatuses));
};

const buildStatusWhereClause = (statuses = null) => {
  const normalizedStatuses = normalizeStatusesForQuery(statuses || []);

  if (normalizedStatuses.length === 0) return undefined;

  return {
    [Op.in]: normalizedStatuses,
  };
};

const create = async ({
  description,
  userId,
  companyId,
  complaintTitleId,
}) => {
  try {
    console.log("Repository: creating ticket...");

    const [userExists, companyExists, complaintTitleExists] = await Promise.all([
      User.findByPk(userId),
      Company.findByPk(companyId),
      ComplaintTitle.findByPk(complaintTitleId),
    ]);

    if (!userExists) throw new Error(`Usuário ID ${userId} não encontrado`);
    if (!companyExists) throw new Error(`Empresa ID ${companyId} não encontrada`);
    if (!complaintTitleExists) {
      throw new Error(`Assunto ID ${complaintTitleId} não encontrado`);
    }

    const now = new Date();

    const ticketPayload = await filterPayloadBySchema(TicketModel, {
      description,
      user_id: userId,
      company_id: companyId,
      complaintTitle_id: complaintTitleId,
      status: TICKET_STATUS.ABERTO,
      createdAt: now,
      updatedAt: now,
      lastInteractionAt: now,
    });
    let newTicket = await createRecordBySchema(TicketModel, ticketPayload);

    if (!newTicket?.id) {
      newTicket = await refetchRecentTicket({
        description,
        userId,
        companyId,
        complaintTitleId,
        createdAt: now,
      });
    }

    if (!newTicket?.id) {
      throw new Error("Não foi possível recuperar o ticket após a criação.");
    }

    const updatePayload = await filterPayloadBySchema(TicketUpdate, {
      message: "Novo ticket criado",
      type: TICKET_LOG_TYPE.CREATION,
      ticket_id: newTicket.id,
      actor_user_id: userId,
      status_to: TICKET_STATUS.ABERTO,
    });
    await createRecordBySchema(TicketUpdate, updatePayload);

    return newTicket;
  } catch (error) {
    console.error("Repository error while creating ticket:", error.message);
    throw error;
  }
};

const getComplaintTitlesByCompany = async (companyId) => {
  try {
    const complaintTitles = await ComplaintTitle.findAll({
      where: { company_id: companyId },
      attributes: ["id", "title", "description"],
      include: [
        {
          model: Company,
          as: "empresa",
          attributes: ["id", "name"],
        },
      ],
    });

    return complaintTitles;
  } catch (error) {
    console.error("Erro ao buscar assuntos:", error);
    throw error;
  }
};

const getByUserId = async (userId) => {
  try {
    return TicketModel.findAll({
      where: { user_id: userId },
      attributes: await getTicketAttributes(),
      include: await buildTicketIncludes(),
      order: [["createdAt", "DESC"]],
    });
  } catch (error) {
    console.error("Erro ao buscar tickets:", error);
    throw error;
  }
};

const getByIdForUser = async ({ ticketId, userId }) => {
  try {
    return TicketModel.findOne({
      where: { id: ticketId, user_id: userId },
      attributes: await getTicketAttributes(),
      include: await buildTicketIncludes({ includeCustomer: true }),
    });
  } catch (error) {
    console.error("Erro ao buscar ticket por ID:", error);
    throw error;
  }
};

const getByIdForCompany = async ({ ticketId, companyId }) => {
  try {
    return TicketModel.findOne({
      where: { id: ticketId, company_id: companyId },
      attributes: await getTicketAttributes(),
      include: await buildTicketIncludes({ includeCustomer: true }),
    });
  } catch (error) {
    console.error("Erro ao buscar ticket por empresa:", error);
    throw error;
  }
};

const listByCompanyId = async ({ companyId, statuses = null }) => {
  try {
    const statusWhere = buildStatusWhereClause(statuses);

    return TicketModel.findAll({
      where: {
        company_id: companyId,
        ...(statusWhere ? { status: statusWhere } : {}),
      },
      attributes: await getTicketAttributes(),
      include: await buildTicketIncludes({ includeCustomer: true }),
      order: [["updatedAt", "DESC"], ["createdAt", "DESC"]],
    });
  } catch (error) {
    console.error("Erro ao listar tickets da empresa:", error);
    throw error;
  }
};

const getClosedByUserId = async (userId) => {
  try {
    return TicketModel.findAll({
      where: {
        user_id: userId,
        status: {
          [Op.in]: normalizeStatusesForQuery(CLOSED_TICKET_STATUSES),
        },
      },
      attributes: await getTicketAttributes(),
      include: await buildTicketIncludes(),
      order: [["updatedAt", "DESC"]],
    });
  } catch (error) {
    console.error("Erro ao buscar tickets fechados:", error);
    throw error;
  }
};

const getOpenAndPendingByUserId = async (userId) => {
  try {
    return TicketModel.findAll({
      where: {
        user_id: userId,
        status: {
          [Op.in]: normalizeStatusesForQuery(ACTIVE_TICKET_STATUSES),
        },
      },
      attributes: await getTicketAttributes(),
      include: await buildTicketIncludes(),
      order: [["updatedAt", "DESC"], ["createdAt", "DESC"]],
    });
  } catch (error) {
    console.error("Erro ao buscar tickets ativos:", error);
    throw error;
  }
};

const getRecentUpdates = async (userId, limit = 3) => {
  try {
    const ticketUpdateAttrs = await getTicketUpdateAttributes();
    const ticketAttrs = await getTicketAttributes();
    const actorAttrs = await getSupportUserAttributes();
    const includeActor = await hasColumnForAttribute(TicketUpdate, "actorUserId");

    return TicketUpdate.findAll({
      attributes: ticketUpdateAttrs,
      include: [
        {
          model: TicketModel,
          as: "ticket",
          where: { user_id: userId },
          attributes: ticketAttrs,
          include: await buildTicketIncludes(),
        },
        ...(includeActor
          ? [
            {
              model: User,
              as: "actor",
              attributes: actorAttrs,
              required: false,
            },
          ]
          : []),
      ],
      order: [["createdAt", "DESC"]],
      limit,
    });
  } catch (error) {
    console.error("Erro ao buscar atualizações:", error);
    throw error;
  }
};

const getTicketLogsByTicketId = async (ticketId) => {
  try {
    const ticketUpdateAttrs = await getTicketUpdateAttributes();
    const actorAttrs = await getSupportUserAttributes();
    const includeActor = await hasColumnForAttribute(TicketUpdate, "actorUserId");

    return TicketUpdate.findAll({
      attributes: ticketUpdateAttrs,
      where: { ticket_id: ticketId },
      include: includeActor
        ? [
          {
            model: User,
            as: "actor",
            attributes: actorAttrs,
            required: false,
          },
        ]
        : [],
      order: [["createdAt", "ASC"]],
    });
  } catch (error) {
    console.error("Erro ao buscar logs do ticket:", error);
    throw error;
  }
};

const getTicketLogsByCompanyId = async ({ companyId, limit = 200 }) => {
  try {
    const ticketUpdateAttrs = await getTicketUpdateAttributes();
    const ticketAttrs = await getTicketAttributes();
    const actorAttrs = await getSupportUserAttributes();
    const includeActor = await hasColumnForAttribute(TicketUpdate, "actorUserId");

    return TicketUpdate.findAll({
      attributes: ticketUpdateAttrs,
      include: [
        {
          model: TicketModel,
          as: "ticket",
          where: { company_id: companyId },
          attributes: ticketAttrs,
          include: await buildTicketIncludes({ includeCustomer: true }),
        },
        ...(includeActor
          ? [
            {
              model: User,
              as: "actor",
              attributes: actorAttrs,
              required: false,
            },
          ]
          : []),
      ],
      order: [["createdAt", "DESC"]],
      limit,
    });
  } catch (error) {
    console.error("Erro ao buscar logs da empresa:", error);
    throw error;
  }
};

const updateTicketById = async (ticketId, payload, options = {}) => {
  const safePayload = await filterPayloadBySchema(TicketModel, payload);
  const [updatedRowsCount] = await TicketModel.update(safePayload, {
    where: { id: ticketId },
    ...options,
  });

  return updatedRowsCount > 0;
};

const createUpdate = async ({
  ticketId,
  message,
  type,
  actorUserId = null,
  employeeId = null,
  statusFrom = null,
  statusTo = null,
  details = null,
  touchInteraction = true,
  transaction = undefined,
}) => {
  try {
    const now = new Date();
    const persistedType = normalizeTicketLogTypeForPersistence(type);

    const safeUpdatePayload = await filterPayloadBySchema(TicketUpdate, {
      message,
      type: persistedType,
      ticket_id: ticketId,
      employee_id: employeeId,
      actor_user_id: actorUserId,
      status_from: statusFrom,
      status_to: statusTo,
      details:
        details === null || details === undefined
          ? null
          : JSON.stringify(details),
      createdAt: now,
    });
    let update = await createRecordBySchema(TicketUpdate, safeUpdatePayload, {
      transaction,
    });

    if (!update?.id) {
      update = await refetchRecentTicketUpdate({
        ticketId,
        message,
        type: persistedType,
        createdAt: now,
        transaction,
      });
    }

    if (!update) {
      update = TicketUpdate.build(
        {
          ...safeUpdatePayload,
          details: safeUpdatePayload.details || null,
        },
        { isNewRecord: false }
      );
    }

    const safeTicketPayload = await filterPayloadBySchema(TicketModel, {
      updatedAt: now,
      lastUpdateMessage: message,
      ...(touchInteraction ? { lastInteractionAt: now } : {}),
    });
    await TicketModel.update(
      safeTicketPayload,
      {
        where: { id: ticketId },
        transaction,
      }
    );

    return update;
  } catch (error) {
    console.error("Erro ao criar atualização:", error);
    throw error;
  }
};

const listInactiveOpenTickets = async ({ cutoffDate }) => {
  try {
    const hasLastInteractionAt = await hasColumnForAttribute(
      TicketModel,
      "lastInteractionAt"
    );
    const ticketAttrs = await getTicketAttributes();

    return TicketModel.findAll({
      where: {
        status: {
          [Op.in]: [TICKET_STATUS.ABERTO, TICKET_STATUS.PENDENTE],
        },
        ...(hasLastInteractionAt
          ? {
            [Op.or]: [
              {
                lastInteractionAt: {
                  [Op.lte]: cutoffDate,
                },
              },
              {
                lastInteractionAt: null,
                createdAt: {
                  [Op.lte]: cutoffDate,
                },
              },
            ],
          }
          : {
            [Op.or]: [
              {
                updatedAt: {
                  [Op.lte]: cutoffDate,
                },
              },
              {
                updatedAt: null,
                createdAt: {
                  [Op.lte]: cutoffDate,
                },
              },
            ],
          }),
      },
      attributes: ticketAttrs,
      include: await buildTicketIncludes({ includeCustomer: true }),
      order: [["createdAt", "ASC"]],
    });
  } catch (error) {
    console.error("Erro ao listar tickets inativos:", error);
    throw error;
  }
};

const ticketRepository = {
  create,
  createUpdate,
  getByIdForCompany,
  getByIdForUser,
  getByUserId,
  getClosedByUserId,
  getComplaintTitlesByCompany,
  getOpenAndPendingByUserId,
  getRecentUpdates,
  getTicketLogsByCompanyId,
  getTicketLogsByTicketId,
  listByCompanyId,
  listInactiveOpenTickets,
  updateTicketById,
};

export default ticketRepository;
