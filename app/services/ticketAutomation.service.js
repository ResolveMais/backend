import ticketService from "./ticket.service.js";

const ticketAutomationService = Object.freeze({
  id: "ticket-automation",
  description:
    "Disabled-by-default service for future ticket automation activation via scheduler or protected endpoint.",
  suggestedRoutePath: "/api/cron/ticket-automation",
  suggestedSchedule: "*/5 * * * *",
  requiredEnvVars: ["CRON_SECRET"],
  run: () => ticketService.runTicketAutomationCycle(),
});

export { ticketAutomationService };

export default ticketAutomationService;
