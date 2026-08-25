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
    throw new Error(`Login failed: ${JSON.stringify(data)}`);
  }

  return data.access_token as string;
};

const searchUsers = async (
  token: string,
  query: string,
) => {
  const response = await fetch(
    `${API_URL}/api/search/users?q=${encodeURIComponent(query)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `User search failed: ${JSON.stringify(data)}`,
    );
  }

  return data;
};

const main = async () => {
  console.log("🔐 Logging in Alice...");

  const aliceToken = await login(
    "alice@teamspace.dev",
  );

  console.log("✅ Alice logged in.");

  console.log("\n🔎 Searching for Charlie...");

  const charlieResults = await searchUsers(
    aliceToken,
    "Charlie",
  );

  console.log(
    JSON.stringify(charlieResults, null, 2),
  );

  const charlie =
    charlieResults.data?.find(
      (user: { email?: string }) =>
        user.email === "charlie@teamspace.dev",
    );

  if (!charlie) {
    throw new Error(
      "Charlie was not returned by user search.",
    );
  }

  console.log("✅ Charlie found.");

  console.log("\n🚫 Checking self-exclusion...");

  const aliceResults = await searchUsers(
    aliceToken,
    "Alice",
  );

  const aliceReturned =
    aliceResults.data?.some(
      (user: { email?: string }) =>
        user.email === "alice@teamspace.dev",
    );

  if (aliceReturned) {
    throw new Error(
      "User search incorrectly returned Alice herself.",
    );
  }

  console.log("✅ Alice correctly excluded.");

  console.log("\n📧 Testing email search...");

  const emailResults = await searchUsers(
    aliceToken,
    "charlie@teamspace.dev",
  );

  const emailMatch =
    emailResults.data?.some(
      (user: { email?: string }) =>
        user.email === "charlie@teamspace.dev",
    );

  if (!emailMatch) {
    throw new Error(
      "Email search did not find Charlie.",
    );
  }

  console.log("✅ Email search works.");

  console.log("\n💬 Verifying returned user ID...");

  if (!charlie.id) {
    throw new Error(
      "Search result does not contain a TeamSpace user ID.",
    );
  }

  console.log(
    `✅ Charlie TeamSpace ID: ${charlie.id}`,
  );

  console.log(
    "\n🎉 USER SEARCH TEST PASSED!",
  );

  console.log(
    "✅ Name search works.",
  );

  console.log(
    "✅ Email search works.",
  );

  console.log(
    "✅ Self-exclusion works.",
  );

  console.log(
    "✅ TeamSpace user IDs are returned.",
  );
};

main().catch((error) => {
  console.error(
    "\n❌ USER SEARCH TEST FAILED!",
    error,
  );

  process.exit(1);
});