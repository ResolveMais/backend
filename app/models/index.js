import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Sequelize } from "sequelize";
import dbConfig from "../config/db.config.js";
import { ensureApplicationSchema } from "../utils/schemaBootstrap.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
  host: dbConfig.HOST,
  dialect: dbConfig.dialect,
  port: dbConfig.PORT,
  logging: false,
  dialectOptions: {
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  },
});

const getModelFiles = (directoryPath) => {
  return fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        return getModelFiles(entryPath);
      }

      return entry.name.endsWith(".model.js") ? [entryPath] : [];
    })
    .sort();
};

const modelFiles = getModelFiles(__dirname);

const modelEntries = await Promise.all(
  modelFiles.map(async (modelFilePath) => {
    const modelModule = await import(pathToFileURL(modelFilePath).href);
    const initModel = modelModule.default;

    if (typeof initModel !== "function") {
      throw new Error(
        `The file "${path.basename(modelFilePath)}" does not export a default model initializer function.`
      );
    }

    const model = initModel(sequelize, Sequelize.DataTypes);

    if (!model?.name) {
      throw new Error(
        `The model initialized from "${path.basename(modelFilePath)}" does not have a valid name.`
      );
    }

    return [model.name, model];
  })
);

const db = {
  Sequelize,
  sequelize,
  ...Object.fromEntries(modelEntries),
};

Object.values(db).forEach((model) => {
  if (typeof model?.associate === "function") {
    model.associate(db);
  }
});

const databaseReady = (async () => {
  try {
    await sequelize.authenticate();
    console.log("Connection has been established successfully.");

    if (process.env.DB_SYNC_ON_BOOT === "true") {
      const syncOptions =
        process.env.DB_SYNC_ALTER === "true" ? { alter: true } : undefined;

      console.log(
        `DB_SYNC_ON_BOOT=true, running sequelize.sync(${syncOptions ? "alter" : "default"})`
      );

      await sequelize.sync(syncOptions);
      await ensureApplicationSchema({ sequelize, models: db });
      return;
    }

    console.log("Database sync skipped.");
  } catch (err) {
    console.log("Database connection is not working!", err);
    throw err;
  }
})();

export { Sequelize, sequelize, databaseReady };

export default db;
