import { describe, expect, test } from "@jest/globals";
import {
  ACTIVE_TICKET_STATUSES,
  CLOSED_TICKET_STATUSES,
  TICKET_LOG_TYPE,
  TICKET_STATUS,
  isActiveTicketStatus,
  isClosedTicketStatus,
  normalizeTicketLogTypeForPersistence,
  normalizeTicketStatus,
} from "../../../app/utils/ticketStatus.js";

describe("app/utils/ticketStatus", () => {
  test("normalizeTicketStatus maps the legacy finalizado status to fechado", () => {
    expect(normalizeTicketStatus(" FINALIZADO ")).toBe(TICKET_STATUS.FECHADO);
  });

  test("isClosedTicketStatus and isActiveTicketStatus classify normalized values", () => {
    expect(isClosedTicketStatus("fechado")).toBe(true);
    expect(isClosedTicketStatus("finalizado")).toBe(true);
    expect(isActiveTicketStatus(" pendente ")).toBe(true);
    expect(isActiveTicketStatus("desconhecido")).toBe(false);
  });

  test("normalizeTicketLogTypeForPersistence keeps legacy values and folds new ones", () => {
    expect(normalizeTicketLogTypeForPersistence(TICKET_LOG_TYPE.MESSAGE)).toBe(
      TICKET_LOG_TYPE.RESPONSE
    );
    expect(normalizeTicketLogTypeForPersistence(TICKET_LOG_TYPE.RESOLUTION)).toBe(
      TICKET_LOG_TYPE.STATUS_CHANGE
    );
    expect(normalizeTicketLogTypeForPersistence(TICKET_LOG_TYPE.AUTOMATION)).toBe(
      TICKET_LOG_TYPE.CLOSURE
    );
    expect(normalizeTicketLogTypeForPersistence("")).toBe(
      TICKET_LOG_TYPE.STATUS_CHANGE
    );
  });

  test("the exported status groups stay aligned with the workflow rules", () => {
    expect(ACTIVE_TICKET_STATUSES).toEqual([
      TICKET_STATUS.ABERTO,
      TICKET_STATUS.PENDENTE,
      TICKET_STATUS.RESOLVIDO,
    ]);
    expect(CLOSED_TICKET_STATUSES).toEqual([
      TICKET_STATUS.FECHADO,
      TICKET_STATUS.FINALIZADO_LEGACY,
    ]);
  });
});
