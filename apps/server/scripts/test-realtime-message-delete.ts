import "dotenv/config";
import WebSocket from "ws";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

const ALICE_PASSWORD = process.env.TEST_PASSWORD!;
const BOB_PASSWORD = process.env.TEST_PASSWORD!;

const API_URL = "http://127.0.0.1:4000";
const WS_URL = "ws://127.0.0.1:4000/ws";

const channelId =
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
  console.log("🔐 Logging in Alice...");

  const aliceToken = await login(
    "alice@teamspace.dev",
    ALICE_PASSWORD,
  );

  console.log("✅ Alice logged in.");

  console.log("\n🔐 Logging in Bob...");

  const bobToken = await login(
    "bob@teamspace.dev",
    BOB_PASSWORD,
  );

  console.log("✅ Bob logged in.");

  // ============================================
  // Create message
  // ============================================

  console.log(
    "\n📝 Alice is creating a message to delete...",
  );

  const createResponse = await fetch(
    `${API_URL}/api/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aliceToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: "Realtime delete test 🗑️",
      }),
    },
  );

  const createResult = await createResponse.json();

  if (createResponse.status !== 201) {
    console.error(
      "❌ Message creation failed:",
      createResult,
    );

    process.exit(1);
  }

  const messageId = createResult.data.id;

  console.log(
    "✅ Message created:",
    messageId,
  );

  // ============================================
  // Connect Bob
  // ============================================

  console.log("\n🔌 Connecting Bob...");

  const bobSocket = new WebSocket(
    `${WS_URL}?token=${encodeURIComponent(bobToken)}`,
  );

  let authenticated = false;
  let joined = false;
  let testPassed = false;

  bobSocket.on("open", () => {
    console.log(
      "✅ Bob WebSocket connected.",
    );
  });

  bobSocket.on("message", async (data) => {
    const message = JSON.parse(
      data.toString(),
    );

    console.log("\n📨 Bob received:");
    console.log(
      JSON.stringify(message, null, 2),
    );

    // ========================================
    // Authentication
    // ========================================

    if (
      message.type ===
      "connection.authenticated"
    ) {
      authenticated = true;

      bobSocket.send(
        JSON.stringify({
          type: "channel.join",
          channelId,
        }),
      );

      console.log(
        "📡 Bob joining Secret Project...",
      );

      return;
    }

    // ========================================
    // Channel joined
    // ========================================

    if (
      message.type === "channel.joined" &&
      message.channelId === channelId
    ) {
      joined = true;

      console.log(
        "✅ Bob joined Secret Project.",
      );

      // ======================================
      // Alice deletes the message
      // ======================================

      console.log(
        "\n🗑️ Alice is deleting the message...",
      );

      const deleteResponse = await fetch(
        `${API_URL}/api/messages/${messageId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${aliceToken}`,
          },
        },
      );

      console.log(
        "\n📡 Delete REST Response",
      );

      console.log(
        "======================",
      );

      console.log(
        "HTTP Status:",
        deleteResponse.status,
      );

      if (deleteResponse.status !== 204) {
        const deleteResult =
          await deleteResponse.text();

        console.error(
          "Response:",
          deleteResult,
        );

        console.error(
          "\n❌ Message deletion failed.",
        );

        bobSocket.close();
        process.exit(1);
      }

      console.log(
        "\n✅ Alice successfully deleted the message.",
      );

      return;
    }

    // ========================================
    // Realtime message.deleted
    // ========================================

    if (
      message.type === "message.deleted" &&
      message.data?.id === messageId &&
      message.data?.channel_id === channelId
    ) {
      console.log(
        "\n⚡ Bob received Alice's message deletion!",
      );

      console.log(
        "Deleted message ID:",
        message.data.id,
      );

      console.log(
        "\n🎉 REALTIME MESSAGE DELETE TEST PASSED!",
      );

      testPassed = true;

      bobSocket.close();

      process.exit(0);
    }
  });

  bobSocket.on("close", () => {
    console.log(
      "🔌 Bob WebSocket connection closed.",
    );
  });

  bobSocket.on(
    "error",
    (error: Error) => {
      console.error(
        "❌ Bob WebSocket error:",
        error,
      );

      process.exit(1);
    },
  );

  // ============================================
  // Timeout protection
  // ============================================

  setTimeout(() => {
    if (testPassed) {
      return;
    }

    if (!authenticated || !joined) {
      console.error(
        "\n❌ TEST TIMEOUT.",
      );
    } else {
      console.error(
        "\n❌ Bob never received message.deleted.",
      );
    }

    bobSocket.close();
    process.exit(1);
  }, 10000);
};

main().catch((error) => {
  console.error(
    "❌ Unexpected error:",
    error,
  );

  process.exit(1);
});