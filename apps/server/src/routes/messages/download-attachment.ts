import type { FastifyPluginAsync } from "fastify";
import { supabase } from "../../services/supabase.js";
import { z } from "zod";

const paramsSchema = z.object({
  attachmentId: z.uuid(),
});

const downloadAttachmentRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/api/attachments/:attachmentId",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      const parsed = paramsSchema.safeParse(request.params);

      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_ATTACHMENT_ID",
            message: "Attachment ID must be a valid UUID",
          },
        });
      }

      const authUserId = request.user?.id;

      if (!authUserId) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATION_REQUIRED",
            message: "Authentication required",
          },
        });
      }

      const { attachmentId } = parsed.data;

      const userResult = await app.db.query(
        `
        SELECT id
        FROM users
        WHERE auth_user_id = $1
        `,
        [authUserId],
      );

      const user = userResult.rows[0];

      if (!user) {
        return reply.status(403).send({
          error: {
            code: "USER_NOT_LINKED",
            message: "Authenticated user is not linked to a TeamSpace user",
          },
        });
      }

      const result = await app.db.query(
        `
        SELECT
          a.id,
          a.storage_path,
          a.file_name,
          a.mime_type,
          a.message_id,
          m.channel_id,
          c.workspace_id,
          c.is_private
        FROM attachments a
        INNER JOIN messages m
          ON m.id = a.message_id
        INNER JOIN channels c
          ON c.id = m.channel_id
        WHERE a.id = $1
        `,
        [attachmentId],
      );

      const attachment = result.rows[0];

      if (!attachment) {
        return reply.status(404).send({
          error: {
            code: "ATTACHMENT_NOT_FOUND",
            message: "Attachment not found",
          },
        });
      }

      const membershipResult = await app.db.query(
        `
        SELECT id
        FROM memberships
        WHERE workspace_id = $1
          AND user_id = $2
        `,
        [attachment.workspace_id, user.id],
      );

      if (membershipResult.rowCount === 0) {
        return reply.status(403).send({
          error: {
            code: "NOT_WORKSPACE_MEMBER",
            message: "You are not a member of this workspace",
          },
        });
      }

      if (attachment.is_private) {
        const channelMemberResult = await app.db.query(
          `
          SELECT id
          FROM channel_members
          WHERE channel_id = $1
            AND user_id = $2
          `,
          [attachment.channel_id, user.id],
        );

        if (channelMemberResult.rowCount === 0) {
          return reply.status(403).send({
            error: {
              code: "CHANNEL_ACCESS_DENIED",
              message: "You do not have access to this private channel",
            },
          });
        }
      }

      const bucket =
        process.env.SUPABASE_STORAGE_BUCKET ??
        "teamspace-attachments";

      const { data, error } =
        await supabase.storage
          .from(bucket)
          .createSignedUrl(
            attachment.storage_path,
            60 * 10,
          );

      if (error || !data?.signedUrl) {
        request.log.error(
          error,
          "Failed to create attachment signed URL",
        );

        return reply.status(500).send({
          error: {
            code: "SIGNED_URL_FAILED",
            message: "Failed to create attachment URL",
          },
        });
      }

      return {
        data: {
          id: attachment.id,
          file_name: attachment.file_name,
          mime_type: attachment.mime_type,
          url: data.signedUrl,
          expires_in: 600,
        },
      };
    },
  );
};

export default downloadAttachmentRoute;