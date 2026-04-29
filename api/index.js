import app, { prepareApp } from "../index.js";

export default async function handler(req, res) {
  await prepareApp();
  return app(req, res);
}
