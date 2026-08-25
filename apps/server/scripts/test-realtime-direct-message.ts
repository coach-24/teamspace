import "dotenv/config";
import WebSocket from "ws";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const TEST_PASSWORD = process.env.TEST_PASSWORD!;

const API_URL = "http://127.0.0.1:4000";
const WS_URL = "ws://127.0.0.1:4000/ws";

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

const wait = (ms: number) =>
  new Promise<void>((resolve) =>
    setTimeout(resolve, ms),
  );

const main = async () => {
  console.log("🔐 Logging in Alice...");

  const aliceToken = await login(
    "alice@teamspace.dev",
    TEST_PASSWORD,
  );

  console.log("✅ Alice logged in.");

  console.log("\n🔐 Logging in Bob...");

  const bobToken = await login(
    "bob@teamspace.dev",
    TEST_PASSWORD,
  );

  console.log("✅ Bob logged in.");

  // ============================================
  // Find/create conversation
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
    throw new Error(
      `Conversation failed: ${JSON.stringify(
        conversationResult,
      )}`,
    );
  }

  const conversationId =
    conversationResult.data.id;

  console.log(
    "✅ Conversation:",
    conversationId,
  );

  // ============================================
  // Connect Bob
  // ============================================

  console.log("\n🔌 Connecting Bob...");

  const bobSocket = new WebSocket(
    `${WS_URL}?token=${encodeURIComponent(
      bobToken,
    )}`,
  );

  let bobAuthenticated = false;
  let receivedDM = false;

  bobSocket.on("open", () => {
    console.log(
      "✅ Bob WebSocket connected.",
    );
  });

  bobSocket.on("message", (raw) => {
    const message = JSON.parse(
      raw.toString(),
    );

    console.log("\n📨 Bob received:");
    console.log(
      JSON.stringify(message, null, 2),
    );

    if (
      message.type ===
      "connection.authenticated"
    ) {
      bobAuthenticated = true;
      console.log(
        "🔐 Bob authenticated.",
      );
    }

    if (
      message.type ===
      "direct_message.created"
    ) {
      if (
        message.data?.conversation_id !==
        conversationId
      ) {
        return;
      }

      receivedDM = true;

      console.log(
        "\n⚡ Bob received Alice's DM!",
      );

      console.log(
        "Content:",
        message.data.content,
      );
    }
  });

  bobSocket.on("error", (error) => {
    console.error(
      "❌ Bob WebSocket error:",
      error,
    );
  });

  // ============================================
  // Wait for authentication
  // ============================================

  for (
    let i = 0;
    i < 50 && !bobAuthenticated;
    i++
  ) {
    await wait(100);
  }

  if (!bobAuthenticated) {
    console.error(
      "\n❌ Bob WebSocket authentication timeout.",
    );

    bobSocket.close();
    process.exit(1);
  }

  // ============================================
  // Alice sends DM
  // ============================================

  const content =
    `Realtime DM ${Date.now()} ⚡💬`;

  console.log(
    "\n📨 Alice is sending a DM...",
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

  console.log(
    "\n📡 Alice DM response:",
  );
  console.log(
    JSON.stringify(
      sendResult,
      null,
      2,
    ),
  );

  if (sendResponse.status !== 201) {
    console.error(
      "\n❌ Alice failed to send DM.",
    );

    bobSocket.close();
    process.exit(1);
  }

  // ============================================
  // Wait for Bob
  // ============================================

  for (
    let i = 0;
    i < 50 && !receivedDM;
    i++
  ) {
    await wait(100);
  }

  bobSocket.close();

  if (!receivedDM) {
    console.error(
      "\n❌ Bob never received direct_message.created.",
    );

    process.exit(1);
  }

  console.log(
    "\n🎉 REALTIME DIRECT MESSAGE TEST PASSED!",
  );

  console.log(
    "✅ Alice sent DM through REST.",
  );

  console.log(
    "✅ DM was persisted.",
  );

  console.log(
    "✅ Bob received direct_message.created.",
  );

  console.log(
    "✅ Realtime DM delivery works.",
  );
};

main().catch((error) => {
  console.error(
    "❌ Unexpected error:",
    error,
  );

  process.exit(1);
});