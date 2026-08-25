import "dotenv/config";
import WebSocket from "ws";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const ALICE_PASSWORD = process.env.TEST_PASSWORD!;

const WS_URL = "ws://127.0.0.1:4000/ws";

const main = async () => {
  // ============================================
  // Login as Alice
  // ============================================

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
  console.log("👤 User:", loginData.user?.email);

  // ============================================
  // Connect WebSocket with token
  // ============================================

  const wsUrl =
    `${WS_URL}?token=${encodeURIComponent(
      loginData.access_token,
    )}`;

  console.log("\n🔌 Connecting Alice to WebSocket...");

  const socket = new WebSocket(wsUrl);

  socket.on("open", () => {
    console.log("✅ WebSocket connection established.");
  });

  socket.on("message", (data) => {
    console.log("\n📨 Server message");
    console.log("======================");

    const rawMessage = data.toString();

    console.log(rawMessage);

    try {
      const message = JSON.parse(rawMessage);

      if (
        message.type ===
        "connection.authenticated"
      ) {
        console.log(
          "\n🎉 WEBSOCKET AUTHENTICATION PASSED!",
        );

        console.log(
          "👤 Authenticated user:",
          message.user.email,
        );

        socket.close();
      }
    } catch (error) {
      console.error(
        "❌ Invalid JSON response:",
        error,
      );

      socket.close();
      process.exit(1);
    }
  });

  socket.on("close", (code, reason) => {
    console.log("\n🔌 WebSocket connection closed.");
    console.log("Close code:", code);

    if (reason.length > 0) {
      console.log(
        "Close reason:",
        reason.toString(),
      );
    }
  });

  socket.on("error", (error: Error) => {
    console.error("❌ WebSocket error:", error);
    process.exit(1);
  });
};

main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});