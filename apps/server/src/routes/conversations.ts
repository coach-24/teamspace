import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const bodySchema = z.object({
  userId: z.uuid(),
});

const conversationsRoute: FastifyPluginAsync = async (
  app,
) => {
  app.post(
    "/api/conversations",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      // ============================================
      // Validate body
      // ============================================

      const parsedBody = bodySchema.safeParse(
        request.body,
      );

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_USER_ID",
            message:
              "User ID must be a valid UUID",
          },
        });
      }

      const { userId: otherUserId } =
        parsedBody.data;

      // ============================================
      // Authentication
      // ============================================

      const authUserId = request.user?.id;

      if (!authUserId) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATION_REQUIRED",
            message: "Authentication required",
          },
        });
      }

      // ============================================
      // Resolve current TeamSpace user
      // ============================================

      const currentUserResult =
        await app.db.query(
          `
          SELECT id
          FROM users
          WHERE auth_user_id = $1
          `,
          [authUserId],
        );

      const currentUser =
        currentUserResult.rows[0];

      if (!currentUser) {
        return reply.status(403).send({
          error: {
            code: "USER_NOT_LINKED",
            message:
              "Authenticated user is not linked to a TeamSpace user",
          },
        });
      }

      // ============================================
      // Prevent self-conversation
      // ============================================

      if (currentUser.id === otherUserId) {
        return reply.status(400).send({
          error: {
            code: "SELF_CONVERSATION_NOT_ALLOWED",
            message:
              "You cannot create a conversation with yourself",
          },
        });
      }

      // ============================================
      // Verify target user exists
      // ============================================

      const otherUserResult =
        await app.db.query(
          `
          SELECT
            id,
            display_name,
            email
          FROM users
          WHERE id = $1
          `,
          [otherUserId],
        );

      const otherUser =
        otherUserResult.rows[0];

      if (!otherUser) {
        return reply.status(404).send({
          error: {
            code: "USER_NOT_FOUND",
            message: "User not found",
          },
        });
      }

      // ============================================
      // Find existing 1-to-1 conversation
      // ============================================

      const existingConversationResult =
        await app.db.query(
          `
          SELECT
            c.id,
            c.created_at,
            c.updated_at
          FROM conversations c
          INNER JOIN conversation_members cm1
            ON cm1.conversation_id = c.id
          INNER JOIN conversation_members cm2
            ON cm2.conversation_id = c.id
          WHERE cm1.user_id = $1
            AND cm2.user_id = $2
          `,
          [
            currentUser.id,
            otherUserId,
          ],
        );

      const existingConversation =
        existingConversationResult.rows[0];

      if (existingConversation) {
        return reply.status(200).send({
          data: {
            id: existingConversation.id,
            created_at:
              existingConversation.created_at,
            updated_at:
              existingConversation.updated_at,
            members: [
              {
                id: currentUser.id,
              },
              {
                id: otherUser.id,
                display_name:
                  otherUser.display_name,
                email: otherUser.email,
              },
            ],
          },
        });
      }

      // ============================================
      // Create conversation
      // ============================================

      const conversationResult =
        await app.db.query(
          `
          INSERT INTO conversations
          DEFAULT VALUES
          RETURNING
            id,
            created_at,
            updated_at
          `,
        );

      const conversation =
        conversationResult.rows[0];

      // ============================================
      // Add members
      // ============================================

      await app.db.query(
        `
        INSERT INTO conversation_members (
          conversation_id,
          user_id
        )
        VALUES
          ($1, $2),
          ($1, $3)
        `,
        [
          conversation.id,
          currentUser.id,
          otherUserId,
        ],
      );

      return reply.status(201).send({
        data: {
          id: conversation.id,
          created_at:
            conversation.created_at,
          updated_at:
            conversation.updated_at,
          members: [
            {
              id: currentUser.id,
            },
            {
              id: otherUser.id,
              display_name:
                otherUser.display_name,
              email: otherUser.email,
            },
          ],
        },
      });
    },
  );
};

export default conversationsRoute;