import "dotenv/config";
import cors from "cors";
import express from "express";
import { routesController } from "./app/routes/index.js";
import ticketService from "./app/services/ticket.service.js";
import db from "./app/models/index.js";

const { databaseReady } = db;

const app = express();
const port = process.env.PORT || 3001;
const automationIntervalMs = Number(process.env.TICKET_AUTOMATION_INTERVAL_MS || 60000);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

routesController(app);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// Função para iniciar a automação de tickets em intervalos regulares
const startTicketAutomation = () => {
  if (!Number.isFinite(automationIntervalMs) || automationIntervalMs <= 0) return;

  // Executar o ciclo de automação de tickets imediatamente ao iniciar o servidor
  setInterval(async () => {
    try {
      // Executar o ciclo de automação de tickets e aguardar sua conclusão antes de iniciar o próximo ciclo
      await ticketService.runTicketAutomationCycle();
    } catch (error) {
      console.error("Ticket automation cycle failed:", error);
    }
  }, automationIntervalMs);
}

const startServer = async () => {
  try {
    // Garantir que a inicialização do banco de dados seja concluída antes de iniciar o servidor
    await databaseReady;

    // Iniciar o servidor somente após a confirmação de que o banco de dados está pronto
    app.listen(port, () => console.log(`Server is running on port ${port}`));

    // Iniciar a automação de tickets após o servidor estar rodando
    startTicketAutomation();
  } catch (error) {
    console.error("Server startup aborted due to database initialization failure:", error);
    process.exit(1);
  }
};

// Iniciar o servidor
startServer();