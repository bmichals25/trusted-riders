import { createServer } from "http";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 3002;

// HTTP server — needed for Render health checks + WebSocket upgrade
const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      clients: clients.size,
      trackers: trackers.size,
      activeTrackers: Array.from(trackers.values()).filter((t) => t.status === "tracking").length,
    }));
    return;
  }
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("TrustedRiders Dispatch Relay");
});

const wss = new WebSocketServer({ server: httpServer });

const clients = new Set();

// ---- GPS Tracking (repurposed from TR_GPS) ----
const trackers = new Map();

function broadcastTrackerList() {
  const list = Array.from(trackers.values());
  const msg = JSON.stringify({ type: "tracker_list", trackers: list });
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(msg);
    }
  }
}

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.driverId = null;
  console.log(`Client connected (${clients.size} total)`);

  // Send current tracker list to the newly connected client
  const list = Array.from(trackers.values());
  ws.send(JSON.stringify({ type: "tracker_list", trackers: list }));

  ws.on("message", (data) => {
    let parsed;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      for (const client of clients) {
        if (client !== ws && client.readyState === 1) {
          client.send(data.toString());
        }
      }
      return;
    }

    // Handle GPS update from driver
    if (parsed.type === "gps_update") {
      const { driverId, driverName, lat, lon, heading, speed, battery, timestamp, ride_id } = parsed;
      if (!driverId || lat == null || lon == null) return;

      ws.driverId = driverId;

      trackers.set(driverId, {
        driverId,
        name: driverName || driverId,
        lat,
        lon,
        heading: heading ?? null,
        speed: speed ?? null,
        battery: battery ?? null,
        timestamp: timestamp ?? new Date().toISOString(),
        ride_id: ride_id ?? null,
        status: "tracking",
        lastUpdate: Date.now(),
      });

      broadcastTrackerList();
      return;
    }

    // Handle driver disconnect announcement
    if (parsed.type === "driver_disconnect") {
      const { driverId } = parsed;
      if (driverId && trackers.has(driverId)) {
        trackers.get(driverId).status = "offline";
        trackers.get(driverId).lastUpdate = Date.now();
        broadcastTrackerList();
      }
      return;
    }

    // All other messages — relay to other clients (dispatch ↔ driver)
    for (const client of clients) {
      if (client !== ws && client.readyState === 1) {
        client.send(data.toString());
      }
    }
  });

  ws.on("close", () => {
    clients.delete(ws);

    if (ws.driverId && trackers.has(ws.driverId)) {
      trackers.get(ws.driverId).status = "offline";
      trackers.get(ws.driverId).lastUpdate = Date.now();
      broadcastTrackerList();
    }

    console.log(`Client disconnected (${clients.size} total)`);
  });
});

// Clean up stale trackers (no update in 2 minutes)
setInterval(() => {
  const staleThreshold = Date.now() - 120000;
  let changed = false;
  for (const [id, tracker] of trackers) {
    if (tracker.lastUpdate < staleThreshold && tracker.status !== "offline") {
      tracker.status = "offline";
      changed = true;
    }
  }
  if (changed) broadcastTrackerList();
}, 30000);

httpServer.listen(PORT, () => {
  console.log(`Dispatch relay running on port ${PORT}`);
});
