import { TICKET_STATUS, normalizeTicketStatus } from "./ticketStatus.js";

const HEARTBEAT_INTERVAL_MS = 25000;

const subscriptionsByTicketId = new Map();

const sendSseEvent = (res, eventName, payload) => {
  try {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    return true;
  } catch (error) {
    return false;
  }
};

const getBucket = (ticketId) => {
  const key = String(ticketId);

  if (!subscriptionsByTicketId.has(key)) {
    subscriptionsByTicketId.set(key, new Set());
  }

  return subscriptionsByTicketId.get(key);
};

const cleanupBucketIfNeeded = (ticketId) => {
  const key = String(ticketId);
  const bucket = subscriptionsByTicketId.get(key);

  if (bucket && bucket.size === 0) {
    subscriptionsByTicketId.delete(key);
  }
};

const unregisterTicketSubscriber = ({ ticketId, subscription }) => {
  if (!subscription) return;

  if (subscription.heartbeat) {
    clearInterval(subscription.heartbeat);
  }

  const bucket = subscriptionsByTicketId.get(String(ticketId));

  if (!bucket) return;

  bucket.delete(subscription);
  cleanupBucketIfNeeded(ticketId);
};

const registerTicketSubscriber = ({
  ticketId,
  userId,
  viewerType,
  scope = null,
  res,
}) => {
  const subscription = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    userId,
    viewerType,
    scope,
    res,
    heartbeat: null,
  };

  const bucket = getBucket(ticketId);
  bucket.add(subscription);

  sendSseEvent(res, "connected", {
    ticketId: Number(ticketId),
    viewerType,
  });

  subscription.heartbeat = setInterval(() => {
    const keepAlive = sendSseEvent(res, "ping", {
      ticketId: Number(ticketId),
      at: new Date().toISOString(),
    });

    if (!keepAlive) {
      unregisterTicketSubscriber({ ticketId, subscription });
    }
  }, HEARTBEAT_INTERVAL_MS);

  return () => unregisterTicketSubscriber({ ticketId, subscription });
};

const hasViewerTypeConnected = ({ ticketId, viewerType, excludeUserId = null }) => {
  const bucket = subscriptionsByTicketId.get(String(ticketId));

  if (!bucket || bucket.size === 0) return false;

  return Array.from(bucket).some((subscription) => {
    if (subscription.viewerType !== viewerType) return false;
    if (excludeUserId && Number(subscription.userId) === Number(excludeUserId)) {
      return false;
    }
    return true;
  });
};

const canSubscriptionViewTicket = ({ subscription, ticket }) => {
  if (!subscription || !ticket) return true;
  if (subscription.viewerType !== "company") return true;
  if (subscription.scope !== "employee") return true;

  const normalizedStatus = normalizeTicketStatus(ticket.status);

  if (normalizedStatus === TICKET_STATUS.ABERTO) {
    return true;
  }

  return Number(ticket.assignedEmployee?.id || 0) === Number(subscription.userId || 0);
};

const broadcastTicketEvent = (ticketId, eventName, payload) => {
  const bucket = subscriptionsByTicketId.get(String(ticketId));

  if (!bucket || bucket.size === 0) return;

  Array.from(bucket).forEach((subscription) => {
    if (payload?.ticket && !canSubscriptionViewTicket({ subscription, ticket: payload.ticket })) {
      sendSseEvent(subscription.res, "error", {
        ticketId: Number(ticketId),
        message: "Este ticket nao esta mais disponivel para o seu perfil.",
      });
      if (typeof subscription.res?.end === "function") {
        try {
          subscription.res.end();
        } catch (error) {
          // noop
        }
      }
      unregisterTicketSubscriber({ ticketId, subscription });
      return;
    }

    const sent = sendSseEvent(subscription.res, eventName, payload);

    if (!sent) {
      unregisterTicketSubscriber({ ticketId, subscription });
    }
  });
};

export {
  broadcastTicketEvent,
  hasViewerTypeConnected,
  registerTicketSubscriber,
  sendSseEvent,
  unregisterTicketSubscriber,
};
