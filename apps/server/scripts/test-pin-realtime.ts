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
    throw new Error(`Login failed: ${JSON.stringify(data)}`);
  }

  return data.access_token as string;
};

const getPublicChannel = async (token: string) => {
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

    if (channel) return channel;
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
        content: `Realtime pin test ${Date.now()}`,
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

const connect = async (token: string) => {
  const socket = new WebSocket(
    `ws://127.0.0.1:4000/ws?token=${encodeURIComponent(token)}`,
  );

  await new Promise<void>((resolve, reject) => {
    const onOpen = () => {
      socket.off("error", onError);
      resolve();
    };

    const onError = (error: Error) => {
      socket.off("open", onOpen);
      reject(error);
    };

    socket.once("open", onOpen);
    socket.once("error", onError);
  });

  return socket;
};

const waitForMessage = (
  socket: WebSocket,
  predicate: (message: any) => boolean,
  timeoutMs = 5000,
) =>
  new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", handler);
      reject(
        new Error(
          "Timed out waiting for WebSocket message.",
        ),
      );
    }, timeoutMs);

    const handler = (raw: WebSocket.RawData) => {
      try {
        const message = JSON.parse(raw.toString());

        console.log(
          "📨 WebSocket message:",
          JSON.stringify(message),
        );

        if (predicate(message)) {
          clearTimeout(timeout);
          socket.off("message", handler);
          resolve(message);
        }
      } catch {
        // Ignore unrelated messages.
      }
    };

    socket.on("message", handler);
  });

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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Pin failed: ${JSON.stringify(data)}`,
    );
  }

  return data.data;
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

  if (!response.ok) {
    const data = await response.json();

    throw new Error(
      `Unpin failed: ${JSON.stringify(data)}`,
    );
  }
};

const main = async () => {
  console.log("🔐 Logging in Alice...");
  const aliceToken = await login("alice@teamspace.dev");
  console.log("✅ Alice logged in.");

  console.log("🔐 Logging in Charlie...");
  const charlieToken = await login("charlie@teamspace.dev");
  console.log("✅ Charlie logged in.");

  const channel = await getPublicChannel(aliceToken);

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

  console.log("\n🔌 Connecting Alice...");
  const aliceSocket = await connect(aliceToken);
  console.log("✅ Alice connected.");

  console.log("🔌 Connecting Charlie...");
  const charlieSocket = await connect(charlieToken);
  console.log("✅ Charlie connected.");

  await new Promise((resolve) =>
    setTimeout(resolve, 500),
  );


await new Promise((resolve) =>
  setTimeout(resolve, 500),
);


console.log("\n📢 Joining channel...");

const aliceJoinedPromise = waitForMessage(
  aliceSocket,
  (message) =>
    message.type === "channel.joined" &&
    message.channelId === channel.id,
  10000,
);

const charlieJoinedPromise = waitForMessage(
  charlieSocket,
  (message) =>
    message.type === "channel.joined" &&
    message.channelId === channel.id,
  10000,
);

console.log("📤 Sending Alice join...");

aliceSocket.send(
  JSON.stringify({
    type: "channel.join",
    channelId: channel.id,
  }),
);

console.log("📤 Sending Charlie join...");

charlieSocket.send(
  JSON.stringify({
    type: "channel.join",
    channelId: channel.id,
  }),
);

await Promise.all([
  aliceJoinedPromise,
  charlieJoinedPromise,
]);

console.log("✅ Both users joined.");

  console.log("\n📌 Alice pins message...");

  const pinPromise = waitForMessage(
    charlieSocket,
    (incoming) =>
      incoming.type === "message.pinned" &&
      incoming.data?.message_id === message.id,
  );

  await pinMessage(
    aliceToken,
    message.id,
  );

  const pinEvent = await pinPromise;

  if (
    pinEvent.type !== "message.pinned" ||
    pinEvent.data?.message_id !== message.id
  ) {
    throw new Error(
      "Invalid message.pinned event.",
    );
  }

  console.log(
    "✅ Charlie received message.pinned.",
  );

  console.log("\n➖ Alice unpins message...");

  const unpinPromise = waitForMessage(
    charlieSocket,
    (incoming) =>
      incoming.type === "message.unpinned" &&
      incoming.data?.message_id === message.id,
  );

  await unpinMessage(
    aliceToken,
    message.id,
  );

  const unpinEvent = await unpinPromise;

  if (
    unpinEvent.type !== "message.unpinned" ||
    unpinEvent.data?.message_id !== message.id
  ) {
    throw new Error(
      "Invalid message.unpinned event.",
    );
  }

  console.log(
    "✅ Charlie received message.unpinned.",
  );

  aliceSocket.close();
  charlieSocket.close();

  console.log(
    "\n🎉 REALTIME PIN TEST PASSED!",
  );

  console.log(
    "✅ message.pinned broadcast works.",
  );

  console.log(
    "✅ message.unpinned broadcast works.",
  );

  console.log(
    "✅ Channel realtime delivery works.",
  );
};

main().catch((error) => {
  console.error(
    "\n❌ REALTIME PIN TEST FAILED!",
    error,
  );

  process.exit(1);
});