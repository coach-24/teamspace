exports.up = (pgm) => {
  pgm.createTable("attachments", {
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

    uploader_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "RESTRICT",
    },

    storage_path: {
      type: "text",
      notNull: true,
    },

    file_name: {
      type: "text",
      notNull: true,
    },

    mime_type: {
      type: "text",
      notNull: true,
    },

    file_size: {
      type: "bigint",
      notNull: true,
    },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  pgm.createIndex(
    "attachments",
    ["message_id", "created_at"],
    {
      name: "attachments_message_created_at_idx",
    },
  );

  pgm.createIndex(
    "attachments",
    ["uploader_id"],
    {
      name: "attachments_uploader_id_idx",
    },
  );
};

exports.down = (pgm) => {
  pgm.dropTable("attachments");
};