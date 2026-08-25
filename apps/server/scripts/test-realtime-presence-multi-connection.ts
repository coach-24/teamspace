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
  let aliceOnlineCount = 0;
  let aliceOfflineCount = 0;

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
    }

    if (
      message.type === "presence.online" &&
      message.user?.email ===
        "alice@teamspace.dev"
    ) {
      aliceOnlineCount++;

      console.log(
        `🟢 Alice ONLINE event #${aliceOnlineCount}`,
      );
    }

    if (
      message.type === "presence.offline" &&
      message.user?.email ===
        "alice@teamspace.dev"
    ) {
      aliceOfflineCount++;

      console.log(
        `🔴 Alice OFFLINE event #${aliceOfflineCount}`,
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

  // Wait for Bob authentication

  while (!bobAuthenticated) {
    await wait(50);
  }

  console.log(
    "\n✅ Bob authentication confirmed.",
  );

  // ============================================
  // Alice connection #1
  // ============================================

  console.log(
    "\n🔌 Connecting Alice - Tab 1...",
  );

  const aliceSocket1 = new WebSocket(
    `${WS_URL}?token=${encodeURIComponent(aliceToken)}`,
  );

  let alice1Authenticated = false;

  aliceSocket1.on("open", () => {
    console.log(
      "✅ Alice Tab 1 connected.",
    );
  });

  aliceSocket1.on("message", (data) => {
    const message = JSON.parse(
      data.toString(),
    );

    if (
      message.type ===
      "connection.authenticated"
    ) {
      alice1Authenticated = true;
    }
  });

  aliceSocket1.on(
    "error",
    (error: Error) => {
      console.error(
        "❌ Alice Tab 1 error:",
        error,
      );

      process.exit(1);
    },
  );

  while (!alice1Authenticated) {
    await wait(50);
  }

  await wait(500);

  // ============================================
  // Verify first ONLINE event
  // ============================================

  if (aliceOnlineCount !== 1) {
    console.error(
      `\n❌ Expected 1 ONLINE event, got ${aliceOnlineCount}.`,
    );

    aliceSocket1.close();
    bobSocket.close();
    process.exit(1);
  }

  console.log(
    "\n✅ First connection generated exactly one ONLINE event.",
  );

  // ============================================
  // Alice connection #2
  // ============================================

  console.log(
    "\n🔌 Connecting Alice - Tab 2...",
  );

  const aliceSocket2 = new WebSocket(
    `${WS_URL}?token=${encodeURIComponent(aliceToken)}`,
  );

  let alice2Authenticated = false;

  aliceSocket2.on("open", () => {
    console.log(
      "✅ Alice Tab 2 connected.",
    );
  });

  aliceSocket2.on("message", (data) => {
    const message = JSON.parse(
      data.toString(),
    );

    if (
      message.type ===
      "connection.authenticated"
    ) {
      alice2Authenticated = true;
    }
  });

  aliceSocket2.on(
    "error",
    (error: Error) => {
      console.error(
        "❌ Alice Tab 2 error:",
        error,
      );

      process.exit(1);
    },
  );

  while (!alice2Authenticated) {
    await wait(50);
  }

  await wait(500);

  // ============================================
  // Verify NO duplicate ONLINE event
  // ============================================

  if (aliceOnlineCount !== 1) {
    console.error(
      `\n❌ Duplicate ONLINE event detected. Count: ${aliceOnlineCount}`,
    );

    aliceSocket1.close();
    aliceSocket2.close();
    bobSocket.close();
    process.exit(1);
  }

  console.log(
    "\n✅ Second connection generated NO duplicate ONLINE event.",
  );

  // ============================================
  // Close Tab 1
  // ============================================

  console.log(
    "\n🔌 Closing Alice Tab 1...",
  );

  aliceSocket1.close();

  await wait(500);

  // ============================================
  // Verify NO OFFLINE yet
  // ============================================

  if (aliceOfflineCount !== 0) {
    console.error(
      `\n❌ Alice went OFFLINE too early. Count: ${aliceOfflineCount}`,
    );

    aliceSocket2.close();
    bobSocket.close();
    process.exit(1);
  }

  console.log(
    "\n✅ Alice remains ONLINE after Tab 1 closes.",
  );

  // ============================================
  // Close Tab 2
  // ============================================

  console.log(
    "\n🔌 Closing Alice Tab 2...",
  );

  aliceSocket2.close();

  await wait(500);

  // ============================================
  // Verify final OFFLINE event
  // ============================================

  if (aliceOfflineCount !== 1) {
    console.error(
      `\n❌ Expected exactly 1 OFFLINE event, got ${aliceOfflineCount}.`,
    );

    bobSocket.close();
    process.exit(1);
  }

  console.log(
    "\n🔴 Alice went OFFLINE after her final connection closed.",
  );

  console.log(
    "\n🎉 REALTIME MULTI-CONNECTION PRESENCE TEST PASSED!",
  );

  console.log(
    "✅ First connection → ONLINE",
  );

  console.log(
    "✅ Second connection → no duplicate ONLINE",
  );

  console.log(
    "✅ First disconnect → still ONLINE",
  );

  console.log(
    "✅ Final disconnect → OFFLINE",
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