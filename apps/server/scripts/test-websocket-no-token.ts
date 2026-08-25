import WebSocket from "ws";

const WS_URL = "ws://127.0.0.1:4000/ws";

console.log("🚫 Connecting without authentication token...");

const socket = new WebSocket(WS_URL);

let passed = false;

socket.on("open", () => {
  console.log("⚠️ WebSocket connection opened.");
});

socket.on("message", (data) => {
  console.log("📨 Unexpected server message:");
  console.log(data.toString());

  console.log("\n❌ TEST FAILED!");
  console.log("Unauthenticated client received a message.");

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
      "\n🎉 WEBSOCKET AUTHENTICATION RBAC PASSED!",
    );
    console.log(
      "Unauthenticated clients cannot connect.",
    );
  } else {
    console.log(
      "\n❌ WEBSOCKET AUTHENTICATION TEST FAILED!",
    );
    process.exit(1);
  }
});

socket.on("error", () => {
  // The server may close the connection during the
  // authentication handshake. The close event is
  // what determines the test result.
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