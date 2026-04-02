import { Sequelize } from "sequelize";
import dbConfig from "../config/db.config.js";
import initChatConversationModel from "./chatConversation.model.js";
import initChatMessageModel from "./chatMessage.model.js";
import initCompanyAdminModel from "./companyAdmin.model.js";
import initCompanyModel from "./company.model.js";
import initComplaintTitleModel from "./complaintTitle.model.js";
import initEmployeeModel from "./employee.model.js";
import initPasswordResetTokenModel from "./passwordResetToken.model.js";
import initRoleModel from "./role.model.js";
import initTicketAssignmentModel from "./ticketAssignment.model.js";
import initTicketModel from "./ticket.model.js";
import initTicketUpdateModel from "./ticketUpdate.model.js";
import initUserModel from "./user.model.js";

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

sequelize
  .authenticate()
  .then(() => {
    console.log("Connection has been established successfully.");
    if (process.env.DB_SYNC_ON_BOOT === "true") {
      console.log("DB_SYNC_ON_BOOT=true, running sequelize.sync()");
      sequelize.sync();
      return;
    }

    console.log("Database sync skipped.");
  })
  .catch((err) => {
    console.log("Database connection is not working!", err);
  });

const ComplaintTitle = initComplaintTitleModel(sequelize, Sequelize.DataTypes);
const CompanyAdmin = initCompanyAdminModel(sequelize, Sequelize.DataTypes);
const Company = initCompanyModel(sequelize, Sequelize.DataTypes);
const ChatConversation = initChatConversationModel(sequelize, Sequelize.DataTypes);
const ChatMessage = initChatMessageModel(sequelize, Sequelize.DataTypes);
const Employee = initEmployeeModel(sequelize, Sequelize.DataTypes);
const PasswordResetToken = initPasswordResetTokenModel(
  sequelize,
  Sequelize.DataTypes
);
const Role = initRoleModel(sequelize, Sequelize.DataTypes);
const TicketAssignment = initTicketAssignmentModel(sequelize, Sequelize.DataTypes);
const Ticket = initTicketModel(sequelize, Sequelize.DataTypes);
const TicketUpdate = initTicketUpdateModel(sequelize, Sequelize.DataTypes);
const User = initUserModel(sequelize, Sequelize.DataTypes);

const db = {
  Sequelize,
  sequelize,
  ComplaintTitle,
  CompanyAdmin,
  Company,
  ChatConversation,
  ChatMessage,
  Employee,
  PasswordResetToken,
  Role,
  TicketAssignment,
  Ticket,
  TicketUpdate,
  User,
};

Object.values(db).forEach((model) => {
  if (typeof model?.associate === "function") {
    model.associate(db);
  }
});

export {
  Sequelize,
  sequelize,
  ComplaintTitle,
  CompanyAdmin,
  Company,
  ChatConversation,
  ChatMessage,
  Employee,
  PasswordResetToken,
  Role,
  TicketAssignment,
  Ticket,
  TicketUpdate,
  User,
};

export default db;
