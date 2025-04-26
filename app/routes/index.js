const fs = require("fs");
const path = require("path");

const routesController = (app) => {
    const currentDirectoryPath = path.join(__dirname);
    const files = fs.readdirSync(currentDirectoryPath);
    const routeFiles = files.filter((file) => file.endsWith(".routes.js"));
    routeFiles.forEach((file) => {
        const route = require(path.join(currentDirectoryPath, file));
        app.use(route.alias, route.router);
    });
};

module.exports = { routesController };
