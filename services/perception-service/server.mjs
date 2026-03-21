import http from "node:http";

const port = Number.parseInt(process.env.PORT || "8006", 10);

http
  .createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", service: "perception-service" }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  })
  .listen(port, () => {
    console.log(`perception-service listening on ${port}`);
  });

