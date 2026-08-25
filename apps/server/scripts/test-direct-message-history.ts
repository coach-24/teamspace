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
  // Create test messages
  // ============================================

  console.log(
    "\n📨 Creating two DM messages...",
  );

  const firstContent =
    `History test message 1 ${Date.now()}`;

  const firstResponse = await fetch(
    `${API_URL}/api/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aliceToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: firstContent,
      }),
    },
  );

  const firstResult =
    await firstResponse.json();

  if (firstResponse.status !== 201) {
    throw new Error(
      `First message failed: ${JSON.stringify(
        firstResult,
      )}`,
    );
  }

  const firstMessageId =
    firstResult.data.id;

  const secondContent =
    `History test message 2 ${Date.now()}`;

  const secondResponse = await fetch(
    `${API_URL}/api/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aliceToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: secondContent,
      }),
    },
  );

  const secondResult =
    await secondResponse.json();

  if (secondResponse.status !== 201) {
    throw new Error(
      `Second message failed: ${JSON.stringify(
        secondResult,
      )}`,
    );
  }

  const secondMessageId =
    secondResult.data.id;

  console.log("✅ Two messages created.");

  // ============================================
  // Fetch history
  // ============================================

  console.log(
    "\n📥 Fetching DM history...",
  );

  const historyResponse = await fetch(
    `${API_URL}/api/conversations/${conversationId}/messages`,
    {
      headers: {
        Authorization: `Bearer ${aliceToken}`,
      },
    },
  );

  const historyResult =
    await historyResponse.json();

  console.log(
    "HTTP Status:",
    historyResponse.status,
  );

  if (historyResponse.status !== 200) {
    console.error(
      "❌ History request failed:",
      historyResult,
    );

    process.exit(1);
  }

  const messages = historyResult.data;

  if (!Array.isArray(messages)) {
    console.error(
      "❌ History data is not an array.",
    );

    process.exit(1);
  }

  const firstFound = messages.find(
    (message: { id: string }) =>
      message.id === firstMessageId,
  );

  const secondFound = messages.find(
    (message: { id: string }) =>
      message.id === secondMessageId,
  );

  if (!firstFound || !secondFound) {
    console.error(
      "❌ Created messages were not found in history.",
    );

    process.exit(1);
  }

  console.log(
    "✅ Both messages found in history.",
  );

  // ============================================
  // Verify chronological ordering
  // ============================================

  const firstIndex = messages.findIndex(
    (message: { id: string }) =>
      message.id === firstMessageId,
  );

  const secondIndex = messages.findIndex(
    (message: { id: string }) =>
      message.id === secondMessageId,
  );

  if (firstIndex >= secondIndex) {
    console.error(
      "❌ Messages are not in chronological order.",
    );

    process.exit(1);
  }

  console.log(
    "✅ Messages are chronologically ordered.",
  );

  // ============================================
  // Pagination
  // ============================================

  console.log(
    "\n📄 Testing pagination...",
  );

  const paginationResponse =
    await fetch(
      `${API_URL}/api/conversations/${conversationId}/messages?limit=1`,
      {
        headers: {
          Authorization: `Bearer ${aliceToken}`,
        },
      },
    );

  const paginationResult =
    await paginationResponse.json();

  if (paginationResponse.status !== 200) {
    console.error(
      "❌ Pagination request failed:",
      paginationResult,
    );

    process.exit(1);
  }

  if (
    !Array.isArray(paginationResult.data) ||
    paginationResult.data.length !== 1
  ) {
    console.error(
      "❌ limit=1 was not respected.",
    );

    process.exit(1);
  }

  console.log(
    "✅ Pagination limit works.",
  );

  // ============================================
  // Charlie isolation
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
    "\n🚫 Charlie is requesting Alice ↔ Bob history...",
  );

  const forbiddenResponse =
    await fetch(
      `${API_URL}/api/conversations/${conversationId}/messages`,
      {
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
      "❌ Conversation isolation failed.",
    );

    process.exit(1);
  }

  if (
    forbiddenResult.error?.code !==
    "CONVERSATION_ACCESS_DENIED"
  ) {
    console.error(
      "❌ Incorrect authorization error.",
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
    "\n🎉 DIRECT MESSAGE HISTORY TEST PASSED!",
  );

  console.log(
    "✅ Messages persist.",
  );

  console.log(
    "✅ History can be retrieved.",
  );

  console.log(
    "✅ Chronological ordering works.",
  );

  console.log(
    "✅ Pagination works.",
  );

  console.log(
    "✅ Conversation isolation works.",
  );
};

main().catch((error) => {
  console.error(
    "❌ Unexpected error:",
    error,
  );

  process.exit(1);
});