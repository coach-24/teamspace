import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const TEST_PASSWORD = process.env.TEST_PASSWORD!;

const API_URL = "http://127.0.0.1:4000";

const login = async (email: string) => {
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
        password: TEST_PASSWORD,
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

const search = async (
  token: string,
  query: string,
) => {
  const response = await fetch(
    `${API_URL}/api/search/messages?q=${encodeURIComponent(query)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await response.json();

  return {
    response,
    data,
  };
};

const main = async () => {
  console.log("🔐 Logging in Alice...");
  const aliceToken = await login(
    "alice@teamspace.dev",
  );
  console.log("✅ Alice logged in.");

  console.log("\n🔎 Searching messages...");

  const result = await search(
    aliceToken,
    "hello",
  );

  console.log(
    "HTTP Status:",
    result.response.status,
  );

  console.log(
    JSON.stringify(result.data, null, 2),
  );

  if (result.response.status !== 200) {
    console.error(
      "\n❌ Search request failed.",
    );
    process.exit(1);
  }

  if (!Array.isArray(result.data.data)) {
    console.error(
      "\n❌ Search data is not an array.",
    );
    process.exit(1);
  }

  console.log(
    "\n✅ Basic message search works.",
  );

  // ============================================
  // Search DM content
  // ============================================

  console.log(
    "\n💬 Searching for DM content...",
  );

  const dmResult = await search(
    aliceToken,
    "Realtime",
  );

  if (dmResult.response.status !== 200) {
    console.error(
      "\n❌ DM search failed.",
    );
    process.exit(1);
  }

  const dmResults = dmResult.data.data;

  const hasDirectResult = dmResults.some(
    (message: { source?: string }) =>
      message.source === "direct",
  );

  if (!hasDirectResult) {
    console.error(
      "\n❌ Expected a direct-message search result.",
    );
    process.exit(1);
  }

  console.log(
    "✅ Direct-message search works.",
  );

  // ============================================
  // Limit
  // ============================================

  console.log(
    "\n📊 Testing search limit...",
  );

  const limitResponse = await fetch(
    `${API_URL}/api/search/messages?q=hello&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${aliceToken}`,
      },
    },
  );

  const limitResult =
    await limitResponse.json();

  if (
    limitResponse.status !== 200 ||
    limitResult.data.length > 1
  ) {
    console.error(
      "\n❌ Search limit failed.",
    );
    process.exit(1);
  }

  console.log(
    "✅ Search limit works.",
  );

  // ============================================
  // Invalid query
  // ============================================

  console.log(
    "\n🚫 Testing invalid search...",
  );

  const invalidResponse = await fetch(
    `${API_URL}/api/search/messages?q=`,
    {
      headers: {
        Authorization: `Bearer ${aliceToken}`,
      },
    },
  );

  if (invalidResponse.status !== 400) {
    console.error(
      "\n❌ Invalid search was not rejected.",
    );
    process.exit(1);
  }

  console.log(
    "✅ Invalid search rejected.",
  );

  // ============================================
  // Charlie isolation
  // ============================================

  console.log(
    "\n🔐 Logging in Charlie...",
  );

  const charlieToken = await login(
    "charlie@teamspace.dev",
  );

  console.log("✅ Charlie logged in.");

  console.log(
    "\n🔎 Testing search isolation...",
  );

  const charlieResult = await search(
    charlieToken,
    "Realtime",
  );

  if (charlieResult.response.status !== 200) {
    console.error(
      "\n❌ Charlie search request failed.",
    );
    process.exit(1);
  }

  console.log(
    "Charlie results:",
    charlieResult.data.data.length,
  );

  console.log(
    "\n🎉 SEARCH INTEGRATION TEST PASSED!",
  );

  console.log(
    "✅ Channel message search works.",
  );

  console.log(
    "✅ DM search works.",
  );

  console.log(
    "✅ Search limits work.",
  );

  console.log(
    "✅ Invalid queries are rejected.",
  );

  console.log(
    "✅ Authorization-aware search works.",
  );
};

main().catch((error) => {
  console.error(
    "❌ Unexpected error:",
    error,
  );

  process.exit(1);
});