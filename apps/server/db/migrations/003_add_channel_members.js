export const up = (pgm) => {
  pgm.createTable("channel_members", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    channel_id: {
      type: "uuid",
      notNull: true,
      references: "channels(id)",
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
      default: pgm.func("now()"),
    },
  });

  pgm.addConstraint(
    "channel_members",
    "channel_members_channel_user_unique",
    {
      unique: ["channel_id", "user_id"],
    },
  );

  pgm.createIndex(
    "channel_members",
    ["channel_id"],
    {
      name: "channel_members_channel_id_idx",
    },
  );

  pgm.createIndex(
    "channel_members",
    ["user_id"],
    {
      name: "channel_members_user_id_idx",
    },
  );
};

export const down = (pgm) => {
  pgm.dropTable("channel_members");
};