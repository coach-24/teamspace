import WebSocket from "ws";

const WS_URL = "ws://127.0.0.1:4000/ws";

console.log("🔌 Connecting to TeamSpace WebSocket...");

const socket = new WebSocket(WS_URL);

socket.on("open", () => {
  console.log("✅ WebSocket connection established.");
});

socket.on("message", (data) => {
  console.log("\n📨 Server message");
  console.log("======================");
  console.log(data.toString());

  try {
    const message = JSON.parse(data.toString());

    if (message.type === "connection.established") {
      console.log("\n🎉 WEBSOCKET CONNECTION TEST PASSED!");

      socket.close();
    }
  } catch (error) {
    console.error("❌ Invalid JSON response:", error);
    socket.close();
    process.exit(1);
  }
});

socket.on("close", () => {
  console.log("🔌 WebSocket connection closed.");
});

socket.on("error", (error: Error) => {
  console.error("❌ WebSocket error:", error);
  process.exit(1);
});