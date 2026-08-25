exports.up = (pgm) => {
  pgm.createTable("direct_message_read_receipts", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    message_id: {
      type: "uuid",
      notNull: true,
      references: "direct_messages(id)",
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
    "direct_message_read_receipts",
    "direct_message_read_receipts_message_user_unique",
    {
      unique: ["message_id", "user_id"],
    },
  );

  pgm.createIndex(
    "direct_message_read_receipts",
    ["message_id"],
    {
      name: "direct_message_read_receipts_message_id_idx",
    },
  );

  pgm.createIndex(
    "direct_message_read_receipts",
    ["user_id"],
    {
      name: "direct_message_read_receipts_user_id_idx",
    },
  );
};

exports.down = (pgm) => {
  pgm.dropTable("direct_message_read_receipts");
};