import "dotenv/config";
import WebSocket from "ws";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

const ALICE_PASSWORD = process.env.TEST_PASSWORD!;
const BOB_PASSWORD = process.env.TEST_PASSWORD!;
const CHARLIE_PASSWORD =
  process.env.TEST_PASSWORD!;

const API_URL = "http://127.0.0.1:4000";
const WS_URL = "ws://127.0.0.1:4000/ws";

const secretChannelId =
  "02451e5a-74bf-448a-a038-fae32cd6b9c4";

const generalChannelId =
  "3b16e91f-7d77-4de5-8fba-2d26ac5b6151";

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

  console.log("\n🔐 Logging in Charlie...");
  const charlieToken = await login(
    "charlie@teamspace.dev",
    CHARLIE_PASSWORD,
  );
  console.log("✅ Charlie logged in.");

  const aliceSocket = new WebSocket(
    `${WS_URL}?token=${encodeURIComponent(aliceToken)}`,
  );

  const bobSocket = new WebSocket(
    `${WS_URL}?token=${encodeURIComponent(bobToken)}`,
  );

  const charlieSocket = new WebSocket(
    `${WS_URL}?token=${encodeURIComponent(charlieToken)}`,
  );

  let aliceAuthenticated = false;
  let bobAuthenticated = false;
  let charlieAuthenticated = false;

  let aliceJoined = false;
  let bobJoined = false;
  let charlieJoined = false;

  let messageCreated = false;
  let bobReceivedMessage = false;
  let charlieReceivedMessage = false;

  const messageContent =
    `Channel isolation test ${Date.now()} ⚡`;

  let finished = false;

  const cleanup = () => {
    aliceSocket.close();
    bobSocket.close();
    charlieSocket.close();
  };

  const finish = (passed: boolean) => {
    if (finished) {
      return;
    }

    finished = true;

    cleanup();

    if (passed) {
      console.log(
        "\n🎉 REALTIME CHANNEL ISOLATION TEST PASSED!",
      );

      console.log(
        "Bob received the message from Secret Project.",
      );

      console.log(
        "Charlie did NOT receive the Secret Project message.",
      );

      process.exit(0);
    }

    console.log(
      "\n❌ REALTIME CHANNEL ISOLATION TEST FAILED!",
    );

    process.exit(1);
  };

  const createMessage = async () => {
    if (
      !aliceAuthenticated ||
      !bobAuthenticated ||
      !charlieAuthenticated ||
      !aliceJoined ||
      !bobJoined ||
      !charlieJoined ||
      messageCreated
    ) {
      return;
    }

    messageCreated = true;

    console.log(
      "\n📡 Alice is creating a message in Secret Project...",
    );

    const response = await fetch(
      `${API_URL}/api/channels/${secretChannelId}/messages`,
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
        "\n❌ Alice failed to create message.",
      );

      finish(false);
      return;
    }

    console.log(
      "\n✅ Message created in Secret Project.",
    );

    console.log(
      "⏳ Waiting to verify channel isolation...",
    );
  };

  aliceSocket.on("open", () => {
    console.log(
      "🔌 Alice WebSocket connected.",
    );
  });

  bobSocket.on("open", () => {
    console.log(
      "🔌 Bob WebSocket connected.",
    );
  });

  charlieSocket.on("open", () => {
    console.log(
      "🔌 Charlie WebSocket connected.",
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
          channelId: secretChannelId,
        }),
      );

      console.log(
        "📡 Alice joining Secret Project...",
      );
    }

    if (
      message.type === "channel.joined" &&
      message.channelId === secretChannelId
    ) {
      aliceJoined = true;

      console.log(
        "✅ Alice joined Secret Project.",
      );

      void createMessage();
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
          channelId: secretChannelId,
        }),
      );

      console.log(
        "📡 Bob joining Secret Project...",
      );
    }

    if (
      message.type === "channel.joined" &&
      message.channelId === secretChannelId
    ) {
      bobJoined = true;

      console.log(
        "✅ Bob joined Secret Project.",
      );

      void createMessage();
    }

    if (
      message.type === "message.created" &&
      message.data?.content === messageContent
    ) {
      bobReceivedMessage = true;

      console.log(
        "\n⚡ Bob received Secret Project message!",
      );

      if (charlieReceivedMessage) {
        finish(false);
      }
    }
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
          channelId: generalChannelId,
        }),
      );

      console.log(
        "📡 Charlie joining General...",
      );
    }

    if (
      message.type === "channel.joined" &&
      message.channelId === generalChannelId
    ) {
      charlieJoined = true;

      console.log(
        "✅ Charlie joined General.",
      );

      void createMessage();
    }

    if (
      message.type === "message.created" &&
      message.data?.content === messageContent
    ) {
      charlieReceivedMessage = true;

      console.log(
        "\n🚨 SECURITY FAILURE!",
      );

      console.log(
        "Charlie received a message from Secret Project.",
      );

      finish(false);
    }
  });

  aliceSocket.on("error", (error: Error) => {
    console.error(
      "❌ Alice WebSocket error:",
      error,
    );

    finish(false);
  });

  bobSocket.on("error", (error: Error) => {
    console.error(
      "❌ Bob WebSocket error:",
      error,
    );

    finish(false);
  });

  charlieSocket.on(
    "error",
    (error: Error) => {
      console.error(
        "❌ Charlie WebSocket error:",
        error,
      );

      finish(false);
    },
  );

  // Give Bob/Charlie time to receive the event.
  setTimeout(() => {
    if (
      messageCreated &&
      bobReceivedMessage &&
      !charlieReceivedMessage
    ) {
      finish(true);
      return;
    }

    console.error(
      "\n❌ Isolation verification timed out.",
    );

    console.error({
      aliceJoined,
      bobJoined,
      charlieJoined,
      messageCreated,
      bobReceivedMessage,
      charlieReceivedMessage,
    });

    finish(false);
  }, 5000);
};

main().catch((error) => {
  console.error(
    "❌ Unexpected error:",
    error,
  );

  process.exit(1);
});