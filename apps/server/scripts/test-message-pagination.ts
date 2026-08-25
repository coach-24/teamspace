import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const ALICE_PASSWORD = process.env.TEST_PASSWORD!;

const API_URL = "http://127.0.0.1:4000";

const channelId =
  "3b16e91f-7d77-4de5-8fba-2d26ac5b6151";

const login = async () => {
  const response = await fetch(
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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Alice login failed: ${JSON.stringify(data)}`,
    );
  }

  return data.access_token;
};

const getMessages = async (
  token: string,
  before?: string,
) => {
  const params = new URLSearchParams({
    limit: "2",
  });

  if (before) {
    params.set("before", before);
  }

  const response = await fetch(
    `${API_URL}/api/channels/${channelId}/messages?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `GET messages failed: ${JSON.stringify(data)}`,
    );
  }

  return data;
};

const main = async () => {
  console.log("🔐 Logging in as Alice...");

  const token = await login();

  console.log("✅ Alice logged in.\n");

  // ============================================
  // Page 1
  // ============================================

  console.log("📄 Fetching Page 1...");

  const page1 = await getMessages(token);

  console.log(
    JSON.stringify(page1, null, 2),
  );

  if (page1.data.length !== 2) {
    throw new Error(
      `Expected 2 messages on page 1, got ${page1.data.length}`,
    );
  }

  if (!page1.pagination.hasMore) {
    throw new Error(
      "Expected page 1 to have more messages",
    );
  }

  // The API returns newest → oldest.
  // Use the oldest message from this page as the cursor.
  const before = page1.data[page1.data.length - 1].created_at;

  console.log("\n✅ Page 1 passed.");
  console.log("🕐 Cursor:", before);

  // ============================================
  // Page 2
  // ============================================

  console.log("\n📄 Fetching Page 2...");

  const page2 = await getMessages(token, before);

  console.log(
    JSON.stringify(page2, null, 2),
  );

  if (page2.data.length !== 2) {
    throw new Error(
      `Expected 2 messages on page 2, got ${page2.data.length}`,
    );
  }

  // Ensure page 2 doesn't contain anything from page 1.
  const page1Ids = new Set(
    page1.data.map(
      (message: { id: string }) => message.id,
    ),
  );

  const overlap = page2.data.some(
    (message: { id: string }) =>
      page1Ids.has(message.id),
  );

  if (overlap) {
    throw new Error(
      "Pagination pages contain duplicate messages",
    );
  }

  console.log("\n✅ Page 2 passed.");

  // ============================================
  // Page 3
  // ============================================

  const beforePage3 =
    page2.data[page2.data.length - 1].created_at;

  console.log("\n📄 Fetching Page 3...");

  const page3 = await getMessages(
    token,
    beforePage3,
  );

  console.log(
    JSON.stringify(page3, null, 2),
  );

  if (page3.data.length < 1) {
    throw new Error(
      "Expected page 3 to contain remaining messages",
    );
  }

  const page2Ids = new Set(
    page2.data.map(
      (message: { id: string }) => message.id,
    ),
  );

  const overlapPage3 = page3.data.some(
    (message: { id: string }) =>
      page2Ids.has(message.id),
  );

  if (overlapPage3) {
    throw new Error(
      "Page 3 contains duplicate messages from page 2",
    );
  }

  console.log("\n🎉 PAGINATION TEST PASSED!");
  console.log("Page 1 → 2 messages ✅");
  console.log("Page 2 → 2 messages ✅");
  console.log("Page 3 → remaining messages ✅");
  console.log("No duplicate messages between pages ✅");
};

main().catch((error) => {
  console.error("\n❌ PAGINATION TEST FAILED");
  console.error(error);
  process.exit(1);
});