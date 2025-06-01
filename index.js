require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { routesController } = require("./app/routes");

const app = express();

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const db = require('./app/models');
db.sequelize.sync();

routesController(app);

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT} 🚀🚀`);
});
