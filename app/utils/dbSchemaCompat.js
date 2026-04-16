import db from "../models/index.js";

const { sequelize } = db;

const tableColumnsCache = new Map();

const normalizeColumnName = (value) => String(value || "").trim().toLowerCase();

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

const getTableColumns = async (model) => {
  const tableName = resolveTableName(model);

  if (!tableName) return null;

  if (!tableColumnsCache.has(tableName)) {
    tableColumnsCache.set(
      tableName,
      (async () => {
        try {
          const description = await sequelize.getQueryInterface().describeTable(tableName);
          return new Set(Object.keys(description).map(normalizeColumnName));
        } catch (error) {
          console.warn(
            `Não foi possível descrever a tabela ${tableName}. Usando atributos definidos no model.`,
            error?.message || error
          );
          return null;
        }
      })()
    );
  }

  return tableColumnsCache.get(tableName);
};

const getAttributeColumnName = (model, attributeName) => {
  const attribute = model?.rawAttributes?.[attributeName];
  return normalizeColumnName(
    attribute?.field || attribute?.fieldName || attributeName
  );
};

const quoteIdentifier = (value) => `[${String(value || "").replaceAll("]", "]]")}]`;

const resolveAttributeMetadata = (model, attributeName) => {
  const directAttribute = model?.rawAttributes?.[attributeName];

  if (directAttribute) {
    return {
      attributeName: directAttribute.fieldName || attributeName,
      columnName:
        directAttribute.field || directAttribute.fieldName || attributeName,
    };
  }

  const matchedAttributeEntry = Object.entries(model?.rawAttributes || {}).find(
    ([, attribute]) =>
      attribute?.field === attributeName || attribute?.fieldName === attributeName
  );

  if (matchedAttributeEntry) {
    const [rawAttributeName, matchedAttribute] = matchedAttributeEntry;

    return {
      attributeName: matchedAttribute.fieldName || rawAttributeName,
      columnName:
        matchedAttribute.field ||
        matchedAttribute.fieldName ||
        rawAttributeName,
    };
  }

  return {
    attributeName,
    columnName: attributeName,
  };
};

const hasSchemaDifferences = async (model) => {
  const columns = await getTableColumns(model);

  if (!columns) return false;

  return Object.keys(model?.rawAttributes || {}).some(
    (attributeName) => !columns.has(getAttributeColumnName(model, attributeName))
  );
};

const hasColumnForAttribute = async (model, attributeName) => {
  const columns = await getTableColumns(model);

  if (!columns) return true;

  return columns.has(getAttributeColumnName(model, attributeName));
};

const filterAttributesBySchema = async (model, attributes = []) => {
  const columns = await getTableColumns(model);

  if (!columns) return attributes;

  return attributes.filter((attributeName) =>
    columns.has(getAttributeColumnName(model, attributeName))
  );
};

const filterPayloadBySchema = async (model, payload = {}) => {
  const entries = Object.entries(payload || {});
  const columns = await getTableColumns(model);

  if (!columns) return payload;

  return Object.fromEntries(
    entries.filter(([attributeName]) =>
      columns.has(getAttributeColumnName(model, attributeName))
    )
  );
};

const buildCreateOptionsBySchema = async (model, options = {}) => {
  if (Object.prototype.hasOwnProperty.call(options, "returning")) {
    return options;
  }

  const shouldDisableReturning = await hasSchemaDifferences(model);

  if (!shouldDisableReturning) {
    return options;
  }

  return {
    ...options,
    returning: false,
  };
};

const createRecordBySchema = async (model, payload = {}, options = {}) => {
  const shouldUseRawInsert = await hasSchemaDifferences(model);

  if (!shouldUseRawInsert) {
    return model.create(payload, options);
  }

  const entries = Object.entries(payload || {}).filter(([, value]) => value !== undefined);

  if (entries.length === 0) {
    return model.build({}, { isNewRecord: false });
  }

  const normalizedEntries = entries.map(([attributeName, value]) => ({
    ...resolveAttributeMetadata(model, attributeName),
    value,
  }));
  const replacements = {};
  const columnSql = [];
  const valueSql = [];

  normalizedEntries.forEach((entry, index) => {
    const replacementKey = `value${index}`;
    replacements[replacementKey] = entry.value;
    columnSql.push(quoteIdentifier(entry.columnName));
    valueSql.push(`:${replacementKey}`);
  });

  const primaryAttributeName =
    model?.autoIncrementAttribute || model?.primaryKeyAttribute || null;
  const primaryAttribute = primaryAttributeName
    ? resolveAttributeMetadata(model, primaryAttributeName)
    : null;
  const outputClause = primaryAttribute
    ? ` OUTPUT INSERTED.${quoteIdentifier(primaryAttribute.columnName)} AS ${quoteIdentifier(
        primaryAttribute.attributeName
      )}`
    : "";
  const tableName = resolveTableName(model);
  const sql = `INSERT INTO ${quoteIdentifier(tableName)} (${columnSql.join(
    ","
  )})${outputClause} VALUES (${valueSql.join(",")});`;
  const [rows] = await sequelize.query(sql, {
    replacements,
    transaction: options.transaction,
  });
  const createdValues = Object.fromEntries(
    normalizedEntries.map((entry) => [entry.attributeName, entry.value])
  );

  if (
    primaryAttribute &&
    Array.isArray(rows) &&
    rows[0] &&
    rows[0][primaryAttribute.attributeName] !== undefined
  ) {
    createdValues[primaryAttribute.attributeName] =
      rows[0][primaryAttribute.attributeName];
  }

  return model.build(createdValues, { isNewRecord: false });
};

export {
  buildCreateOptionsBySchema,
  createRecordBySchema,
  filterAttributesBySchema,
  filterPayloadBySchema,
  getTableColumns,
  hasSchemaDifferences,
  hasColumnForAttribute,
  resolveTableName,
};

export default {
  buildCreateOptionsBySchema,
  createRecordBySchema,
  getTableColumns,
  resolveTableName,
  hasSchemaDifferences,
  hasColumnForAttribute,
  filterAttributesBySchema,
  filterPayloadBySchema,
};
