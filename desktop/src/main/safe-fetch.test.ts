import assert from "node:assert/strict";
import test from "node:test";
import { fetchSameOrigin } from "./safe-fetch.ts";

test("fetchSameOrigin recusa redirect para outra origem", async () => {
  const server = await import("node:http").then(({ createServer }) =>
    createServer((req, res) => {
      if (req.url === "/start") {
        res.writeHead(302, { Location: "https://evil.example/steal" });
        res.end();
        return;
      }
      res.writeHead(404);
      res.end();
    }),
  );

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Servidor de teste indisponível.");
  }

  const base = `http://127.0.0.1:${address.port}`;
  try {
    await assert.rejects(
      () => fetchSameOrigin(`${base}/start`),
      /origem não permitida/,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("fetchSameOrigin segue redirect na mesma origem", async () => {
  const server = await import("node:http").then(({ createServer }) =>
    createServer((req, res) => {
      if (req.url === "/start") {
        res.writeHead(302, { Location: "/final" });
        res.end();
        return;
      }
      if (req.url === "/final") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.writeHead(404);
      res.end();
    }),
  );

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Servidor de teste indisponível.");
  }

  const base = `http://127.0.0.1:${address.port}`;
  try {
    const response = await fetchSameOrigin(`${base}/start`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok: boolean };
    assert.equal(body.ok, true);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
