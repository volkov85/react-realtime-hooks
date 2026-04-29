const { WebSocketServer } = require("ws");

const port = 8080;
const wss = new WebSocketServer({ port });

const log = (msg) => {
  const ts = new Date().toISOString().split("T")[1].slice(0, 12);
  console.log(`[${ts}] clients=${wss.clients.size} ${msg}`);
};

wss.on("connection", (ws) => {
  log("CONNECT");
  // Intentionally do NOT echo: avoids flooding the demo's lastMessage with
  // many MB of payload (would balloon the DOM during testing).
  ws.on("message", () => {});
  ws.on("close", () => log("CLOSE"));
  ws.on("error", () => {});
});

wss.on("listening", () => {
  console.log(`echo ws on ws://localhost:${port}`);
});
