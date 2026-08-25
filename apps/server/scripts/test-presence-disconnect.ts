import "dotenv/config";
import WebSocket from "ws";

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
      `Login failed: ${JSON.stringify(data)}`,
    );
  }

  return data.access_token as string;
};

const getAliceId = async (token: string) => {
  const response = await fetch(
    `${API_URL}/api/workspaces`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await response.json();

  if (!response.ok || !data.data?.[0]) {
    throw new Error(
      `Workspace lookup failed: ${JSON.stringify(data)}`,
    );
  }

  const workspace = data.data[0];

  const membersResponse = await fetch(
    `${API_URL}/api/workspaces/${workspace.id}/members`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const membersData =
    await membersResponse.json();

  const alice = membersData.data?.find(
    (member: { email?: string }) =>
      member.email === "alice@teamspace.dev",
  );

  if (!alice?.user_id) {
    throw new Error(
      "Could not resolve Alice's TeamSpace user ID.",
    );
  }

  return alice.user_id as string;
};

const getPresence = async (
  token: string,
  userId: string,
) => {
  const response = await fetch(
    `${API_URL}/api/users/${userId}/presence`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await response.json();

  return {
    status: response.status,
    data,
  };
};

const waitFor = async (
  condition: () => Promise<boolean>,
  timeoutMs = 5000,
) => {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await condition()) {
      return;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 200),
    );
  }

  throw new Error(
    "Timed out waiting for presence state.",
  );
};

const main = async () => {
  console.log("🔐 Logging in Alice...");

  const aliceToken = await login(
    "alice@teamspace.dev",
  );

  console.log("✅ Alice logged in.");

  const aliceId =
    await getAliceId(aliceToken);

  console.log(
    `👤 Alice: ${aliceId}`,
  );

  console.log(
    "\n🔌 Opening Alice WebSocket...",
  );

  const socket = new WebSocket(
    `ws://127.0.0.1:4000/ws?token=${encodeURIComponent(
      aliceToken,
    )}`,
  );

  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => {
      console.log(
        "✅ Alice WebSocket connected.",
      );
      resolve();
    });

    socket.once("error", reject);
  });

  console.log(
    "\n🟢 Waiting for Alice to become online...",
  );

  await waitFor(async () => {
    const presence =
      await getPresence(
        aliceToken,
        aliceId,
      );

    return (
      presence.data?.data?.status ===
      "online"
    );
  });

  console.log(
    "✅ Alice is online.",
  );

  console.log(
    "\n🔌 Closing Alice's final WebSocket connection...",
  );

  socket.close();

  await waitFor(async () => {
    const presence =
      await getPresence(
        aliceToken,
        aliceId,
      );

    return (
      presence.data?.data?.status ===
        "offline" &&
      presence.data?.data?.last_seen_at !=
        null
    );
  });

  const finalPresence =
    await getPresence(
      aliceToken,
      aliceId,
    );

  console.log(
    JSON.stringify(
      finalPresence.data,
      null,
      2,
    ),
  );

  if (
    finalPresence.data?.data?.status !==
    "offline"
  ) {
    throw new Error(
      "Alice should be offline after the final WebSocket disconnect.",
    );
  }

  if (
    !finalPresence.data?.data?.last_seen_at
  ) {
    throw new Error(
      "last_seen_at was not recorded.",
    );
  }

  console.log(
    "✅ Alice correctly reported offline.",
  );

  console.log(
    "✅ last_seen_at was persisted.",
  );

  console.log(
    "\n🎉 PRESENCE DISCONNECT TEST PASSED!",
  );
};

main().catch((error) => {
  console.error(
    "\n❌ PRESENCE DISCONNECT TEST FAILED!",
    error,
  );

  process.exit(1);
});