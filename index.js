require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require('http');
const { routesController } = require("./app/routes");
const errorHandler = require('./app/middlewares/errorHandler');
const SocketService = require('./app/services/socket.service');
const swaggerSetup = require('./swagger');

const app = express();
const server = http.createServer(app);


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));


const db = require('./app/models');
db.sequelize.sync();


routesController(app);


swaggerSetup(app);


new SocketService(server);


app.use(errorHandler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT} 🚀🚀`);
});

app.get('/', (req, res) => {
    res.json({
        name: 'SAC System API',
        version: '1.0.0',
        docs: `${req.protocol}://${req.get('host')}/api-docs`
    });
});


const fs = require('fs');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}