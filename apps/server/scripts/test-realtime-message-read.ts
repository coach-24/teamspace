import "dotenv/config";
import WebSocket from "ws";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

const ALICE_PASSWORD = process.env.TEST_PASSWORD!;
const BOB_PASSWORD = process.env.TEST_PASSWORD!;

const API_URL = "http://127.0.0.1:4000";
const WS_URL = "ws://127.0.0.1:4000/ws";

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

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const main = async () => {
  // ============================================
  // Login
  // ============================================

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
  // Alice creates message
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
        content: `Realtime read test ${Date.now()} 👀`,
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
  // Connect Alice
  // ============================================

  console.log("\n🔌 Connecting Alice...");

  const aliceSocket = new WebSocket(
    `${WS_URL}?token=${encodeURIComponent(
      aliceToken,
    )}`,
  );

  let aliceAuthenticated = false;
  let aliceJoined = false;
  let readEventReceived = false;

  aliceSocket.on("open", () => {
    console.log(
      "✅ Alice WebSocket connected.",
    );
  });

  aliceSocket.on("message", (data) => {
    const message = JSON.parse(
      data.toString(),
    );

    console.log("\n📨 Alice received:");
    console.log(
      JSON.stringify(message, null, 2),
    );

    if (
      message.type ===
      "connection.authenticated"
    ) {
      aliceAuthenticated = true;

      aliceSocket.send(
        JSON.stringify({
          type: "channel.join",
          channelId: CHANNEL_ID,
        }),
      );

      console.log(
        "📡 Alice joining Secret Project...",
      );

      return;
    }

    if (
      message.type === "channel.joined" &&
      message.channelId === CHANNEL_ID
    ) {
      aliceJoined = true;

      console.log(
        "✅ Alice joined Secret Project.",
      );

      return;
    }

    if (
      message.type === "message.read" &&
      message.data?.message_id ===
        messageId &&
      message.data?.user_id
    ) {
      readEventReceived = true;

      console.log(
        "\n👀 Alice received Bob's read receipt!",
      );

      console.log(
        "Read at:",
        message.data.read_at,
      );
    }
  });

  aliceSocket.on(
    "error",
    (error: Error) => {
      console.error(
        "❌ Alice WebSocket error:",
        error,
      );

      process.exit(1);
    },
  );

  // ============================================
  // Wait for Alice
  // ============================================

  while (
    !aliceAuthenticated ||
    !aliceJoined
  ) {
    await wait(50);
  }

  console.log(
    "\n✅ Alice is authenticated and joined.",
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
  let bobJoined = false;

  bobSocket.on("open", () => {
    console.log(
      "✅ Bob WebSocket connected.",
    );
  });

  bobSocket.on("message", (data) => {
    const message = JSON.parse(
      data.toString(),
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

      bobSocket.send(
        JSON.stringify({
          type: "channel.join",
          channelId: CHANNEL_ID,
        }),
      );

      console.log(
        "📡 Bob joining Secret Project...",
      );

      return;
    }

    if (
      message.type === "channel.joined" &&
      message.channelId === CHANNEL_ID
    ) {
      bobJoined = true;

      console.log(
        "✅ Bob joined Secret Project.",
      );
    }
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
  // Wait for Bob
  // ============================================

  while (
    !bobAuthenticated ||
    !bobJoined
  ) {
    await wait(50);
  }

  console.log(
    "\n✅ Bob is authenticated and joined.",
  );

  // ============================================
  // Bob marks message as read
  // ============================================

  console.log(
    "\n👀 Bob is marking Alice's message as read...",
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

  console.log(
    "\n📡 Read Receipt REST Response",
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
      "\n❌ REST read receipt failed.",
    );

    aliceSocket.close();
    bobSocket.close();
    process.exit(1);
  }

  console.log(
    "\n✅ Bob successfully marked the message as read.",
  );

  // ============================================
  // Wait for Alice's WebSocket event
  // ============================================

  await wait(750);

  if (!readEventReceived) {
    console.error(
      "\n❌ REALTIME READ RECEIPT TEST FAILED!",
    );

    console.error(
      "Alice never received message.read.",
    );

    aliceSocket.close();
    bobSocket.close();
    process.exit(1);
  }

  console.log(
    "\n🎉 REALTIME READ RECEIPT TEST PASSED!",
  );

  console.log(
    "✅ Bob marked the message as read.",
  );

  console.log(
    "✅ Alice received message.read over WebSocket.",
  );

  aliceSocket.close();
  bobSocket.close();
};

main().catch((error) => {
  console.error(
    "❌ Unexpected error:",
    error,
  );

  process.exit(1);
});