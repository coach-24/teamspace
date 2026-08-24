import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const seed = async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Create development users
    const alice = await client.query(
      `
      INSERT INTO users (email, display_name)
      VALUES ($1, $2)
      ON CONFLICT (email)
      DO UPDATE SET display_name = EXCLUDED.display_name
      RETURNING id, email;
      `,
      ["alice@teamspace.dev", "Alice"]
    );

    const bob = await client.query(
      `
      INSERT INTO users (email, display_name)
      VALUES ($1, $2)
      ON CONFLICT (email)
      DO UPDATE SET display_name = EXCLUDED.display_name
      RETURNING id, email;
      `,
      ["bob@teamspace.dev", "Bob"]
    );

    const aliceId = alice.rows[0].id;
    const bobId = bob.rows[0].id;

    // 2. Create development workspace
    const workspace = await client.query(
      `
      INSERT INTO workspaces (name, slug, owner_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (slug)
      DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name;
      `,
      ["TeamSpace Development", "teamspace-dev", aliceId]
    );

    const workspaceId = workspace.rows[0].id;

    // 3. Create memberships
    await client.query(
      `
      INSERT INTO memberships (workspace_id, user_id, role)
      VALUES ($1, $2, 'OWNER')
      ON CONFLICT (workspace_id, user_id)
      DO UPDATE SET role = 'OWNER';
      `,
      [workspaceId, aliceId]
    );

    await client.query(
      `
      INSERT INTO memberships (workspace_id, user_id, role)
      VALUES ($1, $2, 'MEMBER')
      ON CONFLICT (workspace_id, user_id)
      DO UPDATE SET role = 'MEMBER';
      `,
      [workspaceId, bobId]
    );

    // 4. Create channels
    const general = await client.query(
      `
      INSERT INTO channels (
        workspace_id,
        name,
        slug,
        description,
        is_private,
        created_by
      )
      VALUES ($1, $2, $3, $4, FALSE, $5)
      ON CONFLICT (workspace_id, slug)
      DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description
      RETURNING id;
      `,
      [
        workspaceId,
        "General",
        "general",
        "General team discussion",
        aliceId,
      ]
    );

    const development = await client.query(
      `
      INSERT INTO channels (
        workspace_id,
        name,
        slug,
        description,
        is_private,
        created_by
      )
      VALUES ($1, $2, $3, $4, FALSE, $5)
      ON CONFLICT (workspace_id, slug)
      DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description
      RETURNING id;
      `,
      [
        workspaceId,
        "Development",
        "development",
        "Development discussions",
        aliceId,
      ]
    );

    const generalChannelId = general.rows[0].id;
    const developmentChannelId = development.rows[0].id;

    // 5. Create development messages
    await client.query(
      `
      INSERT INTO messages (channel_id, sender_id, content)
      SELECT $1, $2, $3
      WHERE NOT EXISTS (
        SELECT 1
        FROM messages
        WHERE channel_id = $1
          AND sender_id = $2
          AND content = $3
      );
      `,
      [
        generalChannelId,
        aliceId,
        "Welcome to the TeamSpace development workspace! 🚀",
      ]
    );

    await client.query(
      `
      INSERT INTO messages (channel_id, sender_id, content)
      SELECT $1, $2, $3
      WHERE NOT EXISTS (
        SELECT 1
        FROM messages
        WHERE channel_id = $1
          AND sender_id = $2
          AND content = $3
      );
      `,
      [
        developmentChannelId,
        bobId,
        "Development channel is ready. 🔥",
      ]
    );

    await client.query("COMMIT");

    console.log("✅ TeamSpace database seeded successfully");
    console.log({
      workspaceId,
      generalChannelId,
      developmentChannelId,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Seed failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

seed();