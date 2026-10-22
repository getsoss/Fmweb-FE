const { expect, test } = require("@playwright/test");
const { mockStockData } = require("./helpers/stock-data");

function resultRow(page, name = "동화약품") {
  return page.locator(".results-panel tbody tr").filter({ hasText: name });
}

async function enter(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await expect(resultRow(page)).toBeVisible();
  await expect(page.locator(".watch-panel").getByRole("button", { name: "현재 종목 추가", exact: true })).toBeEnabled();
}

async function logoutAndEnter(page) {
  await page.getByRole("button", { name: "계정", exact: true }).click();
  await page.getByRole("dialog", { name: "마이페이지" }).getByRole("button", { name: "로그아웃", exact: true }).click();
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await expect(resultRow(page)).toBeVisible();
}

async function openAlarmMenu(page) {
  await resultRow(page).click();
  await expect(page.locator(".chart-identity")).toContainText("000020");
  const pane = page.locator(".chart-engine table tr").first();
  await expect(pane).toBeVisible();
  const bounds = await pane.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.click(bounds.x + bounds.width * .6, bounds.y + bounds.height * .4, { button: "right" });
  await expect(page.getByRole("menu", { name: "알람가격 메뉴" })).toBeVisible();
}

async function setAlarm(page) {
  await openAlarmMenu(page);
  await page.getByRole("menuitem", { name: "알람가격 넣기" }).click();
  await expect(resultRow(page).locator("td").nth(4)).not.toHaveText("");
  await expect(page.getByRole("menu", { name: "알람가격 메뉴" })).toHaveCount(0);
  return Number((await resultRow(page).locator("td").nth(4).innerText()).replaceAll(",", ""));
}

function observeAlarmWrites(page) {
  const writes = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname === "/api/alarm-price" && request.method() === "PUT") writes.push(request.postDataJSON());
  });
  return writes;
}

async function expectOtherBrowser(browser, server, price) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await mockStockData(page, [], server);
    await enter(page);
    await expect(resultRow(page).locator("td").nth(4)).toHaveText(price === null ? "" : price.toLocaleString("en-US"));
    await expect(resultRow(page).locator(".alert-status")).toHaveText(price === null ? "U" : /^U[+-]?\d+(\.\d+)?%$/);
    await expect(page.locator(".watch-list .alert-status")).toHaveCount(0);
  } finally { await context.close(); }
}

test("관심종목이 아닌 검색결과의 임시 알람은 서버에 쓰지 않고 로그아웃·다른 브라우저에 전달하지 않는다", async ({ page, browser }) => {
  const server = await mockStockData(page);
  server.alarmPrices = {};
  const writes = observeAlarmWrites(page);
  await enter(page);
  const price = await setAlarm(page);
  expect(price).toBeGreaterThan(0);
  const status = resultRow(page).locator(".alert-status");
  await expect(status).toHaveText(/^U-\d+(\.\d+)?%$/);
  await expect(status).toHaveCSS("background-color", "rgb(51, 102, 255)");
  expect(writes).toEqual([]);
  expect(server.alarmPrices).not.toHaveProperty("000020");

  await openAlarmMenu(page);
  await page.getByRole("menuitem", { name: "알람가격 삭제" }).click();
  await expect(resultRow(page).locator("td").nth(4)).toHaveText("");
  await expect(status).toHaveText("U");
  await expect(status).not.toHaveAttribute("style", /background-color:/);
  await setAlarm(page);
  expect(writes).toEqual([]);

  await expectOtherBrowser(browser, server, null);
  await logoutAndEnter(page);
  await expect(resultRow(page).locator("td").nth(4)).toHaveText("");
  await expect(status).toHaveText("U");
  expect(writes).toEqual([]);
});

