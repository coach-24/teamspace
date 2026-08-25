exports.up = (pgm) => {
  pgm.addColumn("messages", {
    parent_message_id: {
      type: "uuid",
      references: "messages(id)",
      onDelete: "CASCADE",
    },
  });

  pgm.createIndex(
    "messages",
    ["parent_message_id", "created_at"],
    {
      name: "messages_parent_message_created_at_idx",
    },
  );
};

exports.down = (pgm) => {
  pgm.dropIndex(
    "messages",
    ["parent_message_id", "created_at"],
    {
      name: "messages_parent_message_created_at_idx",
    },
  );

  pgm.dropColumn(
    "messages",
    "parent_message_id",
  );
};