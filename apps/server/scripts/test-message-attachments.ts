import "dotenv/config";
import fs from "node:fs/promises";

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

  if (!response.ok) {
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

  if (!response.ok) {
    throw new Error(
      `Channel lookup failed: ${JSON.stringify(data)}`,
    );
  }

  return data.data ?? [];
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
        content: `Attachment test ${Date.now()}`,
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

const uploadAttachment = async (
  token: string,
  messageId: string,
) => {
  const form = new FormData();

  const content = "TeamSpace attachment test file.";

  form.append(
    "file",
    new Blob([content], {
      type: "text/plain",
    }),
    "teamspace-test.txt",
  );

  const response = await fetch(
    `${API_URL}/api/messages/${messageId}/attachments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Upload failed: ${JSON.stringify(data)}`,
    );
  }

  return data.data;
};

const main = async () => {
  console.log("🔐 Logging in Alice...");

  const aliceToken = await login(
    "alice@teamspace.dev",
  );

  console.log("✅ Alice logged in.");

  const workspace =
    await getWorkspace(aliceToken);

  const channels = await getChannels(
    aliceToken,
    workspace.id,
  );

  const channel = channels.find(
    (item: { is_private?: boolean }) =>
      item.is_private === true,
  );

  if (!channel) {
    throw new Error(
      "No accessible private channel found.",
    );
  }

  console.log(
    `📎 Using private channel: ${channel.name}`,
  );

  console.log("\n📝 Creating message...");

  const message = await createMessage(
    aliceToken,
    channel.id,
  );

  console.log(
    "✅ Message:",
    message.id,
  );

  console.log("\n⬆️ Uploading attachment...");

  const attachment =
    await uploadAttachment(
      aliceToken,
      message.id,
    );

  console.log(
    "✅ Attachment uploaded:",
    attachment.id,
  );

  if (
    attachment.file_name !==
    "teamspace-test.txt"
  ) {
    throw new Error(
      "Attachment filename mismatch.",
    );
  }

  if (
    attachment.mime_type !==
    "text/plain"
  ) {
    throw new Error(
      "Attachment MIME type mismatch.",
    );
  }

  console.log(
    "✅ Attachment metadata is correct.",
  );

  console.log(
    "\n⬇️ Requesting signed download URL...",
  );

  const downloadResponse =
    await fetch(
      `${API_URL}/api/attachments/${attachment.id}`,
      {
        headers: {
          Authorization: `Bearer ${aliceToken}`,
        },
      },
    );

  const downloadResult =
    await downloadResponse.json();

  if (!downloadResponse.ok) {
    throw new Error(
      `Download URL failed: ${JSON.stringify(
        downloadResult,
      )}`,
    );
  }

  if (
    !downloadResult.data?.url
  ) {
    throw new Error(
      "Signed URL was not returned.",
    );
  }

  console.log(
    "✅ Signed URL generated.",
  );

  console.log(
    "\n📥 Downloading attachment...",
  );

  const fileResponse =
    await fetch(
      downloadResult.data.url,
    );

  if (!fileResponse.ok) {
    throw new Error(
      `Storage download failed: ${fileResponse.status}`,
    );
  }

  const downloaded =
    await fileResponse.text();

  if (
    downloaded !==
    "TeamSpace attachment test file."
  ) {
    throw new Error(
      "Downloaded file content mismatch.",
    );
  }

  console.log(
    "✅ Downloaded file content matches.",
  );

  console.log(
    "\n🔐 Logging in Charlie...",
  );

  const charlieToken = await login(
    "charlie@teamspace.dev",
  );

  console.log(
    "🚫 Charlie attempts attachment access...",
  );

  const forbiddenResponse =
    await fetch(
      `${API_URL}/api/attachments/${attachment.id}`,
      {
        headers: {
          Authorization: `Bearer ${charlieToken}`,
        },
      },
    );

  if (
    forbiddenResponse.status !== 403
  ) {
    const result =
      await forbiddenResponse.json();

    throw new Error(
      `Private attachment isolation failed: ${JSON.stringify(
        result,
      )}`,
    );
  }

  console.log(
    "✅ Charlie correctly denied.",
  );

  console.log(
    "\n🎉 MESSAGE ATTACHMENT TEST PASSED!",
  );

  console.log(
    "✅ Upload works.",
  );

  console.log(
    "✅ Metadata works.",
  );

  console.log(
    "✅ Signed URLs work.",
  );

  console.log(
    "✅ Storage download works.",
  );

  console.log(
    "✅ Private-channel authorization works.",
  );
};

main().catch((error) => {
  console.error(
    "\n❌ ATTACHMENT TEST FAILED!",
    error,
  );

  process.exit(1);
});