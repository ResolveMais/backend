import OpenAI from "openai";
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
const MAX_AI_PROFILE_FIELD_LENGTH = 4000;
const OPENAI_COMPANY_INSIGHTS_MODEL =
  process.env.OPENAI_COMPANY_INSIGHTS_MODEL ||
  process.env.OPENAI_MODEL ||
  "gpt-4.1-mini";
const AI_INSIGHT_TONES = new Set(["success", "warning", "danger", "neutral"]);
const PEOPLE_DEFAULT_PAGE = 1;
const PEOPLE_DEFAULT_PAGE_SIZE = 5;
const PEOPLE_MAX_PAGE_SIZE = 50;
const toPlain = (value) =>
  value && typeof value.get === "function" ? value.get({ plain: true }) : value;

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const shouldPaginatePeopleList = (options = {}) =>
  options?.page !== undefined ||
  options?.pageSize !== undefined ||
  options?.limit !== undefined;

const normalizePeopleListOptions = (options = {}) => {
  const search = normalizeText(options?.search || options?.q || "");
  const shouldPaginate = shouldPaginatePeopleList(options);

  if (!shouldPaginate) {
    return {
      search,
      pagination: null,
    };
  }

  const page = parsePositiveInteger(options?.page, PEOPLE_DEFAULT_PAGE);
  const pageSize = Math.min(
    parsePositiveInteger(options?.pageSize || options?.limit, PEOPLE_DEFAULT_PAGE_SIZE),
    PEOPLE_MAX_PAGE_SIZE
  );

  return {
    search,
    pagination: {
      page,
      pageSize,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    },
  };
};

const normalizeAdminRoleFilter = (value = "") => {
  const normalizedValue = normalizeText(value).toLowerCase();

  if (["primary", "principal"].includes(normalizedValue)) return "primary";
  if (["secondary", "secundario", "secundário"].includes(normalizedValue)) {
    return "secondary";
  }

  return "all";
};

const extractListRows = (result) => (Array.isArray(result) ? result : result?.rows || []);
const extractListTotal = (result) =>
  Array.isArray(result) ? result.length : Number(result?.count || 0);

const buildPaginationResponse = ({ page, pageSize }, total) => ({
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
});

