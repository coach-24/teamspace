import type { FastifyInstance, FastifyRequest } from "fastify";

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";

type WorkspaceMembership = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
};

export const getWorkspaceMembership = async (
  app: FastifyInstance,
  request: FastifyRequest,
  workspaceId: string,
): Promise<WorkspaceMembership | null> => {
  const authUserId = request.user?.id;

  if (!authUserId) {
    return null;
  }

  const result = await app.db.query<WorkspaceMembership>(
    `
    SELECT
      m.id,
      m.user_id,
      m.workspace_id,
      m.role
    FROM memberships m
    JOIN users u
      ON u.id = m.user_id
    WHERE m.workspace_id = $1
      AND u.auth_user_id = $2
    `,
    [workspaceId, authUserId],
  );

  return result.rows[0] ?? null;
};