const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { NextRequest } = require("next/server");

function harness(route, upstream = { status: 200, body: "" }) {
  const calls = [];
  const sessions = [];
  const backend = {
    createBackendSession: async request => {
      sessions.push(request);
      return {
        call: async (...args) => { calls.push(args); if (upstream instanceof Error) throw upstream; return upstream; },
        finish: response => { response.cookies.set("test-refreshed-session", "refreshed"); return response; },
      };
    },
    parseJson: response => JSON.parse(response.body),
  };
  const cache = new Map();
  function load(filename) {
    if (filename === path.resolve("app/api/backend.ts")) return backend;
    if (cache.has(filename)) return cache.get(filename);
    const module = {};
    cache.set(filename, module);
    const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
    }).outputText;
    new Function("require", "exports", compiled)(name => name.startsWith(".") ? load(path.resolve(path.dirname(filename), `${name}.ts`)) : require(name), module);
    return module;
  }
  return { handlers: load(path.resolve(`app/api/${route}/route.ts`)), calls, sessions };
}

function put(route, body, origin = "http://localhost") {
  return new NextRequest(`http://localhost/api/${route}`, { method: "PUT", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

for (const route of ["watchlist", "watchlist-max", "alarm-price", "current-price"]) {
  test(`${route}: authenticated GET uses its fixed backend path and disables caching`, async () => {
    const body = { result: route === "watchlist-max" ? 100 : {} };
    const { handlers, calls, sessions } = harness(route, { status: 200, body: JSON.stringify(body) });
    const request = new NextRequest(`http://localhost/api/${route}`);
    const response = await handlers.GET(request);
    assert.equal(sessions[0], request);
    assert.deepEqual(calls, [[`/${route}`, "GET", undefined]]);
    assert.deepEqual(await response.json(), body);
    assert.match(response.headers.get("cache-control"), /private, no-store/);
    assert.match(response.headers.get("set-cookie"), /test-refreshed-session=refreshed/);
  });
}

test("watchlist: forwards one-based slots, multiple codes and deletion; accepts empty successful bodies", async () => {
  for (const body of [{ slot: 1, jmcodes: ["005930", "00AB12"], mode: "add" }, { slot: 5, jmcodes: ["005930", "000020"], mode: "delete" }]) {
    const { handlers, calls } = harness("watchlist");
    const response = await handlers.PUT(put("watchlist", body));
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "");
    assert.deepEqual(calls, [["/watchlist", "PUT", body]]);
  }
});

test("watchlist: invalid slots and codes never reach the backend", async () => {
  const valid = { slot: 1, jmcodes: ["005930"], mode: "add" };
  for (const patch of [{ slot: 0 }, { slot: 6 }, { slot: "2" }, { jmcodes: [] }, { jmcodes: [123456] }, { jmcodes: ["12!ABC"] }, { mode: "replace" }]) {
    const { handlers, calls } = harness("watchlist");
    assert.equal((await handlers.PUT(put("watchlist", { ...valid, ...patch }))).status, 400);
    assert.equal(calls.length, 0);
  }
});

test("successful writes accept plain-text acknowledgements", async () => {
  for (const [route, body] of [["watchlist", { slot: 1, jmcodes: ["005930"], mode: "add" }], ["alarm-price", { alarm_prices: { "005930": 123.4 }, mode: "add" }]]) {
    const { handlers } = harness(route, { status: 200, body: "OK" });
    const response = await handlers.PUT(put(route, body));
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "");
  }
});

test("alarm-price: preserves decimal prices and sends deletion values as zero", async () => {
  for (const body of [{ alarm_prices: { "005930": 123.4, "00AB12": 456.78 }, mode: "add" }, { alarm_prices: { "005930": 0, "00AB12": 0 }, mode: "delete" }]) {
    const { handlers, calls } = harness("alarm-price");
    assert.equal((await handlers.PUT(put("alarm-price", body))).status, 200);
    assert.deepEqual(calls, [["/alarm-price", "PUT", body]]);
  }
});

test("alarm-price: rejects invalid prices and unknown operations", async () => {
  for (const body of [{ alarm_prices: {}, mode: "add" }, { alarm_prices: { "005930": 0 }, mode: "add" }, { alarm_prices: { "005930": -1 }, mode: "add" }, { alarm_prices: { "005930": null }, mode: "add" }, { alarm_prices: { "005930": 1 }, mode: "delete" }, { alarm_prices: { "12!ABC": 1 }, mode: "add" }, { alarm_prices: { "005930": 1 }, mode: "replace" }]) {
    const { handlers, calls } = harness("alarm-price");
    assert.equal((await handlers.PUT(put("alarm-price", body))).status, 400);
    assert.equal(calls.length, 0);
  }
});

test("portfolio mutations reject cross-origin requests and malformed JSON", async () => {
  for (const route of ["watchlist", "alarm-price"]) {
    const { handlers, sessions } = harness(route);
    assert.equal((await handlers.PUT(put(route, {}, "https://other.example"))).status, 403);
    const malformed = new NextRequest(`http://localhost/api/${route}`, { method: "PUT", body: "{" });
    assert.equal((await handlers.PUT(malformed)).status, 400);
    assert.equal(sessions.length, 0);
  }
});

test("upstream authorization, capacity and server errors retain their HTTP status", async () => {
  for (const status of [401, 403, 409, 500]) {
    const { handlers } = harness("watchlist", { status, body: "upstream failure" });
    const response = await handlers.PUT(put("watchlist", { slot: 1, jmcodes: ["005930"], mode: "add" }));
    assert.equal(response.status, status);
    assert.match(response.headers.get("set-cookie"), /test-refreshed-session/);
    assert.ok((await response.json()).message);
  }
});

test("transport failures and malformed successful JSON return 502", async () => {
  for (const upstream of [new Error("connection failed"), { status: 200, body: "invalid json" }]) {
    const { handlers } = harness("alarm-price", upstream);
    const response = await handlers.GET(new NextRequest("http://localhost/api/alarm-price"));
    assert.equal(response.status, 502);
  }
});
