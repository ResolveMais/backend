import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

const loadCompatModule = async ({
  describeTable = jest.fn(),
  query = jest.fn(),
} = {}) => {
  jest.resetModules();

  const dbMock = {
    sequelize: {
      getQueryInterface: () => ({
        describeTable,
      }),
      query,
    },
  };

  jest.unstable_mockModule("../../../app/models/index.js", () => ({
    default: dbMock,
  }));

  const module = await import("../../../app/utils/dbSchemaCompat.js");

  return {
    module,
    dbMock,
    describeTable,
    query,
  };
};

const buildModel = ({
  tableName = "users",
  rawAttributes = {
    id: { fieldName: "id", field: "id" },
    name: { fieldName: "name", field: "name" },
    createdAt: { fieldName: "createdAt", field: "created_at" },
  },
  primaryKeyAttribute = "id",
} = {}) => ({
  tableName,
  rawAttributes,
  primaryKeyAttribute,
  create: jest.fn(async (payload) => ({ persisted: true, ...payload })),
  build: jest.fn((payload, options) => ({ payload, options })),
});

describe("app/utils/dbSchemaCompat", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("filterPayloadBySchema removes attributes that do not exist in the described table", async () => {
    const describeTable = jest.fn().mockResolvedValue({
      id: {},
      name: {},
      created_at: {},
    });
    const { module } = await loadCompatModule({ describeTable });
    const model = buildModel();

    const filteredPayload = await module.filterPayloadBySchema(model, {
      id: 1,
      name: "Alice",
      createdAt: "2026-04-30",
      ignoredField: "drop-me",
    });

    expect(filteredPayload).toEqual({
      id: 1,
      name: "Alice",
      createdAt: "2026-04-30",
    });
    expect(describeTable).toHaveBeenCalledWith("users");
  });

  test("buildCreateOptionsBySchema disables returning when the schema differs from the model", async () => {
    const describeTable = jest.fn().mockResolvedValue({
      id: {},
      name: {},
    });
    const { module } = await loadCompatModule({ describeTable });
    const model = buildModel();

    await expect(module.buildCreateOptionsBySchema(model, { transaction: "tx" })).resolves.toEqual({
      transaction: "tx",
      returning: false,
    });
  });

  test("createRecordBySchema falls back to a raw insert and returns the built entity with the inserted id", async () => {
    const describeTable = jest.fn().mockResolvedValue({
      id: {},
      name: {},
    });
    const query = jest.fn().mockResolvedValue([[{ id: 99 }]]);
    const { module } = await loadCompatModule({ describeTable, query });
    const model = buildModel();

    const result = await module.createRecordBySchema(
      model,
      {
        name: "Alice",
        createdAt: "2026-04-30T10:00:00.000Z",
      },
      { transaction: "tx-1" }
    );

    expect(model.create).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO [users]"),
      expect.objectContaining({
        replacements: {
          value0: "Alice",
          value1: "2026-04-30T10:00:00.000Z",
        },
        transaction: "tx-1",
      })
    );
    expect(model.build).toHaveBeenCalledWith(
      {
        id: 99,
        name: "Alice",
        createdAt: "2026-04-30T10:00:00.000Z",
      },
      { isNewRecord: false }
    );
    expect(result).toEqual({
      payload: {
        id: 99,
        name: "Alice",
        createdAt: "2026-04-30T10:00:00.000Z",
      },
      options: { isNewRecord: false },
    });
  });
});
