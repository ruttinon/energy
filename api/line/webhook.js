export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error" });
  }
  let raw = "";
  if (req.body && typeof req.body === "object") {
    try {
      raw = JSON.stringify(req.body);
    } catch {
      raw = "";
    }
  } else {
    raw = await new Promise((resolve) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => resolve(data));
    });
  }
  const signature = req.headers["x-line-signature"] || "";
  const channelSecret = process.env.LINE_CHANNEL_SECRET || "";
  let valid = true;
  try {
    if (signature && channelSecret && raw) {
      const crypto = await import("crypto");
      const h = crypto.createHmac("sha256", channelSecret);
      h.update(raw);
      const expected = h.digest("base64");
      const a = Buffer.from(signature);
      const b = Buffer.from(expected);
      valid = a.length === b.length && crypto.timingSafeEqual(a, b);
    }
  } catch {
    valid = true;
  }
  let data = {};
  try {
    data = JSON.parse(raw || "{}");
  } catch {
    data = {};
  }
  const events = Array.isArray(data.events) ? data.events : [];
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
  for (const ev of events) {
    if (ev && ev.type === "message" && ev.message && ev.message.type === "text") {
      const replyToken = ev.replyToken;
      const text = ev.message.text || "";
      const msg = { type: "text", text: text ? `รับข้อความแล้ว: ${text}` : "รับข้อความแล้ว" };
      if (accessToken && replyToken) {
        try {
          await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ replyToken, messages: [msg] }),
          });
        } catch {}
      }
    }
  }
  return res.status(200).json({ status: "ok", valid });
}
