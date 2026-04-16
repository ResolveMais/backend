const resolveTableName = (model) => {
  if (!model) return null;

  const tableName =
    typeof model.getTableName === "function"
      ? model.getTableName()
      : model.tableName || model.name || null;

  if (!tableName) return null;
  if (typeof tableName === "string") return tableName;
  if (typeof tableName === "object" && tableName.tableName) {
    return tableName.tableName;
  }

  return String(tableName);
};

const buildColumnDefinition = (attribute) => {
  const definition = {
    type: attribute.type,
    allowNull: attribute.allowNull !== undefined ? attribute.allowNull : true,
  };

  if (Object.prototype.hasOwnProperty.call(attribute, "defaultValue")) {
    definition.defaultValue = attribute.defaultValue;
  }

  return definition;
};

const ensureModelColumns = async ({ sequelize, model, attributeNames }) => {
  const tableName = resolveTableName(model);

  if (!tableName || !Array.isArray(attributeNames) || attributeNames.length === 0) {
    return [];
  }

  const queryInterface = sequelize.getQueryInterface();
  const existingColumns = await queryInterface.describeTable(tableName);
  const addedColumns = [];

  for (const attributeName of attributeNames) {
    const attribute = model.rawAttributes?.[attributeName];
    const columnName =
      attribute?.field || attribute?.fieldName || attributeName;

    if (!attribute || existingColumns[columnName]) {
      continue;
    }

    await queryInterface.addColumn(
      tableName,
      columnName,
      buildColumnDefinition(attribute)
    );
    existingColumns[columnName] = true;
    addedColumns.push(columnName);
  }

  return addedColumns;
};

const ensureApplicationSchema = async ({ sequelize, models }) => {
  const compatibilityPlan = [
    {
      label: "Ticket",
      model: models.Ticket,
      attributeNames: [
        "assignedUserId",
        "acceptedAt",
        "resolvedAt",
        "closedAt",
        "reopenedAt",
        "lastInteractionAt",
        "autoClosedAt",
      ],
    },
    {
      label: "ChatMessage",
      model: models.ChatMessage,
      attributeNames: [
        "senderType",
        "senderName",
        "senderUserId",
        "messageType",
        "customerReadAt",
        "companyReadAt",
        "reminderSentAt",
      ],
    },
    {
      label: "TicketUpdate",
      model: models.TicketUpdate,
      attributeNames: ["actorUserId", "statusFrom", "statusTo", "details"],
    },
  ];

  for (const target of compatibilityPlan) {
    const addedColumns = await ensureModelColumns({
      sequelize,
      model: target.model,
      attributeNames: target.attributeNames,
    });

    if (addedColumns.length > 0) {
      console.log(
        `[db] Compatibilidade aplicada em ${target.label}: ${addedColumns.join(", ")}`
      );
    }
  }
};

export { ensureApplicationSchema };

export default {
  ensureApplicationSchema,
};
