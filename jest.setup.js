import db from "./app/models/index.js";

afterAll(async () => {
  await db.sequelize.close();
});
