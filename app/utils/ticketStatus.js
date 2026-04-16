const TICKET_STATUS = Object.freeze({
  ABERTO: "aberto",
  PENDENTE: "pendente",
  RESOLVIDO: "resolvido",
  FECHADO: "fechado",
  FINALIZADO_LEGACY: "finalizado",
});

const TICKET_MESSAGE_SENDER = Object.freeze({
  CLIENTE: "cliente",
  FUNCIONARIO: "funcionario",
  EMPRESA: "empresa",
  BOT: "bot",
  SISTEMA: "sistema",
});

const TICKET_VIEWER_TYPE = Object.freeze({
  CUSTOMER: "customer",
  COMPANY: "company",
});

const TICKET_LOG_TYPE = Object.freeze({
  CREATION: "creation",
  STATUS_CHANGE: "status_change",
  RESPONSE: "response",
  ASSIGNMENT: "assignment",
  ACCEPTANCE: "acceptance",
  MESSAGE: "message",
  RESOLUTION: "resolution",
  CLOSURE: "closure",
  REOPENED: "reopened",
  AUTOMATION: "automation",
});

const LEGACY_TICKET_LOG_TYPES = Object.freeze([
  TICKET_LOG_TYPE.CREATION,
  TICKET_LOG_TYPE.STATUS_CHANGE,
  TICKET_LOG_TYPE.RESPONSE,
  TICKET_LOG_TYPE.CLOSURE,
]);

const CLOSED_TICKET_STATUSES = Object.freeze([
  TICKET_STATUS.FECHADO,
  TICKET_STATUS.FINALIZADO_LEGACY,
]);

const ACTIVE_TICKET_STATUSES = Object.freeze([
  TICKET_STATUS.ABERTO,
  TICKET_STATUS.PENDENTE,
  TICKET_STATUS.RESOLVIDO,
]);

const normalizeTicketStatus = (status) => {
  const normalized = String(status || "").trim().toLowerCase();

  if (normalized === TICKET_STATUS.FINALIZADO_LEGACY) {
    return TICKET_STATUS.FECHADO;
  }

  return normalized;
};

const isClosedTicketStatus = (status) =>
  CLOSED_TICKET_STATUSES.includes(normalizeTicketStatus(status));

const isActiveTicketStatus = (status) =>
  ACTIVE_TICKET_STATUSES.includes(normalizeTicketStatus(status));

const normalizeTicketLogTypeForPersistence = (type) => {
  const normalizedType = String(type || "").trim().toLowerCase();

  if (!normalizedType) {
    return TICKET_LOG_TYPE.STATUS_CHANGE;
  }

  if (LEGACY_TICKET_LOG_TYPES.includes(normalizedType)) {
    return normalizedType;
  }

  if (
    [
      TICKET_LOG_TYPE.MESSAGE,
      TICKET_LOG_TYPE.ACCEPTANCE,
      TICKET_LOG_TYPE.ASSIGNMENT,
    ].includes(normalizedType)
  ) {
    return TICKET_LOG_TYPE.RESPONSE;
  }

  if (
    [
      TICKET_LOG_TYPE.RESOLUTION,
      TICKET_LOG_TYPE.REOPENED,
    ].includes(normalizedType)
  ) {
    return TICKET_LOG_TYPE.STATUS_CHANGE;
  }

  if (
    [
      TICKET_LOG_TYPE.AUTOMATION,
      TICKET_LOG_TYPE.CLOSURE,
    ].includes(normalizedType)
  ) {
    return TICKET_LOG_TYPE.CLOSURE;
  }

  return TICKET_LOG_TYPE.STATUS_CHANGE;
};

export {
  ACTIVE_TICKET_STATUSES,
  CLOSED_TICKET_STATUSES,
  LEGACY_TICKET_LOG_TYPES,
  TICKET_LOG_TYPE,
  TICKET_MESSAGE_SENDER,
  TICKET_STATUS,
  TICKET_VIEWER_TYPE,
  isActiveTicketStatus,
  isClosedTicketStatus,
  normalizeTicketLogTypeForPersistence,
  normalizeTicketStatus,
};
