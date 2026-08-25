exports.up = (pgm) => {
  pgm.addColumn("users", {
    last_seen_at: {
      type: "timestamptz",
      notNull: false,
    },
  });

  pgm.createIndex(
    "users",
    ["last_seen_at"],
    {
      name: "users_last_seen_at_idx",
    },
  );
};

exports.down = (pgm) => {
  pgm.dropIndex(
    "users",
    ["last_seen_at"],
    {
      name: "users_last_seen_at_idx",
    },
  );

  pgm.dropColumn("users", "last_seen_at");
};