const createDateFromValue = (value) => {
  if (!value) return null;

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const toIsoDateOrNull = (value) => {
  const parsedDate = createDateFromValue(value);
  return parsedDate ? parsedDate.toISOString() : null;
};

const normalizeInlineText = (value = "", maxLength = 220) => {
  const normalizedValue = String(value || "").replace(/\s+/g, " ").trim();

  if (!Number.isFinite(maxLength) || maxLength <= 0) {
    return normalizedValue;
  }

  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, maxLength - 3).trim()}...`;
};

const normalizeInlineTextWithoutLimit = (value = "") =>
  normalizeInlineText(value, Number.POSITIVE_INFINITY);

const formatInlineDecimal = (value) => {
  const normalizedValue = String(value || "").replace(",", ".").trim();
  const parsedValue = Number(normalizedValue);

  if (Number.isNaN(parsedValue)) {
    return String(value || "").trim();
  }

  return Number.isInteger(parsedValue)
    ? String(parsedValue)
    : parsedValue.toFixed(1).replace(".", ",");
};

const formatInlinePercent = (value) => {
  const normalizedValue = formatInlineDecimal(value);
  return normalizedValue ? `${normalizedValue}%` : "";
};

const humanizeAiInsightText = (value = "") => {
  let normalizedValue = String(value || "").trim();

  if (!normalizedValue) return "";

  const formattedFieldPatterns = [
    {
      pattern: /\bcompletionRate\s*:\s*(\d+(?:[.,]\d+)?)/gi,
      replacement: (_, fieldValue) =>
        `taxa de conclusão: ${formatInlinePercent(fieldValue)}`,
    },
    {
      pattern: /\baverageRating\s*:\s*(\d+(?:[.,]\d+)?)/gi,
      replacement: (_, fieldValue) =>
        `satisfação média: ${formatInlineDecimal(fieldValue)}`,
    },
    {
      pattern: /\bcreatedToday\s*:\s*(\d+)/gi,
      replacement: (_, fieldValue) => `tickets criados hoje: ${fieldValue}`,
    },
    {
      pattern: /\btotalTickets\s*:\s*(\d+)/gi,
      replacement: (_, fieldValue) => `total de tickets: ${fieldValue}`,
    },
    {
      pattern: /\bopenTickets\s*:\s*(\d+)/gi,
      replacement: (_, fieldValue) => `tickets abertos: ${fieldValue}`,
    },
    {
      pattern: /\binProgressTickets\s*:\s*(\d+)/gi,
      replacement: (_, fieldValue) => `tickets em atendimento: ${fieldValue}`,
    },
    {
      pattern: /\bresolvedTickets\s*:\s*(\d+)/gi,
      replacement: (_, fieldValue) => `tickets resolvidos: ${fieldValue}`,
    },
    {
      pattern: /\bclosedTickets\s*:\s*(\d+)/gi,
      replacement: (_, fieldValue) => `tickets fechados: ${fieldValue}`,
    },
    {
      pattern: /\bunassignedTickets\s*:\s*(\d+)/gi,
      replacement: (_, fieldValue) => `tickets sem responsável: ${fieldValue}`,
    },
    {
      pattern: /\btotalRatings\s*:\s*(\d+)/gi,
      replacement: (_, fieldValue) => `avaliações registradas: ${fieldValue}`,
    },
    {
      pattern: /\bteamSize\s*:\s*(\d+)/gi,
      replacement: (_, fieldValue) => `colaboradores analisados: ${fieldValue}`,
    },
    {
      pattern: /\bteamWithTickets\s*:\s*(\d+)/gi,
      replacement: (_, fieldValue) =>
        `colaboradores com tickets atribuídos: ${fieldValue}`,
    },
  ];

  formattedFieldPatterns.forEach(({ pattern, replacement }) => {
    normalizedValue = normalizedValue.replace(pattern, replacement);
  });

  const rawFieldLabels = [
    ["completionRate", "taxa de conclusão"],
    ["averageRating", "satisfação média"],
    ["createdToday", "tickets criados hoje"],
    ["totalTickets", "total de tickets"],
    ["openTickets", "tickets abertos"],
    ["inProgressTickets", "tickets em atendimento"],
    ["resolvedTickets", "tickets resolvidos"],
    ["closedTickets", "tickets fechados"],
    ["unassignedTickets", "tickets sem responsável"],
    ["totalRatings", "avaliações registradas"],
    ["teamSize", "colaboradores analisados"],
    ["teamWithTickets", "colaboradores com tickets atribuídos"],
  ];

  rawFieldLabels.forEach(([fieldName, label]) => {
    normalizedValue = normalizedValue.replace(
      new RegExp(`\\b${fieldName}\\b`, "g"),
      label
    );
  });

  return normalizedValue
    .replace(/\s{2,}/g, " ")
    .replace(/(\S)\s+satisfação média:/gi, "$1 - satisfação média:")
    .trim();
};

const formatCompanySnapshot = (company, { includeAiSettings = false } = {}) => {
  const snapshot = {
    id: company.id,
    name: company.name,
    description: company.description,
    cnpj: company.cnpj,
  };

  if (includeAiSettings) {
    snapshot.aiContext = company.aiContext || "";
    snapshot.aiInstructions = company.aiInstructions || "";
    snapshot.aiExamples = company.aiExamples || "";
  }

  return snapshot;
};

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

const getTicketLastActivity = (ticket) => {
  const timestamps = [
    ticket.updatedAt,
    ticket.closedAt,
    ticket.resolvedAt,
    ticket.createdAt,
  ]
    .map(createDateFromValue)
    .filter(Boolean)
    .map((date) => date.getTime());

  if (timestamps.length === 0) return null;

  return new Date(Math.max(...timestamps));
};

const buildEmployeeAiMetrics = (employees, tickets) => {
  const employeeRegistry = new Map();

  (Array.isArray(employees) ? employees : []).forEach((employee) => {
    employeeRegistry.set(String(employee.id), employee);
  });

  tickets.forEach((ticket) => {
    if (!ticket?.assignedEmployee?.id) return;

    if (!employeeRegistry.has(String(ticket.assignedEmployee.id))) {
      employeeRegistry.set(String(ticket.assignedEmployee.id), ticket.assignedEmployee);
    }
  });

  return Array.from(employeeRegistry.values())
    .map((employee) => {
      const assignedTickets = tickets.filter(
        (ticket) =>
          String(ticket.assignedEmployee?.id || "") === String(employee.id)
      );
      const activeTickets = assignedTickets.filter((ticket) =>
        [TICKET_STATUS.ABERTO, TICKET_STATUS.PENDENTE, TICKET_STATUS.RESOLVIDO].includes(
          normalizeTicketStatus(ticket.status)
        )
      );
      const pendingTickets = assignedTickets.filter(
        (ticket) => normalizeTicketStatus(ticket.status) === TICKET_STATUS.PENDENTE
      );
      const concludedTickets = assignedTickets.filter((ticket) =>
        [TICKET_STATUS.RESOLVIDO, TICKET_STATUS.FECHADO].includes(
          normalizeTicketStatus(ticket.status)
        )
      );
      const ratings = assignedTickets
        .map((ticket) => Number(ticket.customerRating || 0))
        .filter((rating) => rating > 0);
      const averageRating =
        ratings.length > 0
          ? Number(
              (
                ratings.reduce((accumulator, rating) => accumulator + rating, 0) /
                ratings.length
              ).toFixed(1)
            )
          : null;
      const completionRate =
        assignedTickets.length > 0
          ? Math.round((concludedTickets.length / assignedTickets.length) * 100)
          : 0;
      const lastActivity = assignedTickets
        .map(getTicketLastActivity)
        .filter(Boolean)
        .sort((left, right) => right.getTime() - left.getTime())[0] || null;
      const reasons = [];

      if (pendingTickets.length >= 3) {
        reasons.push("Fila pendente alta");
      }

      if (
        activeTickets.length >= 2 &&
        activeTickets.length >= concludedTickets.length + 2
      ) {
        reasons.push("Mais tickets ativos do que concluídos");
      }

      if (averageRating !== null && averageRating < 4) {
        reasons.push("Satisfação abaixo do ideal");
      }

      if (concludedTickets.length === 0 && activeTickets.length >= 2) {
        reasons.push("Sem tickets concluídos na carteira");
      }

      return {
        id: employee.id,
        name: employee.name || "Funcionário",
        jobTitle: employee.jobTitle || null,
        assignedCount: assignedTickets.length,
        activeCount: activeTickets.length,
        pendingCount: pendingTickets.length,
        concludedCount: concludedTickets.length,
        ratingCount: ratings.length,
        averageRating,
        completionRate,
        attentionReasons: reasons.slice(0, 2),
        lastActivity: lastActivity ? lastActivity.toISOString() : null,
      };
    })
    .sort((left, right) => {
      if (right.concludedCount !== left.concludedCount) {
        return right.concludedCount - left.concludedCount;
      }

      if ((right.averageRating || 0) !== (left.averageRating || 0)) {
        return (right.averageRating || 0) - (left.averageRating || 0);
      }

      if (right.activeCount !== left.activeCount) {
        return right.activeCount - left.activeCount;
      }

      return String(left.name || "").localeCompare(String(right.name || ""));
    });
};

const buildCompanyAiSnapshot = ({ company, tickets, employees }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
  const activeTickets = tickets.filter((ticket) =>
    [TICKET_STATUS.ABERTO, TICKET_STATUS.PENDENTE, TICKET_STATUS.RESOLVIDO].includes(
      normalizeTicketStatus(ticket.status)
    )
  ).length;
  const unassignedTickets = tickets.filter((ticket) => {
    const normalizedStatus = normalizeTicketStatus(ticket.status);

    return (
      [TICKET_STATUS.ABERTO, TICKET_STATUS.PENDENTE, TICKET_STATUS.RESOLVIDO].includes(
        normalizedStatus
      ) && !ticket.assignedEmployee?.id
    );
  }).length;
  const createdToday = tickets.filter((ticket) => {
    const createdAt = createDateFromValue(ticket.createdAt);

    if (!createdAt) return false;

    const normalizedDate = new Date(createdAt);
    normalizedDate.setHours(0, 0, 0, 0);
    return normalizedDate.getTime() === today.getTime();
  }).length;
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
  const recentVolume = Array.from({ length: 7 }, (_, index) => {
    const currentDay = new Date(today);
    currentDay.setDate(today.getDate() - (6 - index));

    const ticketsCreatedOnDay = tickets.filter((ticket) => {
      const createdAt = createDateFromValue(ticket.createdAt);

      if (!createdAt) return false;

      const normalizedDate = new Date(createdAt);
      normalizedDate.setHours(0, 0, 0, 0);

      return normalizedDate.getTime() === currentDay.getTime();
    }).length;

    return {
      date: currentDay.toISOString().slice(0, 10),
      count: ticketsCreatedOnDay,
    };
  });
  const topSubjects = Array.from(
    tickets.reduce((accumulator, ticket) => {
      const subject = ticket.tituloReclamacao?.title || "Sem assunto";
      accumulator.set(subject, (accumulator.get(subject) || 0) + 1);
      return accumulator;
    }, new Map()).entries()
  )
    .map(([subject, count]) => ({
      subject,
      count,
      share:
        tickets.length > 0
          ? Math.round((count / tickets.length) * 100)
          : 0,
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);

  const employeeMetrics = buildEmployeeAiMetrics(employees, tickets);

  return {
    company: {
      id: company.id,
      name: company.name,
      description: normalizeInlineText(company.description || "", 240) || null,
      aiContext: normalizeInlineText(company.aiContext || "", 320) || null,
      aiInstructions: normalizeInlineText(company.aiInstructions || "", 320) || null,
      aiExamples: normalizeInlineText(company.aiExamples || "", 320) || null,
    },
    summary: {
      totalTickets: tickets.length,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      activeTickets,
      unassignedTickets,
      createdToday,
      totalRatings,
      averageRating,
      completionRate:
        tickets.length > 0
          ? Math.round(((resolvedTickets + closedTickets) / tickets.length) * 100)
          : 0,
      teamSize: employees.length,
      teamWithTickets: employeeMetrics.filter((employee) => employee.assignedCount > 0)
        .length,
      ratingDistribution,
      trustLevel: getTrustLevel({ averageRating, ratingCount: totalRatings }),
    },
    topSubjects,
    recentVolume,
    employeeHighlights: employeeMetrics.slice(0, 5),
    attentionEmployees: employeeMetrics
      .filter(
        (employee) =>
          employee.assignedCount > 0 && employee.attentionReasons.length > 0
      )
      .slice(0, 4),
    recentTickets: [...tickets]
      .sort((left, right) => {
        const leftTime = createDateFromValue(left.createdAt)?.getTime() || 0;
        const rightTime = createDateFromValue(right.createdAt)?.getTime() || 0;

        return rightTime - leftTime;
      })
      .slice(0, 6)
      .map((ticket) => ({
        id: ticket.id,
        status: normalizeTicketStatus(ticket.status),
        subject: ticket.tituloReclamacao?.title || "Sem assunto",
        assignedEmployee: ticket.assignedEmployee?.name || null,
        createdAt: toIsoDateOrNull(ticket.createdAt),
        updatedAt: toIsoDateOrNull(ticket.updatedAt),
        rating: Number(ticket.customerRating || 0) || null,
      })),
    recentReviews: ratedTickets
      .sort((left, right) => {
        const leftTime =
          createDateFromValue(
            left.customerEvaluatedAt || left.updatedAt || left.createdAt
          )?.getTime() || 0;
        const rightTime =
          createDateFromValue(
            right.customerEvaluatedAt || right.updatedAt || right.createdAt
          )?.getTime() || 0;

        return rightTime - leftTime;
      })
      .slice(0, 6)
      .map((ticket) => ({
        ticketId: ticket.id,
        subject: ticket.tituloReclamacao?.title || "Sem assunto",
        rating: Number(ticket.customerRating || 0),
        comment: normalizeInlineText(ticket.customerFeedback || "", 180) || null,
        resolutionSource: ticket.resolutionSource || null,
        assignedEmployee: ticket.assignedEmployee?.name || null,
        submittedAt: toIsoDateOrNull(
          ticket.customerEvaluatedAt || ticket.updatedAt || ticket.createdAt
        ),
      })),
  };
};

const extractJsonObject = (value = "") => {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    throw new Error("Resposta vazia da IA.");
  }

  const fencedJsonMatch = normalizedValue.match(/```json\s*([\s\S]*?)```/i);

  if (fencedJsonMatch?.[1]) {
    return fencedJsonMatch[1].trim();
  }

  const firstBraceIndex = normalizedValue.indexOf("{");
  const lastBraceIndex = normalizedValue.lastIndexOf("}");

  if (firstBraceIndex === -1 || lastBraceIndex === -1 || lastBraceIndex <= firstBraceIndex) {
    throw new Error("A resposta da IA não retornou JSON válido.");
  }

  return normalizedValue.slice(firstBraceIndex, lastBraceIndex + 1);
};

const sanitizeAiInsightItem = (insight, index) => {
  if (!insight || typeof insight !== "object") return null;

  const tone = AI_INSIGHT_TONES.has(insight.tone) ? insight.tone : "neutral";
  const title =
    normalizeInlineTextWithoutLimit(humanizeAiInsightText(insight.title || "")) ||
    `Insight ${index + 1}`;
  const summary =
    normalizeInlineTextWithoutLimit(humanizeAiInsightText(insight.summary || "")) ||
    "A IA não conseguiu resumir este ponto com clareza.";
  const evidence = (Array.isArray(insight.evidence) ? insight.evidence : [])
    .map((item) =>
      normalizeInlineTextWithoutLimit(humanizeAiInsightText(item))
    )
    .filter(Boolean)
    .slice(0, 3);
  const recommendedAction =
    normalizeInlineTextWithoutLimit(
      humanizeAiInsightText(insight.recommendedAction || ""),
    ) ||
    "Revisar esse indicador no detalhe para decidir a próxima ação.";

  return {
    title,
    tone,
    summary,
    evidence,
    recommendedAction,
  };
};

const parseCompanyAiInsights = (rawContent) => {
  const parsedPayload = JSON.parse(extractJsonObject(rawContent));
  const headline =
    normalizeInlineTextWithoutLimit(
      humanizeAiInsightText(parsedPayload.headline || ""),
    ) ||
    "Leitura operacional da IA";
  const summary =
    normalizeInlineTextWithoutLimit(
      humanizeAiInsightText(parsedPayload.summary || ""),
    ) ||
    "A IA analisou os dados operacionais mais recentes da empresa.";
  const insights = (Array.isArray(parsedPayload.insights) ? parsedPayload.insights : [])
    .map((insight, index) => sanitizeAiInsightItem(insight, index))
    .filter(Boolean)
    .slice(0, 3);

  return {
    headline,
    summary,
    insights,
  };
};

const generateMyCompanyAiInsights = async ({ company, tickets, employees }) => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      status: 503,
      message: "Variável OPENAI_API_KEY não configurada para gerar insights da empresa.",
    };
  }

  const snapshot = buildCompanyAiSnapshot({ company, tickets, employees });

  if (snapshot.summary.totalTickets === 0) {
    return {
      status: 200,
      headline: "Ainda não há base operacional suficiente",
      summary:
        "Quando a empresa começar a receber tickets, a IA poderá apontar padrões de fila, satisfação e distribuição da equipe.",
      insights: [],
      generatedAt: new Date().toISOString(),
      model: OPENAI_COMPANY_INSIGHTS_MODEL,
      sourceData: {
        ticketsAnalyzed: 0,
        employeesAnalyzed: employees.length,
      },
    };
  }

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: OPENAI_COMPANY_INSIGHTS_MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "Você é um analista operacional do Resolve Mais.",
            "Sua tarefa é ler um snapshot de atendimento e devolver JSON puro em português do Brasil.",
            "Baseie-se apenas nos dados recebidos.",
            "Não invente métricas, causas, prazos ou comportamentos que não estejam no snapshot.",
            "Priorize leitura executiva, riscos, sinais de eficiência e oportunidades práticas.",
            "Nunca exponha nomes técnicos de campos, chaves camelCase ou labels internas do snapshot.",
            "Não escreva termos como averageRating, completionRate, totalTickets, createdToday, teamSize ou qualquer outro nome de propriedade.",
            "Traduza sempre os dados para linguagem natural, por exemplo: 'satisfação média', 'taxa de conclusão', 'tickets criados hoje' e 'total de tickets'.",
            "Se mencionar uma pessoa, escreva a conclusão em frase natural, sem colar o nome do campo ao lado do nome dela.",
            "Retorne exatamente este formato:",
            '{ "headline": "string", "summary": "string", "insights": [{ "title": "string", "tone": "success|warning|danger|neutral", "summary": "string", "evidence": ["string"], "recommendedAction": "string" }] }',
            "Gere no máximo 3 insights.",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify(snapshot, null, 2),
        },
      ],
    });

    const rawContent = completion?.choices?.[0]?.message?.content || "";
    const parsedInsights = parseCompanyAiInsights(rawContent);

    return {
      status: 200,
      ...parsedInsights,
      generatedAt: new Date().toISOString(),
      model: OPENAI_COMPANY_INSIGHTS_MODEL,
      sourceData: {
        ticketsAnalyzed: snapshot.summary.totalTickets,
        employeesAnalyzed: snapshot.summary.teamSize,
      },
    };
  } catch (error) {
    console.error("Erro ao gerar insights da empresa com IA:", error);

    return {
      status: 502,
      message:
        "Não foi possível gerar a leitura da IA para os insights da empresa agora.",
    };
  }
};

const getCompanyFromAdminUser = async (userId) => {
  const company = await companyRepository.getByAdminUserId(userId);
  return company || null;
};

const getCompanyAdmins = async (companyId, options = {}) => {
  const listOptions = normalizePeopleListOptions(options);
  const adminRoleFilter = normalizeAdminRoleFilter(options?.adminRole || options?.role);
  const repositoryOptions = {
    search: listOptions.search,
  };

  if (adminRoleFilter === "primary") {
    repositoryOptions.isPrimary = true;
  }

  if (adminRoleFilter === "secondary") {
    repositoryOptions.isPrimary = false;
  }

  if (listOptions.pagination) {
    repositoryOptions.limit = listOptions.pagination.limit;
    repositoryOptions.offset = listOptions.pagination.offset;
  }

  let adminsResult = await companyRepository.listAdmins(companyId, repositoryOptions);
  const total = extractListTotal(adminsResult);

  if (listOptions.pagination) {
    const totalPages = Math.max(1, Math.ceil(total / listOptions.pagination.pageSize));

    if (total > 0 && listOptions.pagination.page > totalPages) {
      listOptions.pagination = {
        ...listOptions.pagination,
        page: totalPages,
        offset: (totalPages - 1) * listOptions.pagination.pageSize,
      };
      adminsResult = await companyRepository.listAdmins(companyId, {
        ...repositoryOptions,
        offset: listOptions.pagination.offset,
      });
    }
  }

  const admins = extractListRows(adminsResult).map(formatAdminResponse);

  if (!listOptions.pagination) return admins;

  return {
    items: admins,
    pagination: buildPaginationResponse(listOptions.pagination, total),
  };
};

const normalizeAiProfileField = (value, fieldLabel) => {
  const normalizedValue = normalizeText(value);

  if (normalizedValue.length > MAX_AI_PROFILE_FIELD_LENGTH) {
    return {
      error: {
        status: 400,
        message: `${fieldLabel} deve ter no máximo ${MAX_AI_PROFILE_FIELD_LENGTH} caracteres`,
      },
    };
  }

  return { value: normalizedValue };
};

const getCompanyEmployees = async (companyId, options = {}) => {
  const listOptions = normalizePeopleListOptions(options);
  const repositoryOptions = {
    companyId,
    userType: USER_TYPES.FUNCIONARIO,
    search: listOptions.search,
  };

  if (listOptions.pagination) {
    repositoryOptions.limit = listOptions.pagination.limit;
    repositoryOptions.offset = listOptions.pagination.offset;
  }

  let employeesResult = await userRepository.listByCompanyAndType(repositoryOptions);
  const total = extractListTotal(employeesResult);

  if (listOptions.pagination) {
    const totalPages = Math.max(1, Math.ceil(total / listOptions.pagination.pageSize));

    if (total > 0 && listOptions.pagination.page > totalPages) {
      listOptions.pagination = {
        ...listOptions.pagination,
        page: totalPages,
        offset: (totalPages - 1) * listOptions.pagination.pageSize,
      };
      employeesResult = await userRepository.listByCompanyAndType({
        ...repositoryOptions,
        offset: listOptions.pagination.offset,
      });
    }
  }

  const employees = extractListRows(employeesResult);
  const formattedEmployees = employees.map((employee) => {
    const plainEmployee = toPlain(employee);

    return formatEmployeeResponse(plainEmployee);
  });

  if (!listOptions.pagination) return formattedEmployees;

  return {
    items: formattedEmployees,
    pagination: buildPaginationResponse(listOptions.pagination, total),
  };
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

const getMyCompanyAdmins = async (authUserId, listOptions = {}) => {
  const context = await getCompanyDataForAdmin(authUserId);
  if (context.error) return context.error;

  const adminsResult = await getCompanyAdmins(context.company.id, listOptions);
  const admins = Array.isArray(adminsResult) ? adminsResult : adminsResult.items;

  const response = {
    status: 200,
    company: formatCompanySnapshot(context.company, { includeAiSettings: true }),
    admins,
  };

  if (!Array.isArray(adminsResult) && adminsResult.pagination) {
    response.pagination = adminsResult.pagination;
  }

  return response;
};

const getMyCompanyEmployees = async (authUserId, listOptions = {}) => {
  const context = await getCompanyDataForAdmin(authUserId);
  if (context.error) return context.error;

  const employeesResult = await getCompanyEmployees(context.company.id, listOptions);
  const employees = Array.isArray(employeesResult) ? employeesResult : employeesResult.items;

  const response = {
    status: 200,
    company: formatCompanySnapshot(context.company, { includeAiSettings: true }),
    employees,
  };

  if (!Array.isArray(employeesResult) && employeesResult.pagination) {
    response.pagination = employeesResult.pagination;
  }

  return response;
};

const getMyCompanyAiInsights = async (authUserId) => {
  const context = await getCompanyDataForAdmin(authUserId);
  if (context.error) return context.error;

  const [rawTickets, employeesResult] = await Promise.all([
    ticketRepository.listByCompanyId({ companyId: context.company.id }),
    getCompanyEmployees(context.company.id),
  ]);
  const tickets = rawTickets.map((ticket) => toPlain(ticket));
  const employees = Array.isArray(employeesResult) ? employeesResult : [];

  return generateMyCompanyAiInsights({
    company: context.company,
    tickets,
    employees,
  });
};

const getMyCompanyComplaintTitles = async (authUserId) => {
  const context = await getCompanyDataForAdmin(authUserId);
  if (context.error) return context.error;

  const complaintTitles = await companyRepository.listComplaintTitles(context.company.id);

  return {
    status: 200,
    company: formatCompanySnapshot(context.company, { includeAiSettings: true }),
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

  const aiFieldMap = [
    ["aiContext", "Contexto da empresa"],
    ["aiInstructions", "Instruções da IA"],
    ["aiExamples", "Exemplos de atendimento"],
  ];

  for (const [fieldName, fieldLabel] of aiFieldMap) {
    if (payload?.[fieldName] === undefined) {
      continue;
    }

    const normalizedField = normalizeAiProfileField(payload[fieldName], fieldLabel);

    if (normalizedField.error) {
      return normalizedField.error;
    }

    updatePayload[fieldName] = normalizedField.value;
  }

  if (Object.keys(updatePayload).length === 0) {
    return { status: 400, message: "No company profile fields provided for update" };
  }

  await companyRepository.update(context.company.id, updatePayload);

  const company = await companyRepository.getById(context.company.id, {
    includeAiSettings: true,
  });

  return {
    status: 200,
    message: "Company profile updated successfully",
    company: formatCompanySnapshot(company, { includeAiSettings: true }),
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
    company: formatCompanySnapshot(context.company, { includeAiSettings: true }),
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
    company: formatCompanySnapshot(context.company, { includeAiSettings: true }),
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
    company: formatCompanySnapshot(context.company, { includeAiSettings: true }),
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
    company: formatCompanySnapshot(context.company, { includeAiSettings: true }),
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
    company: formatCompanySnapshot(context.company, { includeAiSettings: true }),
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
    company: formatCompanySnapshot(context.company, { includeAiSettings: true }),
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
    company: formatCompanySnapshot(context.company, { includeAiSettings: true }),
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
    company: formatCompanySnapshot(context.company, { includeAiSettings: true }),
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
  getMyCompanyAiInsights,
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
  getMyCompanyAiInsights,
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
