const { expect, test } = require("@playwright/test");
const { mockStockData } = require("./helpers/stock-data");

async function enter(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await expect(page.locator(".chart-identity")).toContainText("005930");
  return page.getByRole("form", { name: "종목 조회", exact: true });
}

for (const [field, value, ticker, name] of [
  ["종목이름", " SK하이닉스 ", "000660", "SK하이닉스"],
  ["종목코드", "000020", "000020", "동화약품"],
]) {
  test(`${field} Enter는 차트보기 버튼처럼 해당 종목을 조회한다`, async ({ page }) => {
    await mockStockData(page);
    const lookup = await enter(page);
    const requests = [];
    page.on("request", request => {
      if (new URL(request.url()).pathname.startsWith("/api/stocks/")) requests.push(request.url());
    });
    await lookup.getByLabel(field, { exact: true }).fill(value);
    await lookup.getByLabel(field, { exact: true }).press("Enter");
    await expect(page.locator(".chart-identity")).toContainText(ticker);
    await expect(page.locator(".chart-identity")).toContainText(name);
    await expect(lookup.getByLabel("종목이름", { exact: true })).toHaveValue(name);
    await expect(lookup.getByLabel("종목코드", { exact: true })).toHaveValue(ticker);
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0]).pathname).toBe(`/api/stocks/${ticker}`);
  });
}

test("영문·숫자 종목코드도 Enter로 대소문자와 관계없이 조회한다", async ({ page }) => {
  await mockStockData(page);
  await page.route("**/api/stock-info", route => route.fulfill({ json: { count: 1, result: {
    "00AB12": { name: "영문코드 종목", ma20_up: false, bojong_profit_rate: 0, trading_value: 1,
      _5d_avg_trading_value: 1, ibdrs: 1, n_top_acc: 0 },
  } } }));
  const lookup = await enter(page);
  await lookup.getByLabel("종목코드", { exact: true }).fill("00ab12");
  const request = page.waitForRequest("**/api/stocks/00AB12");
  await lookup.getByLabel("종목코드", { exact: true }).press("Enter");
  await request;
  await expect(page.locator(".chart-identity")).toContainText("00AB12");
  await expect(lookup.getByLabel("종목이름", { exact: true })).toHaveValue("영문코드 종목");
});

test("조회할 수 없는 입력의 Enter도 차트보기와 같은 오류를 표시한다", async ({ page }) => {
  await mockStockData(page);
  const lookup = await enter(page);
  const requests = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/api/stocks/")) requests.push(request.url());
  });
  await lookup.getByLabel("종목코드", { exact: true }).fill("999999");
  await lookup.getByLabel("종목코드", { exact: true }).press("Enter");
  const message = page.getByLabel("종목 및 저장 검색").getByRole("status");
  await expect(message).toHaveText("종목명 또는 영문·숫자 6자리 종목코드를 확인해 주세요.");
  await lookup.getByRole("button", { name: "차트보기", exact: true }).click();
  await expect(message).toHaveText("종목명 또는 영문·숫자 6자리 종목코드를 확인해 주세요.");
  await expect(page.locator(".chart-identity")).toContainText("005930");
  expect(requests).toEqual([]);
});

test("한글 조합 확정 Enter는 조회하지 않고 다음 Enter로 조회한다", async ({ page }) => {
  await mockStockData(page);
  const lookup = await enter(page);
  const input = lookup.getByLabel("종목이름", { exact: true });
  await input.fill("SK하이닉스");
  const requests = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/api/stocks/")) requests.push(request.url());
  });
  for (const composition of [{ isComposing: true, keyCode: 13 }, { isComposing: false, keyCode: 229 }]) {
    const cancelled = await input.evaluate((element, composition) => !element.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter", code: "Enter", bubbles: true, cancelable: true, ...composition,
    })), composition);
    expect(cancelled).toBe(true);
  }
  await expect(page.locator(".chart-identity")).toContainText("005930");
  expect(requests).toEqual([]);
  await input.press("Enter");
  await expect(page.locator(".chart-identity")).toContainText("000660");
  expect(requests).toHaveLength(1);
});
