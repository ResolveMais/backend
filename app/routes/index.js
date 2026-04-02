import authRoute from "./auth.routes.js";
import chatbotRoute from "./chatbot.routes.js";
import companyRoute from "./company.routes.js";
import ticketRoute from "./ticket.routes.js";
import userRoute from "./user.routes.js";

const routes = [authRoute, chatbotRoute, companyRoute, ticketRoute, userRoute];

const routesController = (app) => {
  routes.forEach(({ alias, router }) => {
    app.use(alias, router);
  });
};

export { routesController };

export default { routesController };
