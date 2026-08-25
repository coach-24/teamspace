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

const getChannel = async (token: string) => {
  const workspacesResponse = await fetch(
    `${API_URL}/api/workspaces`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const workspaces = await workspacesResponse.json();

  for (const workspace of workspaces.data ?? []) {
    const response = await fetch(
      `${API_URL}/api/workspaces/${workspace.id}/channels`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const data = await response.json();

    const channel = data.data?.find(
      (item: { is_private?: boolean }) =>
        item.is_private === false,
    );

    if (channel) {
      return channel;
    }
  }

  throw new Error("No accessible public channel found.");
};

const createMessage = async (
  token: string,
  channelId: string,
) => {
  const response = await fetch(
    `${API_URL}/api/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: `Reaction test ${Date.now()}`,
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Message creation failed: ${JSON.stringify(data)}`,
    );
  }

  return data.data;
};

const addReaction = async (
  token: string,
  messageId: string,
  emoji: string,
) => {
  const response = await fetch(
    `${API_URL}/api/messages/${messageId}/reactions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ emoji }),
    },
  );

  return {
    status: response.status,
    data: await response.json(),
  };
};

const removeReaction = async (
  token: string,
  messageId: string,
  emoji: string,
) => {
  const response = await fetch(
    `${API_URL}/api/messages/${messageId}/reactions/${encodeURIComponent(
      emoji,
    )}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return {
    status: response.status,
    data: await response.json(),
  };
};

const main = async () => {
  console.log("🔐 Logging in Alice...");

  const aliceToken = await login(
    "alice@teamspace.dev",
  );

  console.log("✅ Alice logged in.");

  const channel = await getChannel(aliceToken);

  console.log(
    `📢 Using public channel: ${channel.name}`,
  );

  console.log("\n📝 Creating message...");

  const message = await createMessage(
    aliceToken,
    channel.id,
  );

  console.log(
    `✅ Message: ${message.id}`,
  );

  console.log("\n❤️ Adding first reaction...");

  const first = await addReaction(
    aliceToken,
    message.id,
    "❤️",
  );

  console.log(
    JSON.stringify(first.data, null, 2),
  );

  if (first.status !== 201) {
    throw new Error(
      `Expected 201, got ${first.status}`,
    );
  }

  console.log("✅ Reaction added.");

  console.log("\n🚫 Testing duplicate reaction...");

  const duplicate = await addReaction(
    aliceToken,
    message.id,
    "❤️",
  );

  if (
    duplicate.status !== 409 ||
    duplicate.data?.error?.code !==
      "REACTION_ALREADY_EXISTS"
  ) {
    throw new Error(
      `Duplicate reaction was not rejected: ${JSON.stringify(
        duplicate,
      )}`,
    );
  }

  console.log(
    "✅ Duplicate reaction correctly rejected.",
  );

  console.log("\n👍 Adding second emoji...");

  const second = await addReaction(
    aliceToken,
    message.id,
    "👍",
  );

  if (second.status !== 201) {
    throw new Error(
      `Expected second reaction to succeed: ${JSON.stringify(
        second,
      )}`,
    );
  }

  console.log("✅ Multiple emoji reactions work.");

  console.log("\n➖ Removing ❤️...");

  const removed = await removeReaction(
    aliceToken,
    message.id,
    "❤️",
  );

  if (removed.status !== 200) {
    throw new Error(
      `Reaction removal failed: ${JSON.stringify(
        removed,
      )}`,
    );
  }

  console.log("✅ Reaction removed.");

  console.log(
    "\n🚫 Testing removal of nonexistent reaction...",
  );

  const missing = await removeReaction(
    aliceToken,
    message.id,
    "😂",
  );

  if (
    missing.status !== 404 ||
    missing.data?.error?.code !==
      "REACTION_NOT_FOUND"
  ) {
    throw new Error(
      `Missing reaction was not rejected: ${JSON.stringify(
        missing,
      )}`,
    );
  }

  console.log(
    "✅ Missing reaction correctly rejected.",
  );

  console.log("\n🎉 MESSAGE REACTION TEST PASSED!");

  console.log("✅ Add reaction works.");
  console.log("✅ Duplicate protection works.");
  console.log("✅ Multiple emojis work.");
  console.log("✅ Remove reaction works.");
  console.log("✅ Missing reaction handling works.");
};

main().catch((error) => {
  console.error(
    "\n❌ MESSAGE REACTION TEST FAILED!",
    error,
  );

  process.exit(1);
});