exports.up = (pgm) => {
  pgm.createTable("message_reactions", {
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

    emoji: {
      type: "text",
      notNull: true,
    },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  pgm.addConstraint(
    "message_reactions",
    "message_reactions_message_user_emoji_unique",
    {
      unique: [
        "message_id",
        "user_id",
        "emoji",
      ],
    },
  );

  pgm.createIndex(
    "message_reactions",
    ["message_id"],
    {
      name: "message_reactions_message_id_idx",
    },
  );

  pgm.createIndex(
    "message_reactions",
    ["user_id"],
    {
      name: "message_reactions_user_id_idx",
    },
  );
};

exports.down = (pgm) => {
  pgm.dropTable("message_reactions");
};