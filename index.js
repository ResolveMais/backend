import "dotenv/config";
import cors from "cors";
import express from "express";
import { routesController } from "./app/routes/index.js";
import ticketService from "./app/services/ticket.service.js";
import db from "./app/models/index.js";

const { initializeDatabase } = db;

const app = express();
const port = process.env.PORT || 3001;
const automationIntervalMs = Number(process.env.TICKET_AUTOMATION_INTERVAL_MS || 60000);

const alowedOrigins = process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(", ") : [];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || alowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error("CORS blocked for origin: " + origin));
  }
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

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

  setInterval(async () => {
    try {
      await ticketService.runTicketAutomationCycle();
    } catch (error) {
      console.error("Ticket automation cycle failed:", error);
    }
  }, automationIntervalMs);
}

const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(port, () => console.log(`Server is running on port ${port}`));
    startTicketAutomation();
  } catch (error) {
    console.error("Server startup aborted due to database initialization failure:", error);
    process.exit(1);
  }
};

// ==============================================
// 👇 1. ADICIONAR: Exportar o app para os testes
// ==============================================
export default app;

// ==============================================
// 👇 2. MODIFICAR: Só inicia o servidor se NÃO for teste
// ==============================================
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

// ==============================================
// 👇 3. ADICIONAR (opcional): Função para testes iniciarem manualmente
// ==============================================
export const startServerForTest = startServer;
