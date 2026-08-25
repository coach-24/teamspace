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

  if (!workspaces.data?.length) {
    throw new Error("No accessible workspace found.");
  }

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
        console.log(
          "⚠️ Non-JSON WebSocket message:",
          raw.toString(),
        );
      }
    };

    socket.on("message", handler);
  });

const connect = async (token: string) => {
  const socket = new WebSocket(
    `ws://127.0.0.1:4000/ws?token=${encodeURIComponent(token)}`,
  );

  await new Promise<void>((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });

  return socket;
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

  console.log("\n🔌 Connecting Alice...");
  const aliceSocket = await connect(aliceToken);
  console.log("✅ Alice connected.");

  console.log("🔌 Connecting Charlie...");
  const charlieSocket = await connect(charlieToken);
  console.log("✅ Charlie connected.");

  await new Promise((resolve) =>
  setTimeout(resolve, 500),
);

console.log("\n📢 Joining channel...");

const aliceJoinedPromise = waitForMessage(
  aliceSocket,
  (message) =>
    message.type === "channel.joined" &&
    message.channelId === channel.id,
);

const charlieJoinedPromise = waitForMessage(
  charlieSocket,
  (message) =>
    message.type === "channel.joined" &&
    message.channelId === channel.id,
);

console.log(
  "📤 Alice sending:",
  JSON.stringify({
    type: "channel.join",
    channelId: channel.id,
  }),
);

console.log(
  "📤 Charlie sending:",
  JSON.stringify({
    type: "channel.join",
    channelId: channel.id,
  }),
);

aliceSocket.send(
  JSON.stringify({
    type: "channel.join",
    channelId: channel.id,
  }),
);

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

  console.log("\n⌨️ Alice starts typing...");

  const aliceTypingPromise = waitForMessage(
    charlieSocket,
    (message) =>
      message.type === "typing.start" &&
      message.channelId === channel.id,
  );

  aliceSocket.send(
    JSON.stringify({
      type: "typing.start",
      channelId: channel.id,
    }),
  );

  const startMessage = await aliceTypingPromise;

  console.log(
    JSON.stringify(startMessage, null, 2),
  );

  if (
    startMessage.type !== "typing.start" ||
    startMessage.channelId !== channel.id
  ) {
    throw new Error(
      "Invalid typing.start event.",
    );
  }

  console.log(
    "✅ typing.start received by Charlie.",
  );

  console.log("\n⌨️ Alice stops typing...");

  const aliceStopPromise = waitForMessage(
    charlieSocket,
    (message) =>
      message.type === "typing.stop" &&
      message.channelId === channel.id,
  );

  aliceSocket.send(
    JSON.stringify({
      type: "typing.stop",
      channelId: channel.id,
    }),
  );

  const stopMessage = await aliceStopPromise;

  console.log(
    JSON.stringify(stopMessage, null, 2),
  );

  if (
    stopMessage.type !== "typing.stop" ||
    stopMessage.channelId !== channel.id
  ) {
    throw new Error(
      "Invalid typing.stop event.",
    );
  }

  console.log(
    "✅ typing.stop received by Charlie.",
  );

  console.log(
    "\n🔐 Testing private-channel authorization...",
  );

  const workspacesResponse = await fetch(
    `${API_URL}/api/workspaces`,
    {
      headers: {
        Authorization: `Bearer ${aliceToken}`,
      },
    },
  );

  const workspaces = await workspacesResponse.json();

  let privateChannel = null;

  for (const workspace of workspaces.data ?? []) {
    const response = await fetch(
      `${API_URL}/api/workspaces/${workspace.id}/channels`,
      {
        headers: {
          Authorization: `Bearer ${aliceToken}`,
        },
      },
    );

    const data = await response.json();

    privateChannel = data.data?.find(
      (item: { is_private?: boolean }) =>
        item.is_private === true,
    );

    if (privateChannel) break;
  }

  if (privateChannel) {
    const errorPromise = waitForMessage(
      charlieSocket,
      (message) =>
        message.type === "error" &&
        message.code === "CHANNEL_ACCESS_DENIED",
    );

    charlieSocket.send(
      JSON.stringify({
        type: "typing.start",
        channelId: privateChannel.id,
      }),
    );

    await errorPromise;

    console.log(
      "✅ Private-channel typing correctly denied.",
    );
  } else {
    console.log(
      "⚠️ No private channel available; skipping private authorization check.",
    );
  }

  aliceSocket.close();
  charlieSocket.close();

  console.log(
    "\n🎉 TYPING INDICATOR TEST PASSED!",
  );

  console.log("✅ typing.start works.");
  console.log("✅ typing.stop works.");
  console.log("✅ Channel scoping works.");
  console.log(
    "✅ Private-channel authorization works when a private channel is available.",
  );
};

main().catch((error) => {
  console.error(
    "\n❌ TYPING INDICATOR TEST FAILED!",
    error,
  );

  process.exit(1);
});