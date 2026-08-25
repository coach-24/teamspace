import WebSocket from "ws";

const WS_URL =
  "ws://127.0.0.1:4000/ws?token=invalid-token-12345";

console.log("🚫 Connecting with an invalid token...");

const socket = new WebSocket(WS_URL);

let passed = false;

socket.on("open", () => {
  console.log("⚠️ WebSocket connection opened.");
});

socket.on("message", (data) => {
  console.log("📨 Unexpected server message:");
  console.log(data.toString());

  console.log("\n❌ TEST FAILED!");
  console.log("Invalid token was accepted.");

  socket.close();
  process.exit(1);
});

socket.on("close", (code, reason) => {
  console.log("\n🔌 WebSocket connection closed.");
  console.log("Close code:", code);
  console.log("Close reason:", reason.toString());

  if (code === 1008) {
    passed = true;

    console.log(
      "\n🎉 INVALID TOKEN TEST PASSED!",
    );
    console.log(
      "Invalid WebSocket tokens are rejected.",
    );
  } else {
    console.log(
      "\n❌ INVALID TOKEN TEST FAILED!",
    );
    process.exit(1);
  }
});

socket.on("error", () => {
  // Expected when the server rejects the socket.
});

setTimeout(() => {
  if (!passed) {
    console.log(
      "\n❌ TEST TIMEOUT: server did not reject the connection.",
    );

    socket.close();
    process.exit(1);
  }
}, 5000);