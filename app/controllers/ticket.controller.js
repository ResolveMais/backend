import ticketService from "../services/ticket.service.js";
import { registerTicketSubscriber, sendSseEvent } from "../utils/ticketRealtime.js";

const create = async (req, res) => {
  const response = await ticketService.createTicket({
    description: req.body?.description,
    userId: req.user?.id,
    companyId: req.body?.companyId,
    complaintTitleId: req.body?.complaintTitleId,
  });

  return res.status(response.status).json(response);
};

const getCompanies = async (req, res) => {
  const response = await ticketService.getCompanies();
  return res.status(response.status).json(response);
};

const getComplaintTitles = async (req, res) => {
  const response = await ticketService.getComplaintTitlesByCompany(req.params.companyId);
  return res.status(response.status).json(response);
};

const getUserTickets = async (req, res) => {
  const response = await ticketService.getUserTickets(req.user?.id);
  return res.status(response.status).json(response);
};

const getUserClosedTickets = async (req, res) => {
  const response = await ticketService.getUserClosedTickets(req.user?.id);
  return res.status(response.status).json(response);
};

const getUserOpenAndPendingTickets = async (req, res) => {
  const response = await ticketService.getUserOpenAndPendingTickets(req.user?.id);
  return res.status(response.status).json(response);
};

const getRecentUpdates = async (req, res) => {
  const response = await ticketService.getRecentUpdates(req.user?.id);
  return res.status(response.status).json(response);
};

const getWorkspace = async (req, res) => {
  const response = await ticketService.getWorkspaceTickets(req.user, { scope: req.query?.scope || "active" });
  return res.status(response.status).json(response);
};

const getUnreadMessageNotifications = async (req, res) => {
  const response = await ticketService.getUnreadMessageNotifications(req.user);
  return res.status(response.status).json(response);
};

const getTicketDetail = async (req, res) => {
  const response = await ticketService.getTicketDetail(req.user, req.params.ticketId);
  return res.status(response.status).json(response);
};

const getTicketMessages = async (req, res) => {
  const response = await ticketService.getTicketMessages(req.user, req.params.ticketId);
  return res.status(response.status).json(response);
};

const markMessagesAsRead = async (req, res) => {
  const response = await ticketService.markTicketMessagesAsRead(req.user, req.params.ticketId);
  return res.status(response.status).json(response);
};

const sendMessage = async (req, res) => {
  const response = await ticketService.sendTicketMessage(req.user, req.params.ticketId, req.body?.content);
  return res.status(response.status).json(response);
};

const acceptTicket = async (req, res) => {
  const response = await ticketService.acceptTicket(req.user, req.params.ticketId, req.body?.assignedUserId ?? null);
  return res.status(response.status).json(response);
};

const updateStatus = async (req, res) => {
  const response = await ticketService.updateTicketStatus(req.user, req.params.ticketId, req.body?.status);
  return res.status(response.status).json(response);
};

const updateAssignment = async (req, res) => {
  const response = await ticketService.updateTicketAssignment(req.user, req.params.ticketId, req.body?.assignedUserId ?? null);
  return res.status(response.status).json(response);
};

const getTicketLogs = async (req, res) => {
  const response = await ticketService.getTicketLogs(req.user, req.params.ticketId);
  return res.status(response.status).json(response);
};

const getCompanyLogs = async (req, res) => {
  const response = await ticketService.getCompanyLogs(req.user);
  return res.status(response.status).json(response);
};

const streamTicketEvents = async (req, res) => {
  const response = await ticketService.getTicketStreamContext(req.user, req.params.ticketId);

  if (response.status !== 200) return res.status(response.status).json(response);

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof res.flushHeaders === "function") res.flushHeaders();

  const cleanup = registerTicketSubscriber({
    ticketId: req.params.ticketId,
    userId: req.user.id,
    viewerType: response.context.viewerType,
    scope: response.context.scope,
    res,
  });

  sendSseEvent(res, "ticket_snapshot", { ticketId: Number(req.params.ticketId), ticket: response.ticket });

  req.on("close", cleanup);
  return undefined;
};

const TicketController = {
  acceptTicket,
  create,
  getCompanies,
  getCompanyLogs,
  getComplaintTitles,
  getRecentUpdates,
  getTicketDetail,
  getTicketLogs,
  getTicketMessages,
  getUnreadMessageNotifications,
  getUserClosedTickets,
  getUserOpenAndPendingTickets,
  getUserTickets,
  getWorkspace,
  markMessagesAsRead,
  sendMessage,
  streamTicketEvents,
  updateAssignment,
  updateStatus,
};

export default TicketController;
