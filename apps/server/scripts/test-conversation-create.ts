import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const TEST_PASSWORD = process.env.TEST_PASSWORD!;

const API_URL = "http://127.0.0.1:4000";

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
  // Login Alice
  // ============================================

  console.log("🔐 Logging in Alice...");

  const aliceToken = await login(
    "alice@teamspace.dev",
    TEST_PASSWORD,
  );

  console.log("✅ Alice logged in.");

  // ============================================
  // Resolve Bob's TeamSpace user ID
  // ============================================

  console.log("\n🔎 Resolving Bob...");

  const usersResponse = await fetch(
    `${API_URL}/api/workspaces`,
    {
      headers: {
        Authorization: `Bearer ${aliceToken}`,
      },
    },
  );

  if (!usersResponse.ok) {
    throw new Error(
      `Could not verify Alice authentication: ${await usersResponse.text()}`,
    );
  }

  // Bob's known TeamSpace ID from previous tests.
  const bobUserId =
    "23498c3d-1077-4abb-8d7c-ea5e48f29aae";

  console.log(
    "✅ Bob user ID:",
    bobUserId,
  );

  // ============================================
  // Create conversation
  // ============================================

  console.log(
    "\n💬 Alice is creating a conversation with Bob...",
  );

  const firstResponse = await fetch(
    `${API_URL}/api/conversations`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aliceToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: bobUserId,
      }),
    },
  );

  const firstResult =
    await firstResponse.json();

  console.log(
    "\n📡 First Response",
  );
  console.log(
    "======================",
  );
  console.log(
    "HTTP Status:",
    firstResponse.status,
  );
  console.log(
    "Response:",
    JSON.stringify(
      firstResult,
      null,
      2,
    ),
  );

  if (
    firstResponse.status !== 201 &&
    firstResponse.status !== 200
  ) {
    console.error(
      "\n❌ Conversation creation failed.",
    );

    process.exit(1);
  }

  const conversationId =
    firstResult.data?.id;

  if (!conversationId) {
    console.error(
      "\n❌ No conversation ID returned.",
    );

    process.exit(1);
  }

  const members =
    firstResult.data?.members ?? [];

  if (members.length !== 2) {
    console.error(
      "\n❌ Conversation should contain exactly 2 members.",
    );

    process.exit(1);
  }

  const memberIds = members.map(
    (member: { id: string }) =>
      member.id,
  );

  if (!memberIds.includes(bobUserId)) {
    console.error(
      "\n❌ Bob is not a conversation member.",
    );

    process.exit(1);
  }

  console.log(
    "\n✅ Alice and Bob are conversation members.",
  );

  // ============================================
  // Call endpoint again
  // ============================================

  console.log(
    "\n🔁 Requesting the same conversation again...",
  );

  const secondResponse = await fetch(
    `${API_URL}/api/conversations`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aliceToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: bobUserId,
      }),
    },
  );

  const secondResult =
    await secondResponse.json();

  console.log(
    "Second HTTP Status:",
    secondResponse.status,
  );

  console.log(
    "Second Response:",
    JSON.stringify(
      secondResult,
      null,
      2,
    ),
  );

  if (secondResponse.status !== 200) {
    console.error(
      "\n❌ Existing conversation was not reused.",
    );

    process.exit(1);
  }

  if (
    secondResult.data?.id !== conversationId
  ) {
    console.error(
      "\n❌ A duplicate conversation was created.",
    );

    process.exit(1);
  }

  console.log(
    "\n🎉 CONVERSATION CREATE TEST PASSED!",
  );

  console.log(
    "✅ Alice created a conversation with Bob.",
  );

  console.log(
    "✅ Conversation contains Alice and Bob.",
  );

  console.log(
    "✅ Existing conversation is reused.",
  );
};

main().catch((error) => {
  console.error(
    "❌ Unexpected error:",
    error,
  );

  process.exit(1);
});