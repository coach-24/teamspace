import "dotenv/config";
import WebSocket from "ws";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

const ALICE_PASSWORD = process.env.TEST_PASSWORD!;
const BOB_PASSWORD = process.env.TEST_PASSWORD!;

const WS_URL = "ws://127.0.0.1:4000/ws";

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
  // Connect Bob first
  // ============================================

  console.log("\n🔌 Connecting Bob...");

  const bobSocket = new WebSocket(
    `${WS_URL}?token=${encodeURIComponent(bobToken)}`,
  );

  let bobAuthenticated = false;
  let bobOnlineReceived = false;
  let bobOfflineReceived = false;

  bobSocket.on("open", () => {
    console.log("✅ Bob WebSocket connected.");
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

      console.log(
        "🔐 Bob authenticated.",
      );
    }

    if (
      message.type === "presence.online" &&
      message.user?.email ===
        "alice@teamspace.dev"
    ) {
      bobOnlineReceived = true;

      console.log(
        "\n🟢 Bob detected Alice ONLINE!",
      );
    }

    if (
      message.type === "presence.offline" &&
      message.user?.email ===
        "alice@teamspace.dev"
    ) {
      bobOfflineReceived = true;

      console.log(
        "\n🔴 Bob detected Alice OFFLINE!",
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
  // Wait for Bob authentication
  // ============================================

  await new Promise<void>((resolve) => {
    const check = setInterval(() => {
      if (bobAuthenticated) {
        clearInterval(check);
        resolve();
      }
    }, 50);
  });

  // ============================================
  // Connect Alice
  // ============================================

  console.log(
    "\n🔌 Connecting Alice...",
  );

  const aliceSocket = new WebSocket(
    `${WS_URL}?token=${encodeURIComponent(aliceToken)}`,
  );

  let aliceAuthenticated = false;

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

      console.log(
        "🔐 Alice authenticated.",
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
  // Wait for Alice authentication
  // ============================================

  await new Promise<void>((resolve) => {
    const check = setInterval(() => {
      if (aliceAuthenticated) {
        clearInterval(check);
        resolve();
      }
    }, 50);
  });

  // ============================================
  // Verify online event
  // ============================================

  await new Promise<void>((resolve) => {
    const check = setInterval(() => {
      if (bobOnlineReceived) {
        clearInterval(check);
        resolve();
      }
    }, 50);

    setTimeout(() => {
      clearInterval(check);
      resolve();
    }, 3000);
  });

  if (!bobOnlineReceived) {
    console.error(
      "\n❌ PRESENCE ONLINE TEST FAILED!",
    );

    aliceSocket.close();
    bobSocket.close();
    process.exit(1);
  }

  console.log(
    "\n🎉 PRESENCE ONLINE TEST PASSED!",
  );

  // ============================================
  // Disconnect Alice
  // ============================================

  console.log(
    "\n🔌 Disconnecting Alice...",
  );

  aliceSocket.close();

  // ============================================
  // Verify offline event
  // ============================================

  await new Promise<void>((resolve) => {
    const check = setInterval(() => {
      if (bobOfflineReceived) {
        clearInterval(check);
        resolve();
      }
    }, 50);

    setTimeout(() => {
      clearInterval(check);
      resolve();
    }, 3000);
  });

  if (!bobOfflineReceived) {
    console.error(
      "\n❌ PRESENCE OFFLINE TEST FAILED!",
    );

    bobSocket.close();
    process.exit(1);
  }

  console.log(
    "\n🎉 PRESENCE OFFLINE TEST PASSED!",
  );

  console.log(
    "\n🎉 REALTIME PRESENCE TEST PASSED!",
  );

  bobSocket.close();
};

main().catch((error) => {
  console.error(
    "❌ Unexpected error:",
    error,
  );

  process.exit(1);
});