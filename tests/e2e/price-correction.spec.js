const { expect, test } = require("@playwright/test");
const { mockStockData } = require("./helpers/stock-data");

const options = [["무관", 0], ["3일", 3], ["1주", 5], ["2주", 10], ["3주", 15], ["4주", 20]];
const filter = settings => settings.getByRole("group", { name: "필터: 주가조정", exact: true });

async function enterSettings(page) {
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await page.getByRole("button", { name: "검색조건 만들기" }).click();
  return page.getByLabel("검색 설정창", { exact: true });
}

async function openSettings(page, saved = []) {
  await mockStockData(page, saved);
  await page.goto("/");
  return enterSettings(page);
}

async function search(page, action) {
  const request = page.waitForRequest(request => new URL(request.url()).pathname === "/api/conditional-search" && request.method() === "POST");
  await action();
  return (await request).postDataJSON();
}

test("주가조정 필터의 6개 선택값을 정수로 보내며 기간 설정과 독립적으로 유지한다", async ({ page }, testInfo) => {
  const settings = await openSettings(page);
  const correction = filter(settings);
  await expect(correction).toBeVisible();
  expect(await correction.locator("label span").allTextContents()).toEqual(options.map(([label]) => label));
  await expect(correction.getByRole("radio")).toHaveCount(6);
  await expect(correction.getByRole("checkbox")).toHaveCount(0);
  await expect(correction.getByRole("radio", { name: "무관", exact: true })).toBeChecked();
  const period = settings.getByRole("group", { name: "기간 설정 *", exact: true });
  await period.getByRole("radio", { name: "3달", exact: true }).check();
  await settings.getByRole("group", { name: "최종 검색 결과 최대치 *", exact: true }).getByRole("radio", { name: "상위 300", exact: true }).check();
  await settings.getByRole("group", { name: "개별 검색결과 허용 종목수 *", exact: true }).getByRole("radio", { name: "상위 400", exact: true }).check();
  for (const [label, value] of options) {
    await correction.getByRole("radio", { name: label, exact: true }).check();
    await expect(correction.locator("input:checked")).toHaveCount(1);
    await expect(period.getByRole("radio", { name: "3달", exact: true })).toBeChecked();
    const condition = await search(page, () => settings.locator(".temporary-search").getByRole("button", { name: "임시 검색", exact: true }).click());
    expect(condition).toMatchObject({ time: 60, result_max: 300, each_result_max: 400, price_correction: value, result_sort: 0 });
    expect(Number.isInteger(condition.price_correction)).toBe(true);
  }
  await period.getByRole("radio", { name: "1주", exact: true }).check();
  await expect(correction.getByRole("radio", { name: "4주", exact: true })).toBeChecked();
  await correction.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("price-correction.png") });
  await settings.getByRole("button", { name: "초기화", exact: true }).click();
  await expect(correction.getByRole("radio", { name: "무관", exact: true })).toBeChecked();
  const reset = await search(page, () => settings.locator(".builder-actions").getByRole("button", { name: "임시 검색", exact: true }).click());
  expect(reset).toMatchObject({ time: 5, price_correction: 0 });
});

test("저장된 각 주가조정 기간을 복원하고 빠른 검색에도 같은 값을 전달한다", async ({ page }) => {
  const saved = options.slice(1).map(([label, value], slot) => ({ slot, title: `조정 ${label}`, condition: { time: 60, price_correction: value } }));
  const settings = await openSettings(page, saved);
  for (const [index, [label, value]] of options.slice(1).entries()) {
    const condition = await search(page, () => page.getByLabel("종목 및 저장 검색").getByRole("button", { name: `검색${index + 1}`, exact: true }).click());
    expect(condition).toMatchObject({ time: 60, price_correction: value });
    await expect(filter(settings).getByRole("radio", { name: label, exact: true })).toBeChecked();
    await expect(page.locator(".preset-description")).toContainText(`주가조정 ${label}`);
  }
});

test("주가조정 선택을 조건과 함께 저장하고 새로고침·초기화·슬롯 전환·삭제 후에도 일관되게 복원한다", async ({ page }) => {
  const saved = [];
  const settings = await openSettings(page, saved);
  await page.route("**/api/conditional-search", route => {
    if (route.request().method() === "PUT") {
      const value = route.request().postDataJSON();
      saved.splice(0, saved.length, value);
      return route.fulfill({ json: { slot: value.slot, last_updated: 1789531886 } });
    }
    return route.fallback();
  });
  await settings.locator(".preset-slots").getByRole("button", { name: /^검색 1/ }).click();
  await settings.getByLabel("검색 제목").fill("2주 조정 검색");
  await filter(settings).getByRole("radio", { name: "2주", exact: true }).check();
  const write = page.waitForRequest(request => request.url().endsWith("/api/conditional-search") && request.method() === "PUT");
  await settings.getByRole("button", { name: "검색조건 저장", exact: true }).click();
  expect((await write).postDataJSON()).toMatchObject({ slot: 0, title: "2주 조정 검색", condition: { price_correction: 10 } });
  await expect(page.locator(".search-api-message")).toContainText("조건을 저장했습니다");
  await page.reload();
  await enterSettings(page);
  await settings.locator(".preset-slots").getByRole("button", { name: /2주 조정 검색/ }).click();
  await expect(filter(settings).getByRole("radio", { name: "2주", exact: true })).toBeChecked();
  const restored = await search(page, () => settings.locator(".builder-actions").getByRole("button", { name: "임시 검색", exact: true }).click());
  expect(restored.price_correction).toBe(10);
  await filter(settings).getByRole("radio", { name: "4주", exact: true }).check();
  await settings.locator(".preset-slots").getByRole("button", { name: /^검색 2/ }).click();
  await expect(filter(settings).getByRole("radio", { name: "무관", exact: true })).toBeChecked();
  await settings.locator(".preset-slots").getByRole("button", { name: /2주 조정 검색/ }).click();
  await expect(filter(settings).getByRole("radio", { name: "2주", exact: true })).toBeChecked();
  await settings.getByRole("button", { name: "초기화", exact: true }).click();
  await expect(filter(settings).getByRole("radio", { name: "무관", exact: true })).toBeChecked();
  await settings.locator(".preset-slots").getByRole("button", { name: /2주 조정 검색/ }).click();
  await expect(filter(settings).getByRole("radio", { name: "2주", exact: true })).toBeChecked();
  await settings.getByRole("button", { name: "저장조건 삭제", exact: true }).click();
  await expect(filter(settings).getByRole("radio", { name: "무관", exact: true })).toBeChecked();
});

test("새 필드가 없는 기존 저장조건과 유효하지 않은 값은 무관으로 복원한다", async ({ page }) => {
  const saved = [{}, { price_correction: 999 }, { price_correction: "10" }, { price_correction: null }]
    .map((condition, slot) => ({ slot, title: `기존 조건 ${slot + 1}`, condition: { time: 10, ...condition } }));
  const settings = await openSettings(page, saved);
  for (const item of saved) {
    const condition = await search(page, () => page.getByLabel("종목 및 저장 검색").getByRole("button", { name: `검색${item.slot + 1}`, exact: true }).click());
    expect(condition).toMatchObject({ time: 10, price_correction: 0 });
    await expect(filter(settings).getByRole("radio", { name: "무관", exact: true })).toBeChecked();
    await expect(settings.getByRole("group", { name: "기간 설정 *", exact: true }).getByRole("radio", { name: "2주", exact: true })).toBeChecked();
  }
});
