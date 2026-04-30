import { describe, expect, jest, test } from "@jest/globals";
import { ensureApplicationSchema } from "../../../app/utils/schemaBootstrap.js";

const buildModel = (tableName, attributes) => ({
  tableName,
  rawAttributes: attributes,
});

describe("app/utils/schemaBootstrap", () => {
  test("ensureApplicationSchema adds only the missing compatibility columns", async () => {
    const describeTable = jest
      .fn()
      .mockResolvedValueOnce({ id: {}, status: {}, assigned_user_id: {} })
      .mockResolvedValueOnce({ id: {}, role: {} })
      .mockResolvedValueOnce({ id: {}, message: {}, actor_user_id: {} });
    const addColumn = jest.fn().mockResolvedValue(undefined);

    const sequelize = {
      getQueryInterface: () => ({
        describeTable,
        addColumn,
      }),
    };

    await ensureApplicationSchema({
      sequelize,
      models: {
        Ticket: buildModel("tickets", {
          assignedUserId: { field: "assigned_user_id", type: "INTEGER" },
          acceptedAt: { field: "accepted_at", type: "DATE", allowNull: true },
          customerRating: { field: "customer_rating", type: "INTEGER", defaultValue: null },
        }),
        ChatMessage: buildModel("chat_messages", {
          senderType: { field: "sender_type", type: "STRING" },
          reminderSentAt: { field: "reminder_sent_at", type: "DATE" },
        }),
        TicketUpdate: buildModel("ticket_updates", {
          actorUserId: { field: "actor_user_id", type: "INTEGER" },
          details: { field: "details", type: "JSON" },
        }),
      },
    });

    expect(addColumn).toHaveBeenCalledWith(
      "tickets",
      "accepted_at",
      expect.objectContaining({ type: "DATE", allowNull: true })
    );
    expect(addColumn).toHaveBeenCalledWith(
      "tickets",
      "customer_rating",
      expect.objectContaining({ type: "INTEGER", defaultValue: null })
    );
    expect(addColumn).toHaveBeenCalledWith(
      "chat_messages",
      "sender_type",
      expect.objectContaining({ type: "STRING" })
    );
    expect(addColumn).toHaveBeenCalledWith(
      "chat_messages",
      "reminder_sent_at",
      expect.objectContaining({ type: "DATE" })
    );
    expect(addColumn).toHaveBeenCalledWith(
      "ticket_updates",
      "details",
      expect.objectContaining({ type: "JSON" })
    );
    expect(addColumn).not.toHaveBeenCalledWith(
      "tickets",
      "assigned_user_id",
      expect.anything()
    );
    expect(addColumn).not.toHaveBeenCalledWith(
      "ticket_updates",
      "actor_user_id",
      expect.anything()
    );
  });
});
