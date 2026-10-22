const { expect, test } = require("@playwright/test");
const { mockStockData } = require("./helpers/stock-data");

function countPrices(page) {
  const requests = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname === "/api/current-price") requests.push(request);
  });
  return requests;
}

async function enter(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await expect(page.locator(".chart-identity")).toContainText("005930");
}

async function reenter(page) {
  await page.getByRole("button", { name: "계정", exact: true }).click();
  await page.getByRole("dialog", { name: "마이페이지" }).getByRole("button", { name: "로그아웃", exact: true }).click();
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await expect(page.locator(".results-panel tbody tr")).not.toHaveCount(0);
}

async function focusAndSwitchTabs(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    delete document.visibilityState;
  });
}

const samsungStatus = page => page.locator(".results-panel tbody tr").filter({ hasText: "삼성전자" }).locator(".alert-status");

test("시간 경과·포커스·탭 복귀·종목 전환·재입장에서도 현재가는 페이지당 한 번만 조회한다", async ({ page }) => {
  const server = await mockStockData(page);
  const requests = countPrices(page);
  await enter(page);
  await expect(samsungStatus(page)).toHaveText("U-12%");
  expect(requests).toHaveLength(1);
  server.currentPrices["005930"] = 97000;
  await page.clock.install();
  await focusAndSwitchTabs(page);
  await page.clock.fastForward(125_000);
  await focusAndSwitchTabs(page);
  const code = page.getByLabel("종목코드", { exact: true });
  await code.fill("000660");
  await code.press("Enter");
  await expect(page.locator(".chart-identity")).toContainText("000660");
  await page.locator(".watch-panel").getByRole("button", { name: "관심 2" }).click();
  await expect(page.locator(".watch-list")).toContainText("SK하이닉스");
  await reenter(page);
  await expect(samsungStatus(page)).toHaveText("U-12%");
  expect(requests).toHaveLength(1);
  expect(requests[0].method()).toBe("GET");
});

test("관심목록 다시 불러오기는 현재가를 재요청하지 않고 최초 가격을 유지한다", async ({ page }) => {
  const server = await mockStockData(page);
  const requests = countPrices(page);
  let failWatch = true;
  await page.route("**/api/watchlist", route => failWatch
    ? route.fulfill({ status: 503, json: { message: "목록 조회 실패" } }) : route.fallback());
  const firstPrice = page.waitForResponse("**/api/current-price");
  await enter(page);
  await firstPrice;
  const watch = page.locator(".watch-panel");
  await expect(watch.getByRole("alert")).toContainText("목록 조회 실패");
  failWatch = false;
  server.currentPrices["005930"] = 97000;
  await watch.getByRole("button", { name: "다시 불러오기" }).click();
  await expect(watch.getByRole("button", { name: "현재 종목 추가", exact: true })).toBeEnabled();
  await expect(samsungStatus(page)).toHaveText("U-12%");
  expect(requests).toHaveLength(1);
});

test("현재가 요청 도중 재입장해도 진행 중인 요청을 공유하고 완료된 값을 표시한다", async ({ page }) => {
  await mockStockData(page);
  const requests = countPrices(page);
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route("**/api/current-price", async route => { await pending; await route.fulfill({ json: { result: { "005930": 88000 } } }); });
  try {
    await enter(page);
    await expect.poll(() => requests.length).toBe(1);
    await reenter(page);
    await expect(page.locator(".watch-panel").getByRole("button", { name: "현재 종목 추가", exact: true })).toBeEnabled();
    expect(requests).toHaveLength(1);
    release();
    await expect(samsungStatus(page)).toHaveText("U-12%");
    expect(requests).toHaveLength(1);
  } finally { release(); }
});

for (const [name, response] of [
  ["서버 오류", { status: 503, json: { message: "현재가 일시 조회 실패" } }],
  ["잘못된 응답 구조", { json: { result: [] } }],
  ["잘못된 가격", { json: { result: { "005930": -1 } } }],
]) {
  test(`${name}에도 자동·수동 반복 요청을 막고 페이지 새로고침으로 새로 조회한다`, async ({ page }) => {
    await mockStockData(page);
    const requests = countPrices(page);
    let failPrice = true, failAlarm = true;
    await page.route("**/api/current-price", route => failPrice ? route.fulfill(response) : route.fallback());
    await page.route("**/api/alarm-price", route => failAlarm
      ? route.fulfill({ status: 503, json: { message: "알람 조회 실패" } }) : route.fallback());
    await enter(page);
    const results = page.locator(".results-panel");
    const priceError = results.getByRole("alert").filter({ hasText: "현재가를 불러오지 못했습니다" });
    await expect(priceError).toContainText("페이지를 새로고침해 주세요");
    await expect(priceError.getByRole("button")).toHaveCount(0);
    await expect(results.getByRole("alert").filter({ hasText: "알람 조회 실패" })).toBeVisible();
    failPrice = false; failAlarm = false;
    await results.getByRole("button", { name: "다시 불러오기" }).click();
    await expect(results.getByRole("alert").filter({ hasText: "알람 조회 실패" })).toHaveCount(0);
    await focusAndSwitchTabs(page);
    await reenter(page);
    await expect(priceError).toBeVisible();
    await expect(samsungStatus(page)).toHaveText("U");
    expect(requests).toHaveLength(1);
    await page.reload();
    await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
    await expect(samsungStatus(page)).toHaveText("U-12%");
    await expect(priceError).toHaveCount(0);
    expect(requests).toHaveLength(2);
  });
}
