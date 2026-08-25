import "dotenv/config";
import WebSocket from "ws";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

const ALICE_PASSWORD = process.env.TEST_PASSWORD!;
const BOB_PASSWORD = process.env.TEST_PASSWORD!;

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
  // Connect Bob
  // ============================================

  console.log("\n🔌 Connecting Bob...");

  const bobSocket = new WebSocket(
    `${WS_URL}?token=${encodeURIComponent(bobToken)}`,
  );

  let bobAuthenticated = false;
  let bobJoined = false;
  let typingStartReceived = false;
  let typingStopReceived = false;

  bobSocket.on("open", () => {
    console.log("✅ Bob WebSocket connected.");
  });

  bobSocket.on("message", (data) => {
    const message = JSON.parse(data.toString());

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

      return;
    }

    if (
      message.type === "typing.start" &&
      message.channelId === CHANNEL_ID &&
      message.user?.email ===
        "alice@teamspace.dev"
    ) {
      typingStartReceived = true;

      console.log(
        "\n✍️ Bob detected Alice START typing!",
      );
    }

    if (
      message.type === "typing.stop" &&
      message.channelId === CHANNEL_ID &&
      message.user?.email ===
        "alice@teamspace.dev"
    ) {
      typingStopReceived = true;

      console.log(
        "\n🛑 Bob detected Alice STOP typing!",
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

  while (!bobAuthenticated || !bobJoined) {
    await wait(50);
  }

  console.log(
    "\n✅ Bob is authenticated and joined.",
  );

  // ============================================
  // Connect Alice
  // ============================================

  console.log("\n🔌 Connecting Alice...");

  const aliceSocket = new WebSocket(
    `${WS_URL}?token=${encodeURIComponent(aliceToken)}`,
  );

  let aliceAuthenticated = false;
  let aliceJoined = false;

  aliceSocket.on("open", () => {
    console.log(
      "✅ Alice WebSocket connected.",
    );
  });

  aliceSocket.on("message", (data) => {
    const message = JSON.parse(data.toString());

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

  while (!aliceAuthenticated || !aliceJoined) {
    await wait(50);
  }

  console.log(
    "\n✅ Alice is authenticated and joined.",
  );

  // ============================================
  // typing.start
  // ============================================

  console.log(
    "\n✍️ Alice is starting to type...",
  );

  aliceSocket.send(
    JSON.stringify({
      type: "typing.start",
      channelId: CHANNEL_ID,
    }),
  );

  await wait(500);

  if (!typingStartReceived) {
    console.error(
      "\n❌ TYPING START TEST FAILED!",
    );

    aliceSocket.close();
    bobSocket.close();
    process.exit(1);
  }

  console.log(
    "\n🎉 TYPING START TEST PASSED!",
  );

  // ============================================
  // typing.stop
  // ============================================

  console.log(
    "\n🛑 Alice stopped typing...",
  );

  aliceSocket.send(
    JSON.stringify({
      type: "typing.stop",
      channelId: CHANNEL_ID,
    }),
  );

  await wait(500);

  if (!typingStopReceived) {
    console.error(
      "\n❌ TYPING STOP TEST FAILED!",
    );

    aliceSocket.close();
    bobSocket.close();
    process.exit(1);
  }

  console.log(
    "\n🎉 TYPING STOP TEST PASSED!",
  );

  console.log(
    "\n🎉 REALTIME TYPING TEST PASSED!",
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