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

  const aliceSocket = new WebSocket(
    `${WS_URL}?token=${encodeURIComponent(aliceToken)}`,
  );

  const bobSocket = new WebSocket(
    `${WS_URL}?token=${encodeURIComponent(bobToken)}`,
  );

  let aliceAuthenticated = false;
  let bobAuthenticated = false;
  let aliceJoined = false;
  let bobJoined = false;
  let messageReceived = false;
  let messageCreated = false;

  const messageContent =
    `Realtime test ${Date.now()} ⚡`;

  const finish = () => {
    aliceSocket.close();
    bobSocket.close();

    if (
      aliceAuthenticated &&
      bobAuthenticated &&
      aliceJoined &&
      bobJoined &&
      messageCreated &&
      messageReceived
    ) {
      console.log(
        "\n🎉 REALTIME MESSAGE TEST PASSED!",
      );
      console.log(
        "Alice created a message and Bob received it over WebSocket.",
      );

      process.exit(0);
    }

    console.log(
      "\n❌ REALTIME MESSAGE TEST FAILED.",
    );

    process.exit(1);
  };

  aliceSocket.on("open", () => {
    console.log("🔌 Alice WebSocket connected.");
  });

  bobSocket.on("open", () => {
    console.log("🔌 Bob WebSocket connected.");
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
          channelId,
        }),
      );
    }

    if (
      message.type === "channel.joined" &&
      message.channelId === channelId
    ) {
      aliceJoined = true;

      maybeCreateMessage();
    }
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
          channelId,
        }),
      );
    }

    if (
      message.type === "channel.joined" &&
      message.channelId === channelId
    ) {
      bobJoined = true;

      maybeCreateMessage();
    }

    if (
      message.type === "message.created" &&
      message.data?.content === messageContent
    ) {
      messageReceived = true;

      console.log(
        "\n⚡ Bob received Alice's realtime message!",
      );

      if (
        aliceAuthenticated &&
        bobAuthenticated &&
        aliceJoined &&
        bobJoined &&
        messageCreated &&
        messageReceived
      ) {
        finish();
      }
    }
  });

  aliceSocket.on("error", (error: Error) => {
    console.error(
      "❌ Alice WebSocket error:",
      error,
    );
    process.exit(1);
  });

  bobSocket.on("error", (error: Error) => {
    console.error(
      "❌ Bob WebSocket error:",
      error,
    );
    process.exit(1);
  });

  const maybeCreateMessage = async () => {
    if (
      !aliceAuthenticated ||
      !bobAuthenticated ||
      !aliceJoined ||
      !bobJoined ||
      messageCreated
    ) {
      return;
    }

    messageCreated = true;

    console.log(
      "\n📡 Alice is creating a message through REST...",
    );

    const response = await fetch(
      `${API_URL}/api/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aliceToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: messageContent,
        }),
      },
    );

    const result = await response.json();

    console.log("\n📡 REST Response");
    console.log("======================");
    console.log(
      "HTTP Status:",
      response.status,
    );
    console.log(
      "Response:",
      JSON.stringify(result, null, 2),
    );

    if (response.status !== 201) {
      console.error(
        "\n❌ Message creation failed.",
      );

      aliceSocket.close();
      bobSocket.close();
      process.exit(1);
    }

    console.log(
      "\n✅ Alice's message created in database.",
    );
  };

  setTimeout(() => {
    console.error(
      "\n❌ REALTIME TEST TIMEOUT.",
    );

    aliceSocket.close();
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