test("임시 알람 종목을 관심종목에 추가하면 서버에 영구 저장하고 재로그인·다른 브라우저에서 복원한다", async ({ page, browser }) => {
  const server = await mockStockData(page);
  server.alarmPrices = {};
  const writes = observeAlarmWrites(page);
  await enter(page);
  const price = await setAlarm(page);
  expect(writes).toEqual([]);
  await page.locator(".watch-panel").getByRole("button", { name: "현재 종목 추가", exact: true }).click();
  await expect.poll(() => server.watchlists["1"]).toContain("000020");
  expect(server.alarmPrices["000020"]).toBe(price);
  expect(writes).toContainEqual({ mode: "add", alarm_prices: { "000020": price } });
  await expect(page.locator(".watch-list")).toContainText(`알람가격 ${price.toLocaleString("en-US")}`);
  await expect(page.locator(".watch-list .alert-status")).toHaveCount(0);
  await logoutAndEnter(page);
  await expect(resultRow(page).locator("td").nth(4)).toHaveText(price.toLocaleString("en-US"));
  await expect(page.locator(".watch-list")).toContainText(`알람가격 ${price.toLocaleString("en-US")}`);
  await expectOtherBrowser(browser, server, price);
});

test("현재 폴더가 비어 있어도 다른 관심 폴더에 있는 종목의 알람 변경·삭제를 서버에 저장한다", async ({ page }) => {
  const server = await mockStockData(page);
  server.watchlists = { "5": ["000020"] };
  server.alarmPrices = {};
  const writes = observeAlarmWrites(page);
  await enter(page);
  const price = await setAlarm(page);
  expect(writes).toEqual([{ mode: "add", alarm_prices: { "000020": price } }]);
  expect(server.alarmPrices["000020"]).toBe(price);
  const watch = page.locator(".watch-panel");
  await watch.getByRole("button", { name: /^관심 5/ }).click();
  await expect(watch.locator(".watch-list")).toContainText(`알람가격 ${price.toLocaleString("en-US")}`);
  await watch.getByRole("button", { name: /^관심 1/ }).click();
  await openAlarmMenu(page);
  await page.getByRole("menuitem", { name: "알람가격 삭제" }).click();
  await expect(resultRow(page).locator("td").nth(4)).toHaveText("");
  expect(writes.at(-1)).toEqual({ mode: "delete", alarm_prices: { "000020": 0 } });
  expect(server.alarmPrices).not.toHaveProperty("000020");
  await expect(resultRow(page).locator(".alert-status")).toHaveText("U");
});

test("관심종목 추가가 실패해도 임시 알람을 유지하고 미등록 서버 알람은 다른 브라우저에 복원하지 않는다", async ({ page, browser }) => {
  const server = await mockStockData(page);
  server.alarmPrices = {};
  let fail = true;
  await page.route("**/api/watchlist", route => route.request().method() === "PUT" && fail
    ? route.fulfill({ status: 503, json: { message: "관심종목 추가 실패" } }) : route.fallback());
  await enter(page);
  const price = await setAlarm(page);
  const watch = page.locator(".watch-panel");
  await watch.getByRole("button", { name: "현재 종목 추가", exact: true }).click();
  await expect(watch.getByRole("alert")).toContainText("관심종목 추가 실패");
  await expect(resultRow(page).locator("td").nth(4)).toHaveText(price.toLocaleString("en-US"));
  expect(server.watchlists["1"]).not.toContain("000020");
  // The API has no transaction: alarm promotion can succeed before adding the
  // watchlist fails. The unlisted server value must remain session-only in UI.
  expect(server.alarmPrices["000020"]).toBe(price);
  await expectOtherBrowser(browser, server, null);
  fail = false;
  await watch.getByRole("button", { name: "현재 종목 추가", exact: true }).click();
  await expect.poll(() => server.watchlists["1"]).toContain("000020");
  expect(server.alarmPrices["000020"]).toBe(price);
  await expect(watch.locator(".watch-list")).toContainText(`알람가격 ${price.toLocaleString("en-US")}`);
});

test("임시 알람의 서버 승격이 실패하면 관심종목 추가 요청을 막고 임시값을 보존해 재시도한다", async ({ page }) => {
  const server = await mockStockData(page);
  server.alarmPrices = {};
  let fail = true;
  let watchWrites = 0;
  const alarmWrites = observeAlarmWrites(page);
  page.on("request", request => {
    if (new URL(request.url()).pathname === "/api/watchlist" && request.method() === "PUT") watchWrites++;
  });
  await page.route("**/api/alarm-price", route => route.request().method() === "PUT" && fail
    ? route.fulfill({ status: 503, json: { message: "임시 알람 영구 저장 실패" } }) : route.fallback());
  await enter(page);
  const price = await setAlarm(page);
  const watch = page.locator(".watch-panel");
  await watch.getByRole("button", { name: "현재 종목 추가", exact: true }).click();
  await expect(watch.getByRole("alert")).toContainText("임시 알람 영구 저장 실패");
  await expect(resultRow(page).locator("td").nth(4)).toHaveText(price.toLocaleString("en-US"));
  await expect(resultRow(page).locator(".alert-status")).toHaveText(/^U-\d+(\.\d+)?%$/);
  expect(watchWrites).toBe(0);
  expect(server.watchlists["1"]).not.toContain("000020");
  expect(server.alarmPrices).not.toHaveProperty("000020");
  expect(alarmWrites).toEqual([{ mode: "add", alarm_prices: { "000020": price } }]);

  fail = false;
  await watch.getByRole("button", { name: "현재 종목 추가", exact: true }).click();
  await expect.poll(() => server.watchlists["1"]).toContain("000020");
  expect(server.alarmPrices["000020"]).toBe(price);
  expect(watchWrites).toBe(1);
  expect(alarmWrites).toHaveLength(2);
  await expect(watch.locator(".watch-list")).toContainText(`알람가격 ${price.toLocaleString("en-US")}`);
});

test("관심종목이 다른 폴더에 남으면 알람을 복원하고 마지막 폴더에서 제거하면 현재 세션에서만 유지한다", async ({ page, browser }) => {
  const server = await mockStockData(page);
  server.watchlists = { "1": ["000020"], "5": ["000020"] };
  server.alarmPrices = { "000020": 20000 };
  const writes = observeAlarmWrites(page);
  await enter(page);
  const watch = page.locator(".watch-panel");
  await expect(resultRow(page).locator("td").nth(4)).toHaveText("20,000");
  await watch.getByRole("button", { name: "동화약품 관심종목 제외", exact: true }).click();
  await expect(watch.locator(".watch-list li")).toHaveCount(0);
  expect(server.watchlists["5"]).toContain("000020");
  await logoutAndEnter(page);
  await expect(resultRow(page).locator("td").nth(4)).toHaveText("20,000");

  await watch.getByRole("button", { name: /^관심 5/ }).click();
  await watch.getByRole("button", { name: "동화약품 관심종목 제외", exact: true }).click();
  await expect(watch.locator(".watch-list li")).toHaveCount(0);
  await expect(resultRow(page).locator("td").nth(4)).toHaveText("20,000");
  expect(server.alarmPrices["000020"]).toBe(20000);
  expect(writes).toEqual([]);
  await expectOtherBrowser(browser, server, null);
  await logoutAndEnter(page);
  await expect(resultRow(page).locator("td").nth(4)).toHaveText("");
  await expect(resultRow(page).locator(".alert-status")).toHaveText("U");
});

test("임시 알람 승격·관심 알람 저장 후 다시 불러오면 최신 서버 가격이 이전 세션 값을 대체한다", async ({ page }) => {
  const server = await mockStockData(page);
  server.alarmPrices = {};
  let failAlarmWrite = false;
  await page.route("**/api/alarm-price", route => failAlarmWrite && route.request().method() === "PUT"
    ? route.fulfill({ status: 503, json: { message: "알람가격 일시 저장 실패" } }) : route.fallback());
  await enter(page);
  const price = await setAlarm(page);
  await page.locator(".watch-panel").getByRole("button", { name: "현재 종목 추가", exact: true }).click();
  await expect.poll(() => server.watchlists["1"]).toContain("000020");
  expect(server.alarmPrices["000020"]).toBe(price);

  async function reloadServerAlarm(latestPrice) {
    failAlarmWrite = true;
    await openAlarmMenu(page);
    await page.getByRole("menuitem", { name: "알람가격 넣기" }).click();
    const results = page.locator(".results-panel");
    await expect(results.getByRole("alert")).toContainText("알람가격 일시 저장 실패");
    failAlarmWrite = false;
    server.alarmPrices["000020"] = latestPrice;
    const alarmReload = page.waitForResponse(response => response.url().endsWith("/api/alarm-price") && response.request().method() === "GET");
    await results.getByRole("button", { name: "다시 불러오기", exact: true }).click();
    await alarmReload;
    await expect(resultRow(page).locator("td").nth(4)).toHaveText(latestPrice.toLocaleString("en-US"));
    await expect(page.locator(".watch-list")).toContainText(`알람가격 ${latestPrice.toLocaleString("en-US")}`);
    await expect(results.getByRole("alert")).toHaveCount(0);
  }

  await reloadServerAlarm(33000);
  // Exercise a direct update of an already watched alarm as well as promotion.
  const savedPrice = await setAlarm(page);
  expect(server.alarmPrices["000020"]).toBe(savedPrice);
  await reloadServerAlarm(42000);
});

test("마지막 관심종목 제거 후 임시 알람을 삭제하면 재추가 시 이전 서버 알람도 삭제하고 재로그인에 되살리지 않는다", async ({ page }) => {
  const server = await mockStockData(page);
  server.watchlists = { "1": ["000020"] };
  server.alarmPrices = { "000020": 20000 };
  const alarmWrites = observeAlarmWrites(page);
  const mutations = [];
  page.on("request", request => {
    const path = new URL(request.url()).pathname;
    if (request.method() === "PUT" && ["/api/alarm-price", "/api/watchlist"].includes(path)) mutations.push({ path, body: request.postDataJSON() });
  });
  await enter(page);
  const watch = page.locator(".watch-panel");
  await expect(resultRow(page).locator("td").nth(4)).toHaveText("20,000");
  await watch.getByRole("button", { name: "동화약품 관심종목 제외", exact: true }).click();
  await expect(watch.locator(".watch-list li")).toHaveCount(0);
  await expect(resultRow(page).locator("td").nth(4)).toHaveText("20,000");
  await openAlarmMenu(page);
  await page.getByRole("menuitem", { name: "알람가격 삭제" }).click();
  await expect(resultRow(page).locator("td").nth(4)).toHaveText("");
  await expect(resultRow(page).locator(".alert-status")).toHaveText("U");
  expect(alarmWrites).toEqual([]);
  expect(server.alarmPrices["000020"]).toBe(20000);

  const beforeAdd = mutations.length;
  await watch.getByRole("button", { name: "현재 종목 추가", exact: true }).click();
  await expect.poll(() => server.watchlists["1"]).toContain("000020");
  expect(mutations.slice(beforeAdd)).toEqual([
    { path: "/api/alarm-price", body: { mode: "delete", alarm_prices: { "000020": 0 } } },
    { path: "/api/watchlist", body: { slot: 1, jmcodes: ["000020"], mode: "add" } },
  ]);
  expect(server.alarmPrices).not.toHaveProperty("000020");
  await expect(resultRow(page).locator("td").nth(4)).toHaveText("");
  await expect(watch.locator(".watch-list")).not.toContainText("알람가격");
  await logoutAndEnter(page);
  await expect(resultRow(page).locator("td").nth(4)).toHaveText("");
  await expect(resultRow(page).locator(".alert-status")).toHaveText("U");
});
