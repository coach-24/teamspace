exports.up = (pgm) => {
  pgm.createTable("notifications", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },

    type: {
      type: "varchar(50)",
      notNull: true,
    },

    message_id: {
      type: "uuid",
      references: "messages(id)",
      onDelete: "CASCADE",
    },

    channel_id: {
      type: "uuid",
      references: "channels(id)",
      onDelete: "CASCADE",
    },

    actor_id: {
      type: "uuid",
      references: "users(id)",
      onDelete: "CASCADE",
    },

    data: {
      type: "jsonb",
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
    },

    is_read: {
      type: "boolean",
      notNull: true,
      default: false,
    },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },

    read_at: {
      type: "timestamptz",
    },
  });

  pgm.createIndex(
    "notifications",
    ["user_id", "created_at"],
    {
      name: "notifications_user_created_at_idx",
    },
  );

  pgm.createIndex(
    "notifications",
    ["user_id", "is_read"],
    {
      name: "notifications_user_is_read_idx",
    },
  );
};

exports.down = (pgm) => {
  pgm.dropTable("notifications");
};