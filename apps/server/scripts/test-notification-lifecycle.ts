import "dotenv/config";
import WebSocket from "ws";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

const ALICE_PASSWORD = process.env.TEST_PASSWORD!;

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

  // ============================================
  // Connect Bob
  // ============================================

  console.log("\n🔌 Connecting Bob...");

  const bobToken = await login(
    "bob@teamspace.dev",
    process.env.TEST_PASSWORD!,
  );

  const bobSocket = new WebSocket(
    `${WS_URL}?token=${encodeURIComponent(
      bobToken,
    )}`,
  );

  let authenticated = false;
  let notificationId: string | null = null;

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
      authenticated = true;
    }

    if (
      message.type ===
      "notification.created"
    ) {
      notificationId = message.data.id;

      console.log(
        "\n🔔 Notification received:",
        notificationId,
      );
    }
  });

  bobSocket.on("error", (error) => {
    console.error(
      "❌ Bob WebSocket error:",
      error,
    );

    process.exit(1);
  });

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
        content: `Notification lifecycle test @Bob ${Date.now()} 🔔`,
      }),
    },
  );

  const createResult =
    await createResponse.json();

  if (createResponse.status !== 201) {
    console.error(
      "❌ Message creation failed:",
      createResult,
    );

    bobSocket.close();
    process.exit(1);
  }

  console.log(
    "✅ Mention message created.",
  );

  // ============================================
  // Wait for notification
  // ============================================

  for (let i = 0; i < 20 && !notificationId; i++) {
    await wait(100);
  }

  if (!notificationId) {
    console.error(
      "\n❌ Notification was not received.",
    );

    bobSocket.close();
    process.exit(1);
  }

  // ============================================
  // GET notifications
  // ============================================

  console.log(
    "\n📥 Fetching Bob's notifications...",
  );

  const listResponse = await fetch(
    `${API_URL}/api/notifications`,
    {
      headers: {
        Authorization: `Bearer ${bobToken}`,
      },
    },
  );

  const listResult =
    await listResponse.json();

  console.log(
    "HTTP Status:",
    listResponse.status,
  );

  if (listResponse.status !== 200) {
    console.error(
      "❌ Notification listing failed:",
      listResult,
    );

    bobSocket.close();
    process.exit(1);
  }

  const notification =
    listResult.data.find(
      (item: { id: string }) =>
        item.id === notificationId,
    );

  if (!notification) {
    console.error(
      "❌ Created notification not found in GET response.",
    );

    bobSocket.close();
    process.exit(1);
  }

  console.log(
    "✅ Notification found in GET /api/notifications.",
  );

  if (notification.is_read !== false) {
    console.error(
      "❌ Notification should initially be unread.",
    );

    bobSocket.close();
    process.exit(1);
  }

  // ============================================
  // Mark notification as read
  // ============================================

  console.log(
    "\n👀 Marking notification as read...",
  );

  const readResponse = await fetch(
    `${API_URL}/api/notifications/${notificationId}/read`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${bobToken}`,
      },
    },
  );

  const readResult =
    await readResponse.json();

  console.log(
    "HTTP Status:",
    readResponse.status,
  );

  if (readResponse.status !== 200) {
    console.error(
      "❌ Mark-as-read failed:",
      readResult,
    );

    bobSocket.close();
    process.exit(1);
  }

  if (
    readResult.data?.is_read !== true
  ) {
    console.error(
      "❌ Notification was not marked as read.",
    );

    bobSocket.close();
    process.exit(1);
  }

  console.log(
    "✅ Notification marked as read.",
  );

  // ============================================
  // Verify persisted state
  // ============================================

  const verifyResponse = await fetch(
    `${API_URL}/api/notifications`,
    {
      headers: {
        Authorization: `Bearer ${bobToken}`,
      },
    },
  );

  const verifyResult =
    await verifyResponse.json();

  const verifiedNotification =
    verifyResult.data.find(
      (item: { id: string }) =>
        item.id === notificationId,
    );

  if (
    verifiedNotification?.is_read !== true
  ) {
    console.error(
      "❌ Read state was not persisted.",
    );

    bobSocket.close();
    process.exit(1);
  }

  console.log(
    "✅ Read state persisted successfully.",
  );

  console.log(
    "\n🎉 NOTIFICATION LIFECYCLE TEST PASSED!",
  );

  console.log(
    "✅ Mention created",
  );
  console.log(
    "✅ Realtime notification delivered",
  );
  console.log(
    "✅ Notification retrieved through REST",
  );
  console.log(
    "✅ Notification marked as read",
  );
  console.log(
    "✅ Read state persisted",
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