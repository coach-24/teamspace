import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

const ALICE_PASSWORD = process.env.TEST_PASSWORD!;
const BOB_PASSWORD = process.env.TEST_PASSWORD!;

const API_URL = "http://127.0.0.1:4000";

const CHANNEL_ID =
  "02451e5a-74bf-448a-a038-fae32cd6b9c4";

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
    ALICE_PASSWORD,
  );

  console.log("✅ Alice logged in.");

  // ============================================
  // Login Bob
  // ============================================

  console.log("\n🔐 Logging in Bob...");

  const bobToken = await login(
    "bob@teamspace.dev",
    BOB_PASSWORD,
  );

  console.log("✅ Bob logged in.");

  // ============================================
  // Alice creates a message
  // ============================================

  console.log(
    "\n📝 Alice is creating a message...",
  );

  const createResponse = await fetch(
    `${API_URL}/api/channels/${CHANNEL_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aliceToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: `Read receipt test ${Date.now()} 👀`,
      }),
    },
  );

  const createResult =
    await createResponse.json();

  if (createResponse.status !== 201) {
    throw new Error(
      `Message creation failed: ${JSON.stringify(
        createResult,
      )}`,
    );
  }

  const messageId =
    createResult.data.id;

  console.log(
    "✅ Message created:",
    messageId,
  );

  // ============================================
  // Bob marks message as read
  // ============================================

  console.log(
    "\n👀 Bob is marking the message as read...",
  );

  const readResponse = await fetch(
    `${API_URL}/api/messages/${messageId}/read`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bobToken}`,
      },
    },
  );

  const readResult =
    await readResponse.json();

  console.log("\n📡 Read Receipt Response");
  console.log("======================");
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
      "\n❌ READ RECEIPT TEST FAILED!",
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
    "\n🎉 READ RECEIPT REST TEST PASSED!",
  );

  console.log(
    "✅ Bob successfully marked Alice's message as read.",
  );
};

main().catch((error) => {
  console.error(
    "❌ Unexpected error:",
    error,
  );

  process.exit(1);
});