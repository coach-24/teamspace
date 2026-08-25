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

const getTeamSpaceUserId = async (
  token: string,
) => {
  const response = await fetch(
    `${API_URL}/api/workspaces`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Workspace request failed: ${JSON.stringify(data)}`,
    );
  }

  const workspace = data.data?.[0];

  if (!workspace) {
    throw new Error("No workspace found.");
  }

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

  if (!membersResponse.ok) {
    throw new Error(
      `Members request failed: ${JSON.stringify(
        membersData,
      )}`,
    );
  }

  const member =
    membersData.data?.find(
      (item: {
        user_id?: string;
        email?: string;
      }) =>
        item.email === "alice@teamspace.dev",
    );

  if (!member?.user_id) {
    throw new Error(
      "Could not resolve Alice's TeamSpace user ID.",
    );
  }

  return member.user_id as string;
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

const main = async () => {
  console.log("🔐 Logging in Alice...");

  const aliceToken = await login(
    "alice@teamspace.dev",
  );

  console.log("✅ Alice logged in.");
  console.log("\n🔌 Connecting Alice to TeamSpace WebSocket...");

const aliceSocket = new WebSocket(
  `ws://127.0.0.1:4000/ws?token=${encodeURIComponent(
    aliceToken,
  )}`,
);

await new Promise<void>((resolve, reject) => {
  aliceSocket.once("open", () => {
    console.log("✅ Alice WebSocket connected.");
    resolve();
  });

  aliceSocket.once("error", reject);
});

 const aliceId =
  await getTeamSpaceUserId(aliceToken);

console.log(
  `👤 Alice: ${aliceId}`,
);

  console.log(
    "\n🟢 Checking Alice presence...",
  );

  const onlinePresence =
    await getPresence(
      aliceToken,
      aliceId,
    );

  console.log(
    JSON.stringify(
      onlinePresence.data,
      null,
      2,
    ),
  );

  if (
    onlinePresence.status !== 200 ||
    onlinePresence.data?.data?.status !==
      "online"
  ) {
    throw new Error(
      "Alice should be online while the server connection is active.",
    );
  }

  console.log(
    "✅ Alice correctly reported online.",
  );

  console.log(
    "\n🔐 Logging in Charlie...",
  );

  const charlieToken = await login(
    "charlie@teamspace.dev",
  );

  console.log(
    "✅ Charlie logged in.",
  );

  const charliePresence =
    await getPresence(
      charlieToken,
      aliceId,
    );

  if (
    charliePresence.status !== 200 ||
    charliePresence.data?.data?.status !==
      "online"
  ) {
    throw new Error(
      "Charlie should be able to see Alice's presence when they share a workspace.",
    );
  }

  console.log(
    "✅ Workspace presence authorization works.",
  );

  console.log(
    "\n🎉 PRESENCE API TEST PASSED!",
  );

  console.log(
    "✅ Online state works.",
  );

  console.log(
    "✅ Presence endpoint works.",
  );

  console.log(
    "✅ Workspace authorization works.",
  );

  console.log(
    "\n⚠️ Keep this process/server running for the next phase.",
  );
};

main().catch((error) => {
  console.error(
    "\n❌ PRESENCE TEST FAILED!",
    error,
  );

  process.exit(1);
});