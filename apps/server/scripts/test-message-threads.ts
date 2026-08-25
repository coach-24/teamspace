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

const getWorkspace = async (token: string) => {
  const response = await fetch(
    `${API_URL}/api/workspaces`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await response.json();

  if (response.status !== 200) {
    throw new Error(
      `Workspace lookup failed: ${JSON.stringify(data)}`,
    );
  }

  const workspace = data.data?.find(
    (item: { slug?: string }) =>
      item.slug === "teamspace-dev",
  );

  if (!workspace) {
    throw new Error(
      "TeamSpace Development workspace not found.",
    );
  }

  return workspace;
};

const getChannels = async (
  token: string,
  workspaceId: string,
) => {
  const response = await fetch(
    `${API_URL}/api/workspaces/${workspaceId}/channels`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await response.json();

  if (response.status !== 200) {
    throw new Error(
      `Channel lookup failed: ${JSON.stringify(data)}`,
    );
  }

  return data.data ?? [];
};

const createMessage = async (
  token: string,
  channelId: string,
  content: string,
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
        content,
      }),
    },
  );

  const data = await response.json();

  if (response.status !== 201) {
    throw new Error(
      `Message creation failed: ${JSON.stringify(data)}`,
    );
  }

  return data.data;
};

const main = async () => {
  // ============================================
  // Login Alice
  // ============================================

  console.log("🔐 Logging in Alice...");

  const aliceToken = await login(
    "alice@teamspace.dev",
  );

  console.log("✅ Alice logged in.");

  // ============================================
  // Find TeamSpace Development workspace
  // ============================================

  const workspace = await getWorkspace(
    aliceToken,
  );

  // ============================================
  // Find accessible channel
  // ============================================

  const channels = await getChannels(
    aliceToken,
    workspace.id,
  );

  if (channels.length === 0) {
    throw new Error(
      "No accessible channels found.",
    );
  }

  const channel =
  channels.find(
    (item: { is_private?: boolean }) =>
      item.is_private === true,
  ) ?? channels[0];

  console.log(
    "📢 Using accessible channel:",
    channel.name,
    channel.is_private
      ? "(private)"
      : "(public)",
  );

  // ============================================
  // Create thread root
  // ============================================

  console.log(
    "\n📝 Creating thread root...",
  );

  const rootMessage = await createMessage(
    aliceToken,
    channel.id,
    `Thread root ${Date.now()}`,
  );

  console.log(
    "✅ Root message:",
    rootMessage.id,
  );

  // ============================================
  // Create first reply
  // ============================================

  console.log(
    "\n💬 Creating first reply...",
  );

  const replyResponse = await fetch(
    `${API_URL}/api/messages/${rootMessage.id}/replies`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aliceToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: `First reply ${Date.now()}`,
      }),
    },
  );

  const replyResult =
    await replyResponse.json();

  if (replyResponse.status !== 201) {
    throw new Error(
      `Reply creation failed: ${JSON.stringify(
        replyResult,
      )}`,
    );
  }

  const firstReply = replyResult.data;

  if (
    firstReply.parent_message_id !==
    rootMessage.id
  ) {
    throw new Error(
      "Reply does not point to root message.",
    );
  }

  console.log(
    "✅ First reply created.",
  );

  // ============================================
  // Create second reply
  // ============================================

  console.log(
    "\n💬 Creating second reply...",
  );

  const secondReplyResponse =
    await fetch(
      `${API_URL}/api/messages/${rootMessage.id}/replies`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aliceToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: `Second reply ${Date.now()}`,
        }),
      },
    );

  const secondReplyResult =
    await secondReplyResponse.json();

  if (secondReplyResponse.status !== 201) {
    throw new Error(
      `Second reply creation failed: ${JSON.stringify(
        secondReplyResult,
      )}`,
    );
  }

  console.log(
    "✅ Second reply created.",
  );

  // ============================================
  // Nested reply → root
  // ============================================

  console.log(
    "\n🧵 Testing nested reply prevention...",
  );

  const nestedResponse = await fetch(
    `${API_URL}/api/messages/${firstReply.id}/replies`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aliceToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: `Reply to reply ${Date.now()}`,
      }),
    },
  );

  const nestedResult =
    await nestedResponse.json();

  if (nestedResponse.status !== 201) {
    throw new Error(
      `Nested reply request failed: ${JSON.stringify(
        nestedResult,
      )}`,
    );
  }

  if (
    nestedResult.data.parent_message_id !==
    rootMessage.id
  ) {
    throw new Error(
      "Nested reply was not redirected to root.",
    );
  }

  console.log(
    "✅ Nested reply correctly attached to root.",
  );

  // ============================================
  // Fetch replies
  // ============================================

  console.log(
    "\n📥 Fetching thread replies...",
  );

  const repliesResponse = await fetch(
    `${API_URL}/api/messages/${rootMessage.id}/replies`,
    {
      headers: {
        Authorization: `Bearer ${aliceToken}`,
      },
    },
  );

  const repliesResult =
    await repliesResponse.json();

  if (repliesResponse.status !== 200) {
    throw new Error(
      `Reply retrieval failed: ${JSON.stringify(
        repliesResult,
      )}`,
    );
  }

  const replies = repliesResult.data;

  if (!Array.isArray(replies)) {
    throw new Error(
      "Thread replies are not an array.",
    );
  }

  if (replies.length < 3) {
    throw new Error(
      `Expected at least 3 replies, found ${replies.length}.`,
    );
  }

  if (
    !replies.every(
      (item: { parent_message_id: string }) =>
        item.parent_message_id ===
        rootMessage.id,
    )
  ) {
    throw new Error(
      "Thread contains a nested reply.",
    );
  }

  console.log(
    `✅ Retrieved ${replies.length} thread replies.`,
  );

  // ============================================
  // Pagination
  // ============================================

  console.log(
    "\n📄 Testing thread pagination...",
  );

  const paginationResponse =
    await fetch(
      `${API_URL}/api/messages/${rootMessage.id}/replies?limit=1`,
      {
        headers: {
          Authorization: `Bearer ${aliceToken}`,
        },
      },
    );

  const paginationResult =
    await paginationResponse.json();

  if (
    paginationResponse.status !== 200 ||
    paginationResult.data.length > 1
  ) {
    throw new Error(
      "Thread pagination limit failed.",
    );
  }

  console.log(
    "✅ Thread pagination works.",
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
    "\n🚫 Charlie attempts to read the thread...",
  );

  const forbiddenResponse =
    await fetch(
      `${API_URL}/api/messages/${rootMessage.id}/replies`,
      {
        headers: {
          Authorization: `Bearer ${charlieToken}`,
        },
      },
    );

  const forbiddenResult =
    await forbiddenResponse.json();

  if (forbiddenResponse.status !== 403) {
    console.error(
      "Unexpected response:",
      forbiddenResult,
    );

    throw new Error(
      "Thread authorization isolation failed.",
    );
  }

  console.log(
    "✅ Charlie was correctly denied.",
  );

  // ============================================
  // Final
  // ============================================

  console.log(
    "\n🎉 MESSAGE THREAD INTEGRATION TEST PASSED!",
  );

  console.log("✅ Thread roots work.");
  console.log("✅ Replies work.");
  console.log(
    "✅ Replies always attach to root.",
  );
  console.log(
    "✅ Thread retrieval works.",
  );
  console.log(
    "✅ Thread pagination works.",
  );
  console.log(
    "✅ Thread authorization works.",
  );
};

main().catch((error) => {
  console.error(
    "\n❌ THREAD TEST FAILED!",
    error,
  );

  process.exit(1);
});