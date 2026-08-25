import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getWorkspaceMembership } from "../../utils/workspace-auth.js";

const workspaceParamsSchema = z.object({
  workspaceId: z.uuid(),
});

const createChannelBodySchema = z.object({
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

  description: z
    .string()
    .trim()
    .max(500)
    .optional(),

  isPrivate: z.boolean().optional().default(false),
});

const channelsRoute: FastifyPluginAsync = async (app) => {
  // ============================================
  // GET WORKSPACE CHANNELS
  // ============================================

  app.get(
    "/api/workspaces/:workspaceId/channels",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      const parsed = workspaceParamsSchema.safeParse(request.params);

      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_WORKSPACE_ID",
            message: "Workspace ID must be a valid UUID",
          },
        });
      }

      const { workspaceId } = parsed.data;

      const membership = await getWorkspaceMembership(
        app,
        request,
        workspaceId,
      );

      if (!membership) {
        return reply.status(403).send({
          error: {
            code: "WORKSPACE_ACCESS_DENIED",
            message: "You are not a member of this workspace",
          },
        });
      }

      const result = await app.db.query(
        `
        SELECT
          c.id,
          c.name,
          c.slug,
          c.description,
          c.is_private,
          c.created_by,
          c.created_at,
          c.updated_at
        FROM channels c
        WHERE c.workspace_id = $1
        ORDER BY c.created_at ASC
        `,
        [workspaceId],
      );

      return {
        data: result.rows,
      };
    },
  );

  // ============================================
  // CREATE CHANNEL
  // ============================================

  app.post(
    "/api/workspaces/:workspaceId/channels",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      // --------------------------------------------
      // Validate workspace ID
      // --------------------------------------------

      const params = workspaceParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_WORKSPACE_ID",
            message: "Workspace ID must be a valid UUID",
          },
        });
      }

      const { workspaceId } = params.data;

      // --------------------------------------------
      // Validate request body
      // --------------------------------------------

      const body = createChannelBodySchema.safeParse(request.body);

      if (!body.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: body.error.message,
          },
        });
      }

      const {
        name,
        slug,
        description,
        isPrivate,
      } = body.data;

      // --------------------------------------------
      // Verify workspace membership
      // --------------------------------------------

      const membership = await getWorkspaceMembership(
        app,
        request,
        workspaceId,
      );

      if (!membership) {
        return reply.status(403).send({
          error: {
            code: "WORKSPACE_ACCESS_DENIED",
            message: "You are not a member of this workspace",
          },
        });
      }

      // --------------------------------------------
      // Get TeamSpace user
      // --------------------------------------------

      const userResult = await app.db.query(
        `
        SELECT id
        FROM users
        WHERE auth_user_id = $1
        `,
        [request.user!.id],
      );

      const user = userResult.rows[0];

      if (!user) {
        return reply.status(404).send({
          error: {
            code: "USER_NOT_FOUND",
            message: "TeamSpace user not found",
          },
        });
      }

      // --------------------------------------------
      // Create channel
      // --------------------------------------------

      try {
  const client = await app.db.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      INSERT INTO channels (
        workspace_id,
        name,
        slug,
        description,
        is_private,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        workspace_id,
        name,
        slug,
        description,
        is_private,
        created_by,
        created_at,
        updated_at
      `,
      [
        workspaceId,
        name,
        slug,
        description ?? null,
        isPrivate,
        user.id,
      ],
    );

    const channel = result.rows[0];

    // Private channel:
    // creator automatically becomes a channel member.
    if (isPrivate) {
      await client.query(
        `
        INSERT INTO channel_members (
          channel_id,
          user_id
        )
        VALUES ($1, $2)
        `,
        [channel.id, user.id],
      );
    }

    await client.query("COMMIT");

    return reply.status(201).send({
      data: channel,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} catch (error) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23505"
  ) {
    return reply.status(409).send({
      error: {
        code: "CHANNEL_SLUG_ALREADY_EXISTS",
        message:
          "A channel with this slug already exists in this workspace",
      },
    });
  }

  throw error;
}


    },
  );
};

export default channelsRoute;