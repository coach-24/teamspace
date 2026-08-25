import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const TEST_PASSWORD = process.env.TEST_PASSWORD!;

const API_URL = "http://127.0.0.1:4000";

const BOB_ID =
  "23498c3d-1077-4abb-8d7c-ea5e48f29aae";

const login = async (
  email: string,
  password: string,
) => {
  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Login failed for ${email}: ${JSON.stringify(data)}`,
    );
  }

  return data.access_token as string;
};

const main = async () => {
  // ============================================
  // Alice login
  // ============================================

  console.log("🔐 Logging in Alice...");

  const aliceToken = await login(
    "alice@teamspace.dev",
    TEST_PASSWORD,
  );

  console.log("✅ Alice logged in.");

  // ============================================
  // Create/find Alice → Bob conversation
  // ============================================

  console.log(
    "\n💬 Finding Alice ↔ Bob conversation...",
  );

  const conversationResponse = await fetch(
    `${API_URL}/api/conversations`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aliceToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: BOB_ID,
      }),
    },
  );

  const conversationResult =
    await conversationResponse.json();

  if (
    conversationResponse.status !== 200 &&
    conversationResponse.status !== 201
  ) {
    console.error(
      "❌ Conversation lookup failed:",
      conversationResult,
    );

    process.exit(1);
  }

  const conversationId =
    conversationResult.data.id;

  console.log(
    "✅ Conversation:",
    conversationId,
  );

  // ============================================
  // Alice sends DM
  // ============================================

  const content =
    `Hello Bob! DM test ${Date.now()} 💬`;

  console.log(
    "\n📨 Alice is sending a DM...",
  );

  const messageResponse = await fetch(
    `${API_URL}/api/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aliceToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
      }),
    },
  );

  const messageResult =
    await messageResponse.json();

  console.log(
    "\n📡 DM Response",
  );
  console.log(
    "======================",
  );
  console.log(
    "HTTP Status:",
    messageResponse.status,
  );
  console.log(
    "Response:",
    JSON.stringify(
      messageResult,
      null,
      2,
    ),
  );

  if (messageResponse.status !== 201) {
    console.error(
      "\n❌ Alice could not send DM.",
    );

    process.exit(1);
  }

  const message =
    messageResult.data;

  if (!message?.id) {
    console.error(
      "\n❌ DM response has no message ID.",
    );

    process.exit(1);
  }

  if (
    message.content !== content
  ) {
    console.error(
      "\n❌ DM content mismatch.",
    );

    process.exit(1);
  }

  if (
    message.conversation_id !==
    conversationId
  ) {
    console.error(
      "\n❌ Incorrect conversation ID.",
    );

    process.exit(1);
  }

  console.log(
    "\n✅ Alice successfully sent DM to Bob.",
  );

  // ============================================
  // Charlie authorization test
  // ============================================

  console.log(
    "\n🔐 Logging in Charlie...",
  );

  const charlieToken = await login(
    "charlie@teamspace.dev",
    TEST_PASSWORD,
  );

  console.log("✅ Charlie logged in.");

  console.log(
    "\n🚫 Charlie is attempting to send into Alice ↔ Bob conversation...",
  );

  const forbiddenResponse =
    await fetch(
      `${API_URL}/api/conversations/${conversationId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${charlieToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content:
            "Charlie should not be able to send this",
        }),
      },
    );

  const forbiddenResult =
    await forbiddenResponse.json();

  console.log(
    "Charlie HTTP Status:",
    forbiddenResponse.status,
  );

  console.log(
    "Charlie Response:",
    JSON.stringify(
      forbiddenResult,
      null,
      2,
    ),
  );

  if (forbiddenResponse.status !== 403) {
    console.error(
      "\n❌ Conversation authorization failed.",
    );

    process.exit(1);
  }

  if (
    forbiddenResult.error?.code !==
    "CONVERSATION_ACCESS_DENIED"
  ) {
    console.error(
      "\n❌ Incorrect authorization error.",
    );

    process.exit(1);
  }

  console.log(
    "\n✅ Charlie was correctly denied access.",
  );

  // ============================================
  // Final result
  // ============================================

  console.log(
    "\n🎉 DIRECT MESSAGE TEST PASSED!",
  );

  console.log(
    "✅ Alice can send a DM.",
  );

  console.log(
    "✅ DM is persisted.",
  );

  console.log(
    "✅ Conversation ID is correct.",
  );

  console.log(
    "✅ Charlie cannot access the conversation.",
  );
};

main().catch((error) => {
  console.error(
    "❌ Unexpected error:",
    error,
  );

  process.exit(1);
});