import "dotenv/config";
import WebSocket from "ws";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const ALICE_PASSWORD = process.env.TEST_PASSWORD!;

const WS_URL = "ws://127.0.0.1:4000/ws";

const channelId =
  "02451e5a-74bf-448a-a038-fae32cd6b9c4";

const main = async () => {
  console.log("🔐 Logging in as Alice...");

  const loginResponse = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "alice@teamspace.dev",
        password: ALICE_PASSWORD,
      }),
    },
  );

  const loginData = await loginResponse.json();

  if (!loginResponse.ok) {
    console.error("❌ Alice login failed:");
    console.error(loginData);
    process.exit(1);
  }

  console.log("✅ Alice logged in.");

  const wsUrl =
    `${WS_URL}?token=${encodeURIComponent(
      loginData.access_token,
    )}`;

  console.log("\n🔌 Connecting Alice...");

  const socket = new WebSocket(wsUrl);

  let authenticated = false;

  socket.on("open", () => {
    console.log("✅ WebSocket connected.");
  });

  socket.on("message", (data) => {
    const message = JSON.parse(data.toString());

    console.log("\n📨 Server message");
    console.log("======================");
    console.log(
      JSON.stringify(message, null, 2),
    );

    if (
      message.type ===
      "connection.authenticated"
    ) {
      authenticated = true;

      console.log(
        "\n🔐 Alice authenticated.",
      );

      socket.send(
        JSON.stringify({
          type: "channel.join",
          channelId,
        }),
      );

      console.log(
        "📡 Alice requested channel.join",
      );
    }

    if (
      authenticated &&
      message.type === "channel.joined" &&
      message.channelId === channelId
    ) {
      console.log(
        "\n🎉 ALICE CHANNEL JOIN PASSED!",
      );
      console.log(
        "Alice can access the private channel.",
      );

      socket.close();
    }

    if (
      message.type === "error"
    ) {
      console.log(
        "\n❌ Alice channel join failed.",
      );

      socket.close();
      process.exit(1);
    }
  });

  socket.on("close", () => {
    console.log(
      "🔌 WebSocket connection closed.",
    );
  });

  socket.on("error", (error: Error) => {
    console.error(
      "❌ WebSocket error:",
      error,
    );

    process.exit(1);
  });
};

main().catch((error) => {
  console.error(
    "❌ Unexpected error:",
    error,
  );

  process.exit(1);
});