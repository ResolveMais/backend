import "dotenv/config";
import cors from "cors";
import express from "express";
import { routesController } from "./app/routes/index.js";
import db from "./app/models/index.js";

const { initializeDatabase } = db;

const app = express();
const port = process.env.PORT || 3001;
const corsOriginsEnv = process.env.CORS_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS || "";
const allowedOrigins = corsOriginsEnv
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) return callback(null, true);

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(async (_req, res, next) => {
  try {
    await initializeDatabase();
    next();
  } catch (error) {
    console.error("Database initialization failed during request:", error);
    res.status(500).json({ message: "Database initialization failed." });
  }
});

routesController(app);

app.get("/", (_req, res) => {
  res.send("Hello World!");
});

const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(port, () => console.log(`Server is running on port ${port}`));
  } catch (error) {
    console.error("Server startup aborted due to database initialization failure:", error);
    process.exit(1);
  }
};

export default app;
export const prepareApp = async () => {
  await initializeDatabase();
  return app;
};

if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  startServer();
}

export const startServerForTest = startServer;
