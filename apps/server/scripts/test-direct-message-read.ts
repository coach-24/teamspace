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
  // Find Alice ↔ Bob conversation
  // ============================================

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
    throw new Error(
      `Conversation lookup failed: ${JSON.stringify(
        conversationResult,
      )}`,
    );
  }

  const conversationId =
    conversationResult.data.id;

  console.log(
    "💬 Conversation:",
    conversationId,
  );

  // ============================================
  // Create a fresh DM
  // ============================================

  const content =
    `Read receipt test ${Date.now()} 👀`;

  console.log(
    "\n📨 Alice sends a fresh DM...",
  );

  const sendResponse = await fetch(
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

  const sendResult =
    await sendResponse.json();

  if (sendResponse.status !== 201) {
    throw new Error(
      `DM creation failed: ${JSON.stringify(
        sendResult,
      )}`,
    );
  }

  const messageId =
    sendResult.data.id;

  console.log(
    "✅ Message created:",
    messageId,
  );

  // ============================================
  // Login Bob
  // ============================================

  console.log("\n🔐 Logging in Bob...");

  const bobToken = await login(
    "bob@teamspace.dev",
    TEST_PASSWORD,
  );

  console.log("✅ Bob logged in.");

  // ============================================
  // Bob marks message as read
  // ============================================

  console.log(
    "\n👀 Bob is marking Alice's DM as read...",
  );

  const readResponse = await fetch(
    `${API_URL}/api/conversations/${conversationId}/messages/${messageId}/read`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bobToken}`,
      },
    },
  );

  const readResult =
    await readResponse.json();

  console.log(
    "\n📡 Read Receipt Response",
  );
  console.log(
    "======================",
  );
  console.log(
    "HTTP Status:",
    readResponse.status,
  );
  console.log(
    "Response:",
    JSON.stringify(
      readResult,
      null,
      2,
    ),
  );

  if (readResponse.status !== 200) {
    console.error(
      "\n❌ Bob could not mark message as read.",
    );

    process.exit(1);
  }

  if (
    readResult.data?.message_id !==
    messageId
  ) {
    console.error(
      "\n❌ Incorrect message ID in receipt.",
    );

    process.exit(1);
  }

  console.log(
    "\n✅ Bob marked the DM as read.",
  );

  // ============================================
  // Idempotency test
  // ============================================

  console.log(
    "\n🔁 Marking the same message as read again...",
  );

  const secondReadResponse =
    await fetch(
      `${API_URL}/api/conversations/${conversationId}/messages/${messageId}/read`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bobToken}`,
        },
      },
    );

  const secondReadResult =
    await secondReadResponse.json();

  if (secondReadResponse.status !== 200) {
    console.error(
      "\n❌ Read receipt is not idempotent.",
      secondReadResult,
    );

    process.exit(1);
  }

  console.log(
    "✅ Read receipt is idempotent.",
  );

  // ============================================
  // Charlie authorization
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
    "\n🚫 Charlie attempts to mark Alice's DM as read...",
  );

  const forbiddenResponse =
    await fetch(
      `${API_URL}/api/conversations/${conversationId}/messages/${messageId}/read`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${charlieToken}`,
        },
      },
    );

  const forbiddenResult =
    await forbiddenResponse.json();

  console.log(
    "Charlie HTTP Status:",
    forbiddenResponse.status,
  );

  if (forbiddenResponse.status !== 403) {
    console.error(
      "\n❌ Conversation authorization failed.",
      forbiddenResult,
    );

    process.exit(1);
  }

  if (
    forbiddenResult.error?.code !==
    "CONVERSATION_ACCESS_DENIED"
  ) {
    console.error(
      "\n❌ Incorrect authorization error.",
      forbiddenResult,
    );

    process.exit(1);
  }

  console.log(
    "✅ Charlie was correctly denied.",
  );

  // ============================================
  // Final
  // ============================================

  console.log(
    "\n🎉 DIRECT MESSAGE READ RECEIPT TEST PASSED!",
  );

  console.log(
    "✅ Bob can mark Alice's DM as read.",
  );

  console.log(
    "✅ Read receipt is persisted.",
  );

  console.log(
    "✅ Read operation is idempotent.",
  );

  console.log(
    "✅ Charlie cannot mark the DM as read.",
  );
};

main().catch((error) => {
  console.error(
    "❌ Unexpected error:",
    error,
  );

  process.exit(1);
});