exports.up = (pgm) => {
  pgm.createTable("message_read_receipts", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    message_id: {
      type: "uuid",
      notNull: true,
      references: "messages(id)",
      onDelete: "CASCADE",
    },

    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },

    read_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  pgm.addConstraint(
    "message_read_receipts",
    "message_read_receipts_message_user_unique",
    {
      unique: ["message_id", "user_id"],
    },
  );

  pgm.createIndex(
    "message_read_receipts",
    ["message_id"],
    {
      name: "message_read_receipts_message_id_idx",
    },
  );

  pgm.createIndex(
    "message_read_receipts",
    ["user_id"],
    {
      name: "message_read_receipts_user_id_idx",
    },
  );
};

exports.down = (pgm) => {
  pgm.dropTable("message_read_receipts");
};