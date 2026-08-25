import "dotenv/config";
import WebSocket from "ws";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

const ALICE_PASSWORD = process.env.TEST_PASSWORD!;
const BOB_PASSWORD = process.env.TEST_PASSWORD!;
const CHARLIE_PASSWORD = process.env.TEST_PASSWORD!;

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

  console.log("\n🔐 Logging in Charlie...");
  const charlieToken = await login(
    "charlie@teamspace.dev",
    CHARLIE_PASSWORD,
  );
  console.log("✅ Charlie logged in.");

  // ============================================
  // Connect Bob
  // ============================================

  console.log("\n🔌 Connecting Bob...");

  const bobSocket = new WebSocket(
    `${WS_URL}?token=${encodeURIComponent(bobToken)}`,
  );

  let bobAuthenticated = false;
  let bobJoined = false;
  let bobTypingReceived = false;

  bobSocket.on("open", () => {
    console.log("✅ Bob WebSocket connected.");
  });

  bobSocket.on("message", (data) => {
    const message = JSON.parse(data.toString());

    console.log("\n📨 Bob received:");
    console.log(JSON.stringify(message, null, 2));

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
      bobTypingReceived = true;

      console.log(
        "\n✍️ Bob received Alice's typing event!",
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
  // Connect Charlie
  // ============================================

  console.log("\n🔌 Connecting Charlie...");

  const charlieSocket = new WebSocket(
    `${WS_URL}?token=${encodeURIComponent(
      charlieToken,
    )}`,
  );

  let charlieAuthenticated = false;
  let charlieJoinDenied = false;
  let charlieTypingReceived = false;

  charlieSocket.on("open", () => {
    console.log(
      "✅ Charlie WebSocket connected.",
    );
  });

  charlieSocket.on("message", (data) => {
    const message = JSON.parse(data.toString());

    console.log("\n📨 Charlie received:");
    console.log(JSON.stringify(message, null, 2));

    if (
      message.type ===
      "connection.authenticated"
    ) {
      charlieAuthenticated = true;

      // Charlie attempts to join private channel.
      charlieSocket.send(
        JSON.stringify({
          type: "channel.join",
          channelId: CHANNEL_ID,
        }),
      );

      console.log(
        "📡 Charlie attempting to join Secret Project...",
      );

      return;
    }

    if (
      message.type === "error" &&
      message.code === "CHANNEL_ACCESS_DENIED"
    ) {
      charlieJoinDenied = true;

      console.log(
        "\n🔐 Charlie was correctly denied access.",
      );

      return;
    }

    if (
      message.type === "typing.start" &&
      message.channelId === CHANNEL_ID &&
      message.user?.email ===
        "alice@teamspace.dev"
    ) {
      charlieTypingReceived = true;

      console.log(
        "\n❌ Charlie received Alice's typing event!",
      );
    }
  });

  charlieSocket.on(
    "error",
    (error: Error) => {
      console.error(
        "❌ Charlie WebSocket error:",
        error,
      );

      process.exit(1);
    },
  );

  // ============================================
  // Wait for Bob + Charlie authentication
  // ============================================

  while (
    !bobAuthenticated ||
    !charlieAuthenticated
  ) {
    await wait(50);
  }

  console.log(
    "\n✅ Bob and Charlie authenticated.",
  );

  // ============================================
  // Wait for Charlie denial
  // ============================================

  while (!charlieJoinDenied) {
    await wait(50);
  }

  console.log(
    "✅ Charlie cannot join the private channel.",
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

  aliceSocket.on("open", () => {
    console.log(
      "✅ Alice WebSocket connected.",
    );
  });

  aliceSocket.on("message", (data) => {
    const message = JSON.parse(data.toString());

    console.log("\n📨 Alice received:");
    console.log(JSON.stringify(message, null, 2));

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
  // Alice starts typing
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

  await wait(750);

  // ============================================
  // Verify Bob received
  // ============================================

  if (!bobTypingReceived) {
    console.error(
      "\n❌ Bob did not receive Alice's typing event.",
    );

    aliceSocket.close();
    bobSocket.close();
    charlieSocket.close();

    process.exit(1);
  }

  console.log(
    "\n✅ Bob received Alice's typing event.",
  );

  // ============================================
  // Verify Charlie did NOT receive
  // ============================================

  if (charlieTypingReceived) {
    console.error(
      "\n❌ TYPING ISOLATION TEST FAILED!",
    );

    console.error(
      "Charlie received Alice's private-channel typing event.",
    );

    aliceSocket.close();
    bobSocket.close();
    charlieSocket.close();

    process.exit(1);
  }

  console.log(
    "🔐 Charlie did NOT receive Alice's typing event.",
  );

  console.log(
    "\n🎉 REALTIME TYPING ISOLATION TEST PASSED!",
  );

  console.log(
    "✅ Bob received the typing event.",
  );

  console.log(
    "✅ Charlie was denied private-channel access.",
  );

  console.log(
    "✅ Charlie received no typing event.",
  );

  aliceSocket.close();
  bobSocket.close();
  charlieSocket.close();

  process.exit(0);
};

main().catch((error) => {
  console.error(
    "❌ Unexpected error:",
    error,
  );

  process.exit(1);
});