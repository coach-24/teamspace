exports.up = (pgm) => {
  // ============================================
  // CONVERSATIONS
  // ============================================

  pgm.createTable("conversations", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },

    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  // ============================================
  // CONVERSATION MEMBERS
  // ============================================

  pgm.createTable("conversation_members", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    conversation_id: {
      type: "uuid",
      notNull: true,
      references: "conversations(id)",
      onDelete: "CASCADE",
    },

    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },

    joined_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  pgm.addConstraint(
    "conversation_members",
    "conversation_members_conversation_user_unique",
    {
      unique: ["conversation_id", "user_id"],
    },
  );

  pgm.createIndex(
    "conversation_members",
    ["conversation_id"],
    {
      name: "conversation_members_conversation_id_idx",
    },
  );

  pgm.createIndex(
    "conversation_members",
    ["user_id"],
    {
      name: "conversation_members_user_id_idx",
    },
  );

  // ============================================
  // DIRECT MESSAGES
  // ============================================

  pgm.createTable("direct_messages", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    conversation_id: {
      type: "uuid",
      notNull: true,
      references: "conversations(id)",
      onDelete: "CASCADE",
    },

    sender_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "RESTRICT",
    },

    content: {
      type: "text",
      notNull: true,
    },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },

    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  pgm.createIndex(
    "direct_messages",
    ["conversation_id", "created_at"],
    {
      name: "direct_messages_conversation_created_at_idx",
    },
  );

  pgm.createIndex(
    "direct_messages",
    ["sender_id"],
    {
      name: "direct_messages_sender_id_idx",
    },
  );
};

exports.down = (pgm) => {
  pgm.dropTable("direct_messages");
  pgm.dropTable("conversation_members");
  pgm.dropTable("conversations");
};