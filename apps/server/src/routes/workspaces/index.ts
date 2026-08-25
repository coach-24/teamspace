import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers, and hyphens",
    ),
});

const workspaceRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/api/workspaces",
    { config: { requiresAuth: true } },
    async () => {
      const result = await app.db.query(`
        SELECT
          w.id,
          w.name,
          w.slug,
          w.owner_id,
          w.created_at,
          w.updated_at
        FROM workspaces w
        ORDER BY w.created_at DESC
      `);

      return {
        data: result.rows,
      };
    },
  );

  app.post(
    "/api/workspaces",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      const parsed = createWorkspaceSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.message,
          },
        });
      }

      const { name, slug } = parsed.data;

      const authUserId = request.user?.id;

      if (!authUserId) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATION_REQUIRED",
            message: "Authentication required",
          },
        });
      }

      const userResult = await app.db.query(
        `
        SELECT id
        FROM users
        WHERE auth_user_id = $1
        `,
        [authUserId],
      );

      const user = userResult.rows[0] as { id: string } | undefined;

      if (!user) {
        return reply.status(403).send({
          error: {
            code: "USER_NOT_LINKED",
            message: "Authenticated user is not linked to a TeamSpace user",
          },
        });
      }

      const client = await app.db.connect();

      try {
        await client.query("BEGIN");

        const workspaceResult = await client.query(
          `
          INSERT INTO workspaces (
            name,
            slug,
            owner_id
          )
          VALUES ($1, $2, $3)
          RETURNING
            id,
            name,
            slug,
            owner_id,
            created_at,
            updated_at
          `,
          [name, slug, user.id],
        );

        const workspace = workspaceResult.rows[0];

        await client.query(
          `
          INSERT INTO memberships (
            workspace_id,
            user_id,
            role
          )
          VALUES ($1, $2, 'OWNER')
          `,
          [workspace.id, user.id],
        );

        await client.query("COMMIT");

        return reply.status(201).send({
          data: workspace,
        });
      } catch (error) {
        await client.query("ROLLBACK");

        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "23505"
        ) {
          return reply.status(409).send({
            error: {
              code: "WORKSPACE_SLUG_ALREADY_EXISTS",
              message: "A workspace with this slug already exists",
            },
          });
        }

        throw error;
      } finally {
        client.release();
      }
    },
  );
};

export default workspaceRoute;