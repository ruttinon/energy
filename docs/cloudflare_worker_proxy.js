export default {
  async fetch(request) {
    const origin = "http://61.91.56.190:5000";
    const u = new URL(request.url);
    const target = origin + u.pathname + u.search;
    try {
      const resp = await fetch(new Request(target, request));
      return resp;
    } catch (e) {
      return new Response(JSON.stringify({ status: "error", message: String(e) }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }
  },
};
