import nodemailer from "nodemailer";

let transporter = null;

const getMailConfig = () => {
  const host = process.env.SMTP_HOST || "";
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const from = process.env.MAIL_FROM || "";

  return {
    host,
    port,
    user,
    pass,
    from,
    secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
  };
};

const isMailerConfigured = () => {
  const config = getMailConfig();
  return Boolean(config.host && config.port && config.user && config.pass);
};

const getTransporter = () => {
  if (transporter) return transporter;

  const config = getMailConfig();

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  return transporter;
};

const sendPasswordResetEmail = async ({ to, name, resetUrl, expiresInMinutes }) => {
  if (!isMailerConfigured()) {
    console.warn("SMTP settings are missing. Password reset e-mail not sent.");
    return false;
  }

  const config = getMailConfig();
  const safeName = String(name || "").trim() || "usuario";

  await getTransporter()
    .sendMail({
      from: config.from,
      to,
      subject: "Recuperação de senha - Resolve Mais",
      text: [
        `Olá, ${safeName}.`,
        "",
        "Recebemos uma solicitação para redefinir sua senha.",
        `Use o link abaixo para criar uma nova senha (válido por ${expiresInMinutes} minutos):`,
        resetUrl,
        "",
        "Se você não solicitou esta alteração, ignore este e-mail.",
      ].join("\n"),
      html: `
    <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">
      <table align="center" width="100%" max-width="500px" style="background: #ffffff; border-radius: 10px; padding: 20px;">
        <tr>
          <td align="center">
            <h2 style="color: #00C853; margin-bottom: 10px;">Resolve Mais</h2>
            <p style="color: #333; font-size: 16px;">Olá, ${safeName}.</p>
          </td>
        </tr>

        <tr>
          <td>
            <p style="color: #555; font-size: 14px;">
              Recebemos uma solicitação para redefinir sua senha.
            </p>

            <p style="color: #555; font-size: 14px;">
              Clique no botão abaixo para criar uma nova senha.
              Este link é válido por <strong>${expiresInMinutes} minutos</strong>.
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}"
                style="
                  background-color: #00C853;
                  color: #ffffff;
                  padding: 12px 20px;
                  text-decoration: none;
                  border-radius: 6px;
                  font-weight: bold;
                  display: inline-block;
                ">
                Redefinir senha
              </a>
            </div>

            <p style="color: #999; font-size: 12px;">
              Se você não solicitou esta alteração, pode ignorar este e-mail com segurança.
            </p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />

            <p style="color: #bbb; font-size: 11px; text-align: center;">
              © ${new Date().getFullYear()} Resolve Mais
            </p>
          </td>
        </tr>
      </table>
    </div>
  `,
    })
    .then(() => {
      console.log(`Password reset email sent to ${to}`);
    })
    .catch((error) => {
      console.error(`Error sending password reset email to ${to}: ${error.message}`);
    });

  return true;
};

const sendTicketPendingReplyEmail = async ({
  to,
  recipientName,
  senderName,
  companyName,
  ticketId,
  subjectTitle,
  waitingFor,
}) => {
  if (!isMailerConfigured()) {
    console.warn("SMTP settings are missing. Ticket reminder e-mail not sent.");
    return false;
  }

  const config = getMailConfig();
  const safeRecipientName = String(recipientName || "").trim() || "usuario";
  const safeSenderName = String(senderName || "").trim() || "Atendimento Resolve Mais";
  const safeCompanyName = String(companyName || "").trim() || "Resolve Mais";
  const safeSubjectTitle = String(subjectTitle || "").trim() || "Atendimento";
  const safeWaitingFor = String(waitingFor || "").trim() || "uma resposta";
  const protocol = `3330${String(ticketId || "").padStart(4, "0")}`;

  await getTransporter()
    .sendMail({
      from: config.from,
      to,
      subject: `Nova mensagem aguardando resposta - Ticket ${protocol}`,
      text: [
        `Olá, ${safeRecipientName}.`,
        "",
        `Uma nova mensagem foi enviada por ${safeSenderName} no ticket ${protocol}.`,
        `Empresa: ${safeCompanyName}.`,
        `Assunto: ${safeSubjectTitle}.`,
        `No momento, o atendimento está aguardando ${safeWaitingFor}.`,
        "",
        "Acesse a plataforma para continuar a conversa.",
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">
          <table align="center" width="100%" max-width="560px" style="background: #ffffff; border-radius: 10px; padding: 24px;">
            <tr>
              <td align="center">
                <h2 style="color: #00C853; margin-bottom: 8px;">Resolve Mais</h2>
                <p style="color: #333; font-size: 16px;">Olá, ${safeRecipientName}.</p>
              </td>
            </tr>
            <tr>
              <td>
                <p style="color: #555; font-size: 14px; line-height: 1.6;">
                  Uma nova mensagem foi enviada por <strong>${safeSenderName}</strong> no ticket
                  <strong>${protocol}</strong>.
                </p>

                <div style="margin: 18px 0; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 6px; color: #111827;"><strong>Empresa:</strong> ${safeCompanyName}</p>
                  <p style="margin: 0 0 6px; color: #111827;"><strong>Assunto:</strong> ${safeSubjectTitle}</p>
                  <p style="margin: 0; color: #111827;"><strong>Aguardando:</strong> ${safeWaitingFor}</p>
                </div>

                <p style="color: #555; font-size: 14px; line-height: 1.6;">
                  Acesse a plataforma para visualizar a conversa e dar continuidade ao atendimento.
                </p>
              </td>
            </tr>
          </table>
        </div>
      `,
    })
    .then(() => {
      console.log(`Ticket reminder email sent to ${to}`);
    })
    .catch((error) => {
      console.error(`Error sending ticket reminder email to ${to}: ${error.message}`);
    });

  return true;
};

export { isMailerConfigured, sendPasswordResetEmail, sendTicketPendingReplyEmail };

export default {
  isMailerConfigured,
  sendPasswordResetEmail,
  sendTicketPendingReplyEmail,
};
