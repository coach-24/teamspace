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
    `${WS_URL}?token=${encodeURIComponent(
      bobToken,
    )}`,
  );

  let authenticated = false;
  let notificationReceived = false;
  let notificationData: any = null;

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
      authenticated = true;

      console.log(
        "🔐 Bob authenticated.",
      );

      return;
    }

    if (
      message.type ===
      "notification.created"
    ) {
      notificationReceived = true;
      notificationData = message.data;

      console.log(
        "\n🔔 Bob received notification.created!",
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

  while (!authenticated) {
    await wait(50);
  }

  // ============================================
  // Alice creates mention
  // ============================================

  console.log(
    "\n📝 Alice is mentioning Bob...",
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
        content: `Hey @Bob realtime mention test ${Date.now()} 🔔`,
      }),
    },
  );

  const createResult =
    await createResponse.json();

  console.log(
    "\n📡 Message Response",
  );
  console.log(
    "======================",
  );

  console.log(
    "HTTP Status:",
    createResponse.status,
  );

  console.log(
    "Response:",
    JSON.stringify(
      createResult,
      null,
      2,
    ),
  );

  if (createResponse.status !== 201) {
    console.error(
      "\n❌ Message creation failed.",
    );

    bobSocket.close();
    process.exit(1);
  }

  console.log(
    "\n✅ Alice created the message.",
  );

  // ============================================
  // Wait for notification
  // ============================================

  await wait(1000);

  if (!notificationReceived) {
    console.error(
      "\n❌ MENTION NOTIFICATION TEST FAILED!",
    );

    console.error(
      "Bob never received notification.created.",
    );

    bobSocket.close();
    process.exit(1);
  }

  // ============================================
  // Validate notification
  // ============================================

  if (
    notificationData?.type !==
    "mention"
  ) {
    console.error(
      "\n❌ Incorrect notification type.",
    );

    bobSocket.close();
    process.exit(1);
  }

  if (
    notificationData?.user_id ===
    undefined
  ) {
    console.error(
      "\n❌ Notification has no user_id.",
    );

    bobSocket.close();
    process.exit(1);
  }

  console.log(
    "\n🎉 MENTION NOTIFICATION TEST PASSED!",
  );

  console.log(
    "✅ Alice mentioned Bob.",
  );

  console.log(
    "✅ Notification was created.",
  );

  console.log(
    "✅ Bob received notification.created over WebSocket.",
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