const { expect, test } = require("@playwright/test");
const { mockStockData } = require("./helpers/stock-data");

const key = "forcemonitor:recent-stocks";
const history = page => page.getByRole("listbox", { name: "최근 조회 종목" });
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);

async function enter(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await expect(page.locator(".chart-identity")).toContainText("005930");
  return page.getByRole("form", { name: "종목 조회", exact: true });
}

test("실제 조회한 종목을 로컬에 저장하고 빈 이름 입력창의 포커스에서만 최근기록을 복원한다", async ({ page, browser }) => {
  await mockStockData(page);
  const lookup = await enter(page);
  const input = lookup.getByLabel("종목이름", { exact: true });
  await input.fill("");
  await expect(history(page)).toHaveCount(0);
  await input.fill("없는종목");
  await input.press("Enter");
  expect(await stored(page)).toBeNull();
  await input.fill("SK하이닉스");
  await input.press("Enter");
  await expect(page.locator(".chart-identity")).toContainText("000660");
  expect(await stored(page)).toEqual(["000660"]);
  await lookup.getByLabel("종목코드", { exact: true }).fill("005930");
  await lookup.getByRole("button", { name: "차트보기" }).click();
  await expect(page.locator(".chart-identity")).toContainText("005930");
  expect(await stored(page)).toEqual(["005930", "000660"]);
  await input.fill("");
  await expect(history(page).getByRole("option")).toHaveText(["삼성전자005930", "SK하이닉스000660"]);
  await input.press("Enter");
  await expect(page.locator(".search-api-message")).toContainText("종목명 또는");
  expect(await stored(page)).toEqual(["005930", "000660"]);
  await input.blur();
  await expect(history(page)).toHaveCount(0);
  await input.focus();
  await expect(history(page)).toBeVisible();
  await input.fill("삼성");
  await expect(history(page)).toHaveCount(0);
  await expect(page.getByRole("listbox", { name: "종목 자동완성" })).toBeVisible();
  await input.fill("");
  await input.press("Escape");
  await expect(history(page)).toHaveCount(0);
  await input.press("ArrowUp");
  await expect(history(page).getByRole("option").last()).toHaveAttribute("aria-selected", "true");
  await input.press("Enter");
  await expect(page.locator(".chart-identity")).toContainText("000660");
  expect(await stored(page)).toEqual(["000660", "005930"]);

  await page.reload();
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await input.fill("");
  await expect(history(page).getByRole("option")).toHaveText(["SK하이닉스000660", "삼성전자005930"]);
  await history(page).getByRole("option", { name: /삼성전자/ }).click();
  await expect(page.locator(".chart-identity")).toContainText("005930");
  expect(await stored(page)).toEqual(["005930", "000660"]);
  await expect(history(page)).toHaveCount(0);

  const separate = await browser.newContext();
  try {
    const other = await separate.newPage();
    await mockStockData(other);
    await enter(other);
    await other.getByLabel("종목이름", { exact: true }).fill("");
    await expect(history(other)).toHaveCount(0);
    expect(await stored(other)).toBeNull();
  } finally { await separate.close(); }
});

test("최근 10종목만 유지하고 중복 조회는 맨 위로 이동하며 잘못된 입력은 저장하지 않는다", async ({ page }) => {
  await mockStockData(page);
  const result = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(100000 + i), { name: `기록종목${i}` }]));
  result["005930"] = { name: "삼성전자" };
  await page.route("**/api/stock-info", route => route.fulfill({ json: { result } }));
  const lookup = await enter(page);
  const code = lookup.getByLabel("종목코드", { exact: true });
  for (let i = 0; i < 12; i++) {
    await code.fill(String(100000 + i));
    await code.press("Enter");
    await expect(page.locator(".chart-identity")).toContainText(String(100000 + i));
  }
  const latest = Array.from({ length: 10 }, (_, i) => String(100011 - i));
  expect(await stored(page)).toEqual(latest);
  await code.fill("100004");
  await code.press("Enter");
  const reordered = ["100004", ...latest.filter(code => code !== "100004")];
  expect(await stored(page)).toEqual(reordered);
  await code.fill("xxxxxx");
  await code.press("Enter");
  expect(await stored(page)).toEqual(reordered);
  await lookup.getByLabel("종목이름", { exact: true }).fill("");
  const options = history(page).getByRole("option");
  await expect(options).toHaveCount(10);
  await expect(options.first()).toHaveText("기록종목4100004");
  await expect(options.last()).toHaveText("기록종목2100002");
});

for (const value of ["broken-json", JSON.stringify({ ticker: "005930" }), JSON.stringify([null, {}, "bad", "999999", "005930", "005930", "000660"])]) {
  test(`손상되거나 오래된 로컬 기록을 안전하게 처리한다: ${value}`, async ({ page }) => {
    await mockStockData(page);
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key, value });
    const lookup = await enter(page);
    const input = lookup.getByLabel("종목이름", { exact: true });
    await input.fill("");
    if (value.startsWith("[")) await expect(history(page).getByRole("option")).toHaveText(["삼성전자005930", "SK하이닉스000660"]);
    else await expect(history(page)).toHaveCount(0);
    await input.fill("현대차");
    await input.press("Enter");
    await expect(page.locator(".chart-identity")).toContainText("005380");
    expect((await stored(page))[0]).toBe("005380");
  });
}

test("브라우저 저장소가 제한되어도 차트 조회와 현재 화면의 최근기록을 유지한다", async ({ page }) => {
  await mockStockData(page);
  await page.addInitScript(key => {
    for (const method of ["getItem", "setItem"]) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (item, ...args) {
        if (item === key) throw new DOMException("Storage blocked", "SecurityError");
        return original.call(this, item, ...args);
      };
    }
  }, key);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const lookup = await enter(page);
  const input = lookup.getByLabel("종목이름", { exact: true });
  for (const name of ["현대차", "SK하이닉스"]) {
    await input.fill(name);
    await input.press("Enter");
    await expect(input).toHaveValue(name);
  }
  await expect(page.locator(".chart-identity")).toContainText("000660");
  await input.fill("");
  await expect(history(page).getByRole("option")).toHaveText(["SK하이닉스000660", "현대차005380"]);
  expect(errors).toEqual([]);
});

test("다른 탭의 최근기록 변경과 삭제를 반영하고 새 조회 시 최신 기록에 합친다", async ({ page, context }) => {
  await mockStockData(page);
  const lookup = await enter(page);
  const input = lookup.getByLabel("종목이름", { exact: true });
  await input.fill("현대차");
  await input.press("Enter");
  await input.fill("");
  const other = await context.newPage();
  await mockStockData(other);
  await other.goto("/");
  await other.evaluate(key => localStorage.setItem(key, JSON.stringify(["005930", "005380"])), key);
  await expect(history(page).getByRole("option")).toHaveText(["삼성전자005930", "현대차005380"]);
  await input.fill("하이");
  await page.getByRole("option", { name: /SK하이닉스/ }).click();
  expect(await stored(page)).toEqual(["000660", "005930", "005380"]);
  await input.fill("");
  await other.evaluate(key => localStorage.removeItem(key), key);
  await expect(history(page)).toHaveCount(0);
  await other.close();
});
