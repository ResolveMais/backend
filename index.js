import "dotenv/config";
import cors from "cors";
import express from "express";
import { routesController } from "./app/routes/index.js";
import "./app/models/index.js";

const app = express();

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

routesController(app);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
