import "dotenv/config";
import WebSocket from "ws";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

const ALICE_PASSWORD = process.env.TEST_PASSWORD!;
const BOB_PASSWORD = process.env.TEST_PASSWORD!;
const CHARLIE_PASSWORD = process.env.TEST_PASSWORD!;

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

  console.log("\n🔐 Logging in Charlie...");
  const charlieToken = await login(
    "charlie@teamspace.dev",
    CHARLIE_PASSWORD,
  );
  console.log("✅ Charlie logged in.");

  // ============================================
  // Alice creates message
  // ============================================

  console.log(
    "\n📝 Alice is creating a private-channel message...",
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
        content: `Read isolation test ${Date.now()} 👀`,
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
  // Charlie tries REST read
  // ============================================

  console.log(
    "\n🚫 Charlie attempts to mark the message as read...",
  );

  const charlieReadResponse = await fetch(
    `${API_URL}/api/messages/${messageId}/read`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${charlieToken}`,
      },
    },
  );

  const charlieReadResult =
    await charlieReadResponse.json();

  console.log(
    "\n📡 Charlie Read Response",
  );
  console.log(
    "======================",
  );
  console.log(
    "HTTP Status:",
    charlieReadResponse.status,
  );
  console.log(
    "Response:",
    JSON.stringify(
      charlieReadResult,
      null,
      2,
    ),
  );

  if (charlieReadResponse.status !== 403) {
    console.error(
      "\n❌ SECURITY TEST FAILED!",
    );

    console.error(
      "Charlie was incorrectly allowed to mark the private message as read.",
    );

    process.exit(1);
  }

  console.log(
    "\n🔐 Charlie was correctly denied read access.",
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
  let aliceReadReceived = false;

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
      return;
    }

    if (
      message.type === "message.read" &&
      message.data?.message_id ===
        messageId
    ) {
      aliceReadReceived = true;

      console.log(
        "\n👀 Alice received Bob's read receipt.",
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

      return;
    }

    if (
      message.type === "channel.joined" &&
      message.channelId === CHANNEL_ID
    ) {
      bobJoined = true;
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
  let charlieReadReceived = false;

  charlieSocket.on("open", () => {
    console.log(
      "✅ Charlie WebSocket connected.",
    );
  });

  charlieSocket.on("message", (data) => {
    const message = JSON.parse(data.toString());

    console.log("\n📨 Charlie received:");
    console.log(
      JSON.stringify(message, null, 2),
    );

    if (
      message.type ===
      "connection.authenticated"
    ) {
      charlieAuthenticated = true;

      charlieSocket.send(
        JSON.stringify({
          type: "channel.join",
          channelId: CHANNEL_ID,
        }),
      );

      return;
    }

    if (
      message.type === "error" &&
      message.code === "CHANNEL_ACCESS_DENIED"
    ) {
      charlieJoinDenied = true;
      return;
    }

    if (
      message.type === "message.read" &&
      message.data?.message_id ===
        messageId
    ) {
      charlieReadReceived = true;

      console.log(
        "\n❌ Charlie received Bob's read receipt!",
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
  // Wait for authentication/join
  // ============================================

  while (
    !aliceAuthenticated ||
    !aliceJoined ||
    !bobAuthenticated ||
    !bobJoined ||
    !charlieAuthenticated
  ) {
    await wait(50);
  }

  while (!charlieJoinDenied) {
    await wait(50);
  }

  console.log(
    "\n✅ Alice and Bob joined; Charlie was denied.",
  );

  // ============================================
  // Bob marks message as read
  // ============================================

  console.log(
    "\n👀 Bob is marking Alice's message as read...",
  );

  const bobReadResponse = await fetch(
    `${API_URL}/api/messages/${messageId}/read`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bobToken}`,
      },
    },
  );

  const bobReadResult =
    await bobReadResponse.json();

  console.log(
    "\n📡 Bob Read Response",
  );
  console.log(
    "======================",
  );
  console.log(
    "HTTP Status:",
    bobReadResponse.status,
  );
  console.log(
    "Response:",
    JSON.stringify(
      bobReadResult,
      null,
      2,
    ),
  );

  if (bobReadResponse.status !== 200) {
    console.error(
      "\n❌ Bob failed to mark message as read.",
    );

    aliceSocket.close();
    bobSocket.close();
    charlieSocket.close();

    process.exit(1);
  }

  await wait(750);

  // ============================================
  // Verify Alice received event
  // ============================================

  if (!aliceReadReceived) {
    console.error(
      "\n❌ Alice did not receive message.read.",
    );

    aliceSocket.close();
    bobSocket.close();
    charlieSocket.close();

    process.exit(1);
  }

  console.log(
    "\n✅ Alice received Bob's read receipt.",
  );

  // ============================================
  // Verify Charlie received nothing
  // ============================================

  if (charlieReadReceived) {
    console.error(
      "\n❌ READ RECEIPT ISOLATION FAILED!",
    );

    console.error(
      "Charlie received a private-channel read receipt.",
    );

    aliceSocket.close();
    bobSocket.close();
    charlieSocket.close();

    process.exit(1);
  }

  console.log(
    "🔐 Charlie received no read receipt.",
  );

  console.log(
    "\n🎉 REALTIME READ RECEIPT ISOLATION TEST PASSED!",
  );

  console.log(
    "✅ Charlie cannot mark the private message as read.",
  );

  console.log(
    "✅ Bob can mark the message as read.",
  );

  console.log(
    "✅ Alice receives Bob's read receipt.",
  );

  console.log(
    "✅ Charlie receives nothing.",
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