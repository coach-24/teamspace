import type { FastifyPluginAsync } from "fastify";
import { supabase } from "../../services/supabase.js";
import { connectionManager } from "../../realtime/connection-manager.js";
import { z } from "zod";

const paramsSchema = z.object({
  messageId: z.uuid(),
});

const uploadAttachmentRoute: FastifyPluginAsync = async (app) => {
  app.post(
    "/api/messages/:messageId/attachments",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      // ============================================
      // Validate message ID
      // ============================================

      const parsedParams = paramsSchema.safeParse(
        request.params,
      );

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_MESSAGE_ID",
            message: "Message ID must be a valid UUID",
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

      const { messageId } = parsedParams.data;

      // ============================================
      // Resolve TeamSpace user
      // ============================================

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
            message:
              "Authenticated user is not linked to a TeamSpace user",
          },
        });
      }

      // ============================================
      // Find message + channel
      // ============================================

      const messageResult = await app.db.query(
        `
        SELECT
          m.id,
          m.channel_id,
          m.sender_id,
          c.workspace_id,
          c.is_private
        FROM messages m
        INNER JOIN channels c
          ON c.id = m.channel_id
        WHERE m.id = $1
        `,
        [messageId],
      );

      const message = messageResult.rows[0];

      if (!message) {
        return reply.status(404).send({
          error: {
            code: "MESSAGE_NOT_FOUND",
            message: "Message not found",
          },
        });
      }

      // ============================================
      // Workspace authorization
      // ============================================

      const membershipResult = await app.db.query(
        `
        SELECT id
        FROM memberships
        WHERE workspace_id = $1
          AND user_id = $2
        `,
        [message.workspace_id, user.id],
      );

      if (membershipResult.rowCount === 0) {
        return reply.status(403).send({
          error: {
            code: "NOT_WORKSPACE_MEMBER",
            message:
              "User is not a member of this workspace",
          },
        });
      }

      // ============================================
      // Private channel authorization
      // ============================================

      if (message.is_private) {
        const channelMemberResult =
          await app.db.query(
            `
            SELECT id
            FROM channel_members
            WHERE channel_id = $1
              AND user_id = $2
            `,
            [message.channel_id, user.id],
          );

        if (channelMemberResult.rowCount === 0) {
          return reply.status(403).send({
            error: {
              code: "CHANNEL_ACCESS_DENIED",
              message:
                "You do not have access to this private channel",
            },
          });
        }
      }

      // ============================================
      // Read multipart file
      // ============================================

      const file = await request.file();

      if (!file) {
        return reply.status(400).send({
          error: {
            code: "FILE_REQUIRED",
            message: "A file is required",
          },
        });
      }

      if (file.file.truncated) {
        return reply.status(413).send({
          error: {
            code: "FILE_TOO_LARGE",
            message:
              "File exceeds the 10 MB upload limit",
          },
        });
      }

      // ============================================
      // Generate storage path
      // ============================================

      const storagePath =
        `${message.workspace_id}/${message.channel_id}/${message.id}/${crypto.randomUUID()}-${file.filename}`;

      const bucket =
        process.env.SUPABASE_STORAGE_BUCKET ??
        "teamspace-attachments";

      // ============================================
      // Upload to Supabase Storage
      // ============================================

      const fileBuffer =
        await file.toBuffer();

      const { error: uploadError } =
        await supabase.storage
          .from(bucket)
          .upload(
            storagePath,
            fileBuffer,
            {
              contentType:
                file.mimetype ||
                "application/octet-stream",
              upsert: false,
            },
          );

      if (uploadError) {
        request.log.error(
            {
            message: uploadError.message,
            name: uploadError.name,
            cause: uploadError.cause,
            },
            "Supabase Storage upload failed",
        );

        return reply.status(500).send({
            error: {
            code: "STORAGE_UPLOAD_FAILED",
            message: uploadError.message,
            },
        });
        }

      // ============================================
      // Save attachment metadata
      // ============================================

      const attachmentResult =
        await app.db.query(
          `
          INSERT INTO attachments (
            message_id,
            uploader_id,
            storage_path,
            file_name,
            mime_type,
            file_size
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING
            id,
            message_id,
            uploader_id,
            file_name,
            mime_type,
            file_size,
            created_at
          `,
          [
            message.id,
            user.id,
            storagePath,
            file.filename,
            file.mimetype ||
              "application/octet-stream",
            fileBuffer.length,
          ],
        );

      const attachment =
        attachmentResult.rows[0];

            connectionManager.broadcastToChannel(
        message.channel_id,
        {
            type: "attachment.created",
            data: attachment,
        },
        );

      return reply.status(201).send({
        data: attachment,
      });
    },
  );
};

export default uploadAttachmentRoute;