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

const getChannels = async (token: string) => {
  const workspacesResponse = await fetch(
    `${API_URL}/api/workspaces`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const workspaces = await workspacesResponse.json();

  if (!workspaces.data?.length) {
    throw new Error("No accessible workspace.");
  }

  const channels = [];

  for (const workspace of workspaces.data) {
    const response = await fetch(
      `${API_URL}/api/workspaces/${workspace.id}/channels`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const data = await response.json();

    channels.push(...(data.data ?? []));
  }

  return channels;
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
        content: `Pin test ${Date.now()}`,
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

const pinMessage = async (
  token: string,
  messageId: string,
) => {
  const response = await fetch(
    `${API_URL}/api/messages/${messageId}/pin`,
    {
      method: "POST",
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

const unpinMessage = async (
  token: string,
  messageId: string,
) => {
  const response = await fetch(
    `${API_URL}/api/messages/${messageId}/pin`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return {
    status: response.status,
    data: response.status === 204
      ? null
      : await response.json(),
  };
};

const listPins = async (
  token: string,
  channelId: string,
) => {
  const response = await fetch(
    `${API_URL}/api/channels/${channelId}/pins`,
    {
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

  console.log("🔐 Logging in Charlie...");

  const charlieToken = await login(
    "charlie@teamspace.dev",
  );

  console.log("✅ Charlie logged in.");

  const channels = await getChannels(aliceToken);

  const publicChannel = channels.find(
    (channel) => channel.is_private === false,
  );

  if (!publicChannel) {
    throw new Error("No accessible public channel found.");
  }

  console.log(
    `📢 Using public channel: ${publicChannel.name}`,
  );

  console.log("\n📝 Creating message...");

  const message = await createMessage(
    aliceToken,
    publicChannel.id,
  );

  console.log(
    `✅ Message: ${message.id}`,
  );

  console.log("\n📌 Pinning message...");

  const pinned = await pinMessage(
    aliceToken,
    message.id,
  );

  if (pinned.status !== 201) {
    throw new Error(
      `Pin failed: ${JSON.stringify(pinned)}`,
    );
  }

  console.log(
    JSON.stringify(pinned.data, null, 2),
  );

  console.log("✅ Message pinned.");

  console.log("\n🚫 Testing duplicate pin...");

  const duplicate = await pinMessage(
    aliceToken,
    message.id,
  );

  if (
    duplicate.status !== 409 ||
    duplicate.data?.error?.code !==
      "MESSAGE_ALREADY_PINNED"
  ) {
    throw new Error(
      `Duplicate pin was not rejected: ${JSON.stringify(
        duplicate,
      )}`,
    );
  }

  console.log(
    "✅ Duplicate pin correctly rejected.",
  );

  console.log("\n📋 Listing channel pins...");

  const pins = await listPins(
    aliceToken,
    publicChannel.id,
  );

  if (pins.status !== 200) {
    throw new Error(
      `Pin listing failed: ${JSON.stringify(pins)}`,
    );
  }

  const foundPin = pins.data?.data?.find(
    (pin: { message_id: string }) =>
      pin.message_id === message.id,
  );

  if (!foundPin) {
    throw new Error(
      "Pinned message was not returned by pin listing.",
    );
  }

  console.log(
    JSON.stringify(foundPin, null, 2),
  );

  console.log("✅ Pinned message appears in channel pins.");

  console.log("\n➖ Unpinning message...");

  const unpinned = await unpinMessage(
    aliceToken,
    message.id,
  );

  if (unpinned.status !== 200) {
    throw new Error(
      `Unpin failed: ${JSON.stringify(unpinned)}`,
    );
  }

  console.log("✅ Message unpinned.");

  console.log("\n🚫 Testing second unpin...");

  const secondUnpin = await unpinMessage(
    aliceToken,
    message.id,
  );

  if (
    secondUnpin.status !== 404 ||
    secondUnpin.data?.error?.code !==
      "MESSAGE_NOT_PINNED"
  ) {
    throw new Error(
      `Missing pin was not rejected: ${JSON.stringify(
        secondUnpin,
      )}`,
    );
  }

  console.log(
    "✅ Missing pin correctly rejected.",
  );

  console.log(
    "\n🔐 Testing private-channel authorization...",
  );

  const privateChannel = channels.find(
    (channel) => channel.is_private === true,
  );

  if (privateChannel) {
    const privateMessage = await createMessage(
      aliceToken,
      privateChannel.id,
    );

    const charliePin = await pinMessage(
      charlieToken,
      privateMessage.id,
    );

    if (
      charliePin.status !== 403 ||
      charliePin.data?.error?.code !==
        "CHANNEL_ACCESS_DENIED"
    ) {
      throw new Error(
        `Private-channel pin authorization failed: ${JSON.stringify(
          charliePin,
        )}`,
      );
    }

    console.log(
      "✅ Private-channel authorization correctly enforced.",
    );
  } else {
    console.log(
      "⚠️ No private channel available; skipping private authorization test.",
    );
  }

  console.log("\n🎉 MESSAGE PIN TEST PASSED!");

  console.log("✅ Pin works.");
  console.log("✅ Duplicate protection works.");
  console.log("✅ Pin listing works.");
  console.log("✅ Unpin works.");
  console.log("✅ Missing-pin handling works.");
  console.log("✅ Private-channel authorization works.");
};

main().catch((error) => {
  console.error(
    "\n❌ MESSAGE PIN TEST FAILED!",
    error,
  );

  process.exit(1);
});