import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

const createResponse = () => ({
  write: jest.fn(() => true),
  end: jest.fn(),
});

describe("app/utils/ticketRealtime", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("registerTicketSubscriber publishes the connection event and keeps a heartbeat alive", async () => {
    const realtime = await import("../../../app/utils/ticketRealtime.js");
    const res = createResponse();

    const unregister = realtime.registerTicketSubscriber({
      ticketId: 15,
      userId: 21,
      viewerType: "customer",
      res,
    });

    expect(res.write).toHaveBeenCalledWith("event: connected\n");
    expect(res.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({ ticketId: 15, viewerType: "customer" })}\n\n`
    );
    expect(
      realtime.hasViewerTypeConnected({ ticketId: 15, viewerType: "customer" })
    ).toBe(true);

    jest.advanceTimersByTime(25000);

    expect(res.write).toHaveBeenCalledWith("event: ping\n");

    unregister();

    expect(
      realtime.hasViewerTypeConnected({ ticketId: 15, viewerType: "customer" })
    ).toBe(false);
  });

  test("broadcastTicketEvent disconnects employees who lose access to the ticket", async () => {
    const realtime = await import("../../../app/utils/ticketRealtime.js");
    const blockedRes = createResponse();
    const allowedRes = createResponse();

    realtime.registerTicketSubscriber({
      ticketId: 88,
      userId: 10,
      viewerType: "company",
      scope: "employee",
      res: blockedRes,
    });
    realtime.registerTicketSubscriber({
      ticketId: 88,
      userId: 11,
      viewerType: "company",
      scope: "employee",
      res: allowedRes,
    });

    realtime.broadcastTicketEvent(88, "ticket_updated", {
      ticketId: 88,
      ticket: {
        id: 88,
        status: "pendente",
        assignedEmployee: { id: 11 },
      },
    });

    expect(blockedRes.write).toHaveBeenCalledWith("event: error\n");
    expect(blockedRes.end).toHaveBeenCalled();
    expect(allowedRes.write).toHaveBeenCalledWith("event: ticket_updated\n");
    expect(
      realtime.hasViewerTypeConnected({
        ticketId: 88,
        viewerType: "company",
        excludeUserId: 11,
      })
    ).toBe(false);
  });
});
