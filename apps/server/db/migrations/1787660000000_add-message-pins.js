exports.up = (pgm) => {
  pgm.createTable("message_pins", {
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

    pinned_by: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  pgm.addConstraint(
    "message_pins",
    "message_pins_message_unique",
    {
      unique: ["message_id"],
    },
  );

  pgm.createIndex(
    "message_pins",
    ["message_id"],
    {
      name: "message_pins_message_id_idx",
    },
  );

  pgm.createIndex(
    "message_pins",
    ["pinned_by"],
    {
      name: "message_pins_pinned_by_idx",
    },
  );
};

exports.down = (pgm) => {
  pgm.dropTable("message_pins");
};