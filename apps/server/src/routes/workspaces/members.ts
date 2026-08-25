import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  getWorkspaceMembership,
  type WorkspaceRole,
} from "../../utils/workspace-auth.js";

const workspaceParamsSchema = z.object({
  workspaceId: z.uuid(),
});

const addMemberBodySchema = z.object({
  userId: z.uuid(),
});

const membersRoute: FastifyPluginAsync = async (app) => {
  // ============================================
  // GET WORKSPACE MEMBERS
  // ============================================

  app.get(
    "/api/workspaces/:workspaceId/members",
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
          m.id,
          m.user_id,
          u.email,
          u.display_name,
          u.avatar_url,
          m.role,
          m.joined_at,
          m.updated_at
        FROM memberships m
        JOIN users u
          ON u.id = m.user_id
        WHERE m.workspace_id = $1
        ORDER BY m.joined_at ASC
        `,
        [workspaceId],
      );

      return {
        data: result.rows,
      };
    },
  );

  // ============================================
  // ADD WORKSPACE MEMBER
  // ============================================

  app.post(
    "/api/workspaces/:workspaceId/members",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      const params = workspaceParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_WORKSPACE_ID",
            message: "Workspace ID must be a valid UUID",
          },
        });
      }

      const body = addMemberBodySchema.safeParse(request.body);

      if (!body.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: body.error.message,
          },
        });
      }

      const { workspaceId } = params.data;
      const { userId } = body.data;

      // --------------------------------------------
      // Find requester's workspace membership
      // --------------------------------------------

      const requesterMembership = await getWorkspaceMembership(
        app,
        request,
        workspaceId,
      );

      if (!requesterMembership) {
        return reply.status(403).send({
          error: {
            code: "WORKSPACE_ACCESS_DENIED",
            message: "You are not a member of this workspace",
          },
        });
      }

      const requesterRole: WorkspaceRole = requesterMembership.role;

      // --------------------------------------------
      // Only OWNER and ADMIN can add members
      // --------------------------------------------

      if (
        requesterRole !== "OWNER" &&
        requesterRole !== "ADMIN"
      ) {
        return reply.status(403).send({
          error: {
            code: "INSUFFICIENT_PERMISSIONS",
            message: "Only workspace owners and admins can add members",
          },
        });
      }

      // --------------------------------------------
      // Make sure target user exists
      // --------------------------------------------

      const userResult = await app.db.query(
        `
        SELECT
          id,
          email,
          display_name,
          avatar_url
        FROM users
        WHERE id = $1
        `,
        [userId],
      );

      const user = userResult.rows[0];

      if (!user) {
        return reply.status(404).send({
          error: {
            code: "USER_NOT_FOUND",
            message: "User not found",
          },
        });
      }

      // --------------------------------------------
      // Add member
      // --------------------------------------------

      try {
        const result = await app.db.query(
          `
          INSERT INTO memberships (
            workspace_id,
            user_id,
            role
          )
          VALUES ($1, $2, 'MEMBER')
          RETURNING
            id,
            workspace_id,
            user_id,
            role,
            joined_at,
            updated_at
          `,
          [workspaceId, userId],
        );

        return reply.status(201).send({
          data: {
            ...result.rows[0],
            user: {
              id: user.id,
              email: user.email,
              display_name: user.display_name,
              avatar_url: user.avatar_url,
            },
          },
        });
      } catch (error) {
        // PostgreSQL unique constraint:
        // memberships_workspace_user_unique
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "23505"
        ) {
          return reply.status(409).send({
            error: {
              code: "ALREADY_WORKSPACE_MEMBER",
              message: "User is already a member of this workspace",
            },
          });
        }

        throw error;
      }
    },
  );
};

export default membersRoute;