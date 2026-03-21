import http from "node:http";

const port = Number.parseInt(process.env.PORT || "8003", 10);

http
  .createServer(async (req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", service: "llm-service" }));
      return;
    }

    // Minimal proxy endpoint to keep contracts stable as we add providers.
    if (req.url === "/generate" && req.method === "POST") {
      const baseUrl = process.env.OLLAMA_API || "http://ollama:11434";
      const body = await readJson(req);
      const upstream = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      res.writeHead(upstream.status, { "Content-Type": "application/json" });
      res.end(await upstream.text());
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  })
  .listen(port, () => {
    console.log(`llm-service listening on ${port}`);
  });

function readJson(req) {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => (buf += chunk));
    req.on("end", () => {
      try {
        resolve(buf ? JSON.parse(buf) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

