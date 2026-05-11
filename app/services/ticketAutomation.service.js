import chatbotRepository from "../repositories/chatbot.repository.js";
import ticketRepository from "../repositories/ticket.repository.js";
import { sendTicketPendingReplyEmail } from "../utils/mailer.js";
import { broadcastTicketEvent } from "../utils/ticketRealtime.js";
import {
  TICKET_LOG_TYPE,
  TICKET_MESSAGE_SENDER,
  TICKET_STATUS,
} from "../utils/ticketStatus.js";
import db from "../models/index.js";
import {
  createSystemMessageForTicket,
  formatTicket,
  formatUserSummary,
  getCompanyRecipientsForMessage,
  getMessageSenderName,
  toPlain,
} from "./ticket.service.js";

const { sequelize } = db;

const autoCloseInactiveTickets = async () => {
  try {
    const cutoffDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const inactiveTickets = await ticketRepository.listInactiveOpenTickets({
      cutoffDate,
    });
    let closedTicketsCount = 0;

    for (const inactiveTicket of inactiveTickets) {
      const plainTicket = toPlain(inactiveTicket);
      const now = new Date();

      await sequelize.transaction(async (transaction) => {
        await ticketRepository.updateTicketById(
          plainTicket.id,
          {
            status: TICKET_STATUS.FECHADO,
            closedAt: now,
            autoClosedAt: now,
            updatedAt: now,
          },
          { transaction }
        );

        await ticketRepository.createUpdate({
          ticketId: plainTicket.id,
          message: "Ticket fechado automaticamente por 2 dias sem interação.",
          type: TICKET_LOG_TYPE.AUTOMATION,
          statusFrom: plainTicket.status,
          statusTo: TICKET_STATUS.FECHADO,
          touchInteraction: false,
          transaction,
        });

        await createSystemMessageForTicket({
          ticket: inactiveTicket,
          content:
            "Este ticket foi fechado automaticamente por falta de interação durante 2 dias.",
          transaction,
        });
      });

      broadcastTicketEvent(plainTicket.id, "status_changed", {
        ticketId: plainTicket.id,
        status: TICKET_STATUS.FECHADO,
      });
      closedTicketsCount += 1;
    }

    return {
      inactiveTicketsFound: inactiveTickets.length,
      closedTicketsCount,
    };
  } catch (error) {
    console.error("Erro ao fechar tickets inativos automaticamente:", error);
    throw error;
  }
};

const sendDelayedReplyReminders = async () => {
  try {
    const cutoffDate = new Date(Date.now() - 5 * 60 * 1000);
    const messages = await chatbotRepository.listMessagesPendingReminder({
      cutoffDate,
    });
    let deliveredMessagesCount = 0;
    let partiallyDeliveredMessagesCount = 0;
    let messagesWithoutRecipientsCount = 0;
    let failedMessagesCount = 0;

    console.log(
      `Encontradas ${messages.length} mensagens pendentes de resposta para envio de lembretes.`
    );

    for (const message of messages) {
      const plainMessage = toPlain(message);
      const ticket = plainMessage?.conversation?.ticket;

      if (!ticket) continue;

      const senderType = plainMessage.senderType || plainMessage.sender_type;
      const senderName = getMessageSenderName({
        senderType,
        senderName: plainMessage.senderName || plainMessage.sender_name,
        senderUser: plainMessage.senderUser,
      });

      let recipients = [];
      let waitingFor = "uma resposta";

      if (senderType === TICKET_MESSAGE_SENDER.CLIENTE) {
        waitingFor = "retorno da empresa";
        recipients = await getCompanyRecipientsForMessage(
          { companyId: ticket.company_id || ticket.empresa?.id },
          formatTicket(ticket)
        );
      } else {
        waitingFor = "retorno do cliente";
        recipients = [formatUserSummary(ticket.cliente)].filter((recipient) => recipient?.email);
      }

      if (recipients.length === 0) {
        messagesWithoutRecipientsCount += 1;
        continue;
      }

      let deliveredRecipientsCount = 0;

      for (const recipient of recipients) {
        const reminderDelivered = await sendTicketPendingReplyEmail({
          to: recipient.email,
          recipientName: recipient.name,
          senderName,
          companyName: ticket.empresa?.name,
          ticketId: ticket.id,
          subjectTitle: ticket.tituloReclamacao?.title,
          waitingFor,
        });

        if (reminderDelivered) {
          deliveredRecipientsCount += 1;
        }
      }

      if (deliveredRecipientsCount === 0) {
        failedMessagesCount += 1;
        console.warn(
          `Nenhum lembrete de resposta foi entregue para a mensagem ${plainMessage.id}. O envio permanecerá pendente para nova tentativa.`
        );
        continue;
      }

      if (deliveredRecipientsCount < recipients.length) {
        partiallyDeliveredMessagesCount += 1;
        console.warn(
          `Lembrete da mensagem ${plainMessage.id} entregue parcialmente (${deliveredRecipientsCount}/${recipients.length}). Marcando como enviado porque ao menos um destinatário foi notificado.`
        );
      }

      await chatbotRepository.markReminderSent({
        messageId: plainMessage.id,
      });
      deliveredMessagesCount += 1;
    }

    return {
      pendingMessagesFound: messages.length,
      deliveredMessagesCount,
      partiallyDeliveredMessagesCount,
      messagesWithoutRecipientsCount,
      failedMessagesCount,
    };
  } catch (error) {
    console.error("Erro ao enviar lembretes de resposta:", error);
    throw error;
  }
};

const runTicketAutomationCycle = async () => {
  const closedTicketsSummary = await autoCloseInactiveTickets();
  const remindersSummary = await sendDelayedReplyReminders();

  return {
    executedAt: new Date().toISOString(),
    ...closedTicketsSummary,
    ...remindersSummary,
  };
};

const ticketAutomationService = Object.freeze({
  id: "ticket-automation",
  description:
    "Disabled-by-default service for future ticket automation activation via scheduler or protected endpoint.",
  suggestedRoutePath: "/api/cron/ticket-automation",
  suggestedSchedule: "*/5 * * * *",
  requiredEnvVars: ["CRON_SECRET"],
  autoCloseInactiveTickets,
  sendDelayedReplyReminders,
  run: runTicketAutomationCycle,
  runTicketAutomationCycle,
});

export {
  autoCloseInactiveTickets,
  runTicketAutomationCycle,
  sendDelayedReplyReminders,
  ticketAutomationService,
};

export default ticketAutomationService;
