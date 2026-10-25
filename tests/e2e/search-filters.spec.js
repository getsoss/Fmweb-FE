const { expect, test } = require("@playwright/test");
const { mockStockData } = require("./helpers/stock-data");

const filters = [
  { issue: 15, title: "필터: 순이익률 1% 이상", key: "net_profit_margin", options: [["무관", 0], ["최근 결산 기준", 1], ["3년 평균 기준", 2]] },
  { issue: 16, title: "필터: 이번 달 배당 예정 종목", key: "dividend", options: [["무관", 0], ["배제", 1]] },
  { issue: 17, title: "필터: 5일 평균 거래대금", key: "filter_5davgtrdvalue", options: [["무관", 0], ["10억 이하", -1000], ["10억 이상", 1000], ["50억 이상", 5000], ["100억 이상", 10000], ["500억 이상", 50000]] },
  { issue: 18, title: "필터: RS", key: "filter_rs", options: [["무관", 0], ["100% 이하", -100], ["100% 이상", 100]] },
];
const defaults = { net_profit_margin: 0, dividend: 0, filter_5davgtrdvalue: 0, filter_rs: 0 };
const selected = { net_profit_margin: 2, dividend: 1, filter_5davgtrdvalue: -1000, filter_rs: -100 };
const group = (settings, title) => settings.getByRole("group", { name: title, exact: true });

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

const run = (page, settings) => search(page, () => settings.locator(".builder-actions").getByRole("button", { name: "임시 검색", exact: true }).click());

async function expectSelections(settings, values) {
  for (const filter of filters) {
    const label = filter.options.find(([, value]) => value === values[filter.key])[0];
    await expect(group(settings, filter.title).getByRole("radio", { name: label, exact: true })).toBeChecked();
    await expect(group(settings, filter.title).locator("input:checked")).toHaveCount(1);
  }
}

async function selectFilters(settings, values) {
  for (const filter of filters) {
    const label = filter.options.find(([, value]) => value === values[filter.key])[0];
    await group(settings, filter.title).getByRole("radio", { name: label, exact: true }).check();
  }
}

for (const filter of filters) {
  test(`#${filter.issue} ${filter.title}의 모든 선택값을 독립적인 정수 필드로 보낸다`, async ({ page }) => {
    const settings = await openSettings(page);
    const control = group(settings, filter.title);
    expect(await control.locator("label span").allTextContents()).toEqual(filter.options.map(([label]) => label));
    await expect(control.getByRole("radio")).toHaveCount(filter.options.length);
    await expect(control.getByRole("checkbox")).toHaveCount(0);
    await expectSelections(settings, defaults);
    expect(await run(page, settings)).toMatchObject({ ...defaults, price_correction: 0 });
    await group(settings, "기간 설정 *").getByRole("radio", { name: "3달", exact: true }).check();
    await group(settings, "최종 검색 결과 최대치 *").getByRole("radio", { name: "상위 300", exact: true }).check();
    await group(settings, "개별 검색결과 허용 종목수 *").getByRole("radio", { name: "상위 400", exact: true }).check();
    await group(settings, "RS 증감").getByRole("radio", { name: "상승", exact: true }).check();
    await group(settings, "최근 5일 평균 거래대금").getByRole("radio", { name: "50억 이상", exact: true }).check();
    await group(settings, "필터: 주가조정").getByRole("radio", { name: "2주", exact: true }).check();
    for (const [label, value] of filter.options) {
      await control.getByRole("radio", { name: label, exact: true }).check();
      await expectSelections(settings, { ...defaults, [filter.key]: value });
      expect(await run(page, settings)).toMatchObject({
        ...defaults, [filter.key]: value, time: 60, result_max: 300, each_result_max: 400,
        rs: 1, recent_five_days_average_trading_value: ">=5b", price_correction: 10, result_sort: 0,
      });
    }
    await group(settings, "기간 설정 *").getByRole("radio", { name: "1주", exact: true }).check();
    const lastValue = filter.options.at(-1)[1];
    await expectSelections(settings, { ...defaults, [filter.key]: lastValue });
    expect(await run(page, settings)).toMatchObject({ time: 5, [filter.key]: lastValue });
  });
}

test("신규 필터 4개를 함께 저장하고 패널 재열기·새로고침·초기화·삭제 후 일관되게 복원한다", async ({ page }, testInfo) => {
  const saved = [];
  const settings = await openSettings(page, saved);
  await page.route("**/api/conditional-search*", route => {
    if (route.request().method() === "PUT") {
      const value = route.request().postDataJSON();
      saved.splice(0, saved.length, value);
      return route.fulfill({ json: { slot: value.slot, last_updated: 1789531886 } });
    }
    if (route.request().method() === "DELETE") { saved.splice(0); return route.fulfill({ status: 204 }); }
    return route.fallback();
  });
  expect((await settings.locator("fieldset > legend").allTextContents()).slice(-5)).toEqual([
    "필터: 주가조정", "필터: 5일 평균 거래대금", "필터: RS", "필터: 순이익률 1% 이상", "필터: 이번 달 배당 예정 종목",
  ]);
  await settings.locator(".preset-slots").getByRole("button", { name: /^검색 1/ }).click();
  await settings.getByLabel("검색 제목").fill("신규 필터 조합");
  await selectFilters(settings, selected);
  await group(settings, "기간 설정 *").getByRole("radio", { name: "3달", exact: true }).check();
  await group(settings, "필터: 주가조정").getByRole("radio", { name: "2주", exact: true }).check();
  await expectSelections(settings, selected);
  const write = page.waitForRequest(request => request.url().includes("/api/conditional-search") && request.method() === "PUT");
  await settings.getByRole("button", { name: "검색조건 저장", exact: true }).click();
  expect((await write).postDataJSON()).toMatchObject({ slot: 0, title: "신규 필터 조합", condition: { ...selected, price_correction: 10, time: 60 } });
  await expect(page.locator(".search-api-message")).toContainText("조건을 저장했습니다");
  await page.getByRole("button", { name: "검색조건 접기", exact: true }).click();
  await page.getByRole("button", { name: "검색조건 만들기", exact: true }).click();
  await expectSelections(settings, selected);
  await page.reload();
  await enterSettings(page);
  const quick = page.getByLabel("종목 및 저장 검색").getByRole("button", { name: "검색1", exact: true });
  expect(await search(page, () => quick.click())).toMatchObject({ ...selected, price_correction: 10, time: 60 });
  await expectSelections(settings, selected);
  for (const text of ["5일 평균 거래대금 10억 이하", "RS 필터 100% 이하", "순이익률 1% 이상 3년 평균 기준", "이번 달 배당 예정 종목 배제"]) {
    await expect(page.locator(".preset-description")).toContainText(text);
  }
  await group(settings, "필터: 이번 달 배당 예정 종목").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("search-filters-desktop.png") });
  await page.setViewportSize({ width: 1100, height: 720 });
  for (const filter of filters) {
    const box = await group(settings, filter.title).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1101);
  }
  await group(settings, "필터: 이번 달 배당 예정 종목").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("search-filters-narrow.png") });
  await settings.locator(".preset-slots").getByRole("button", { name: /^검색 2/ }).click();
  await expectSelections(settings, defaults);
  await settings.locator(".preset-slots").getByRole("button", { name: /신규 필터 조합/ }).click();
  await expectSelections(settings, selected);
  await settings.getByRole("button", { name: "초기화", exact: true }).click();
  await expectSelections(settings, defaults);
  expect(await run(page, settings)).toMatchObject({ ...defaults, price_correction: 0, time: 5 });
  await settings.locator(".preset-slots").getByRole("button", { name: /신규 필터 조합/ }).click();
  await expectSelections(settings, selected);
  await settings.getByRole("button", { name: "저장조건 삭제", exact: true }).click();
  await expectSelections(settings, defaults);
  await page.reload();
  await enterSettings(page);
  await settings.locator(".preset-slots").getByRole("button", { name: /^검색 1/ }).click();
  await expectSelections(settings, defaults);
});

test("5개 저장 슬롯의 유효한 필터값을 독립적으로 복원해 빠른 검색에 반영한다", async ({ page }) => {
  const combinations = [
    { net_profit_margin: 1, dividend: 1, filter_5davgtrdvalue: -1000, filter_rs: -100 },
    { net_profit_margin: 2, dividend: 0, filter_5davgtrdvalue: 1000, filter_rs: 100 },
    { net_profit_margin: 0, dividend: 1, filter_5davgtrdvalue: 5000, filter_rs: 0 },
    { net_profit_margin: 1, dividend: 0, filter_5davgtrdvalue: 10000, filter_rs: -100 },
    { net_profit_margin: 2, dividend: 1, filter_5davgtrdvalue: 50000, filter_rs: 100 },
  ];
  const saved = combinations.map((values, slot) => ({ slot, title: `조합 ${slot + 1}`, condition: { ...values, time: 60, rs: 2, recent_five_days_average_trading_value: ">=10b", price_correction: 3 } }));
  const settings = await openSettings(page, saved);
  for (const [index, values] of combinations.entries()) {
    const condition = await search(page, () => page.getByLabel("종목 및 저장 검색").getByRole("button", { name: `검색${index + 1}`, exact: true }).click());
    expect(condition).toMatchObject({ ...values, time: 60, rs: 2, recent_five_days_average_trading_value: ">=10b", price_correction: 3 });
    await expectSelections(settings, values);
    await expect(group(settings, "RS 증감").getByRole("radio", { name: "하락", exact: true })).toBeChecked();
    await expect(group(settings, "최근 5일 평균 거래대금").getByRole("radio", { name: "100억 이상", exact: true })).toBeChecked();
  }
});

test("새 필드가 없는 기존 조건과 잘못된 타입·범위는 네 필터 모두 무관으로 복원한다", async ({ page }) => {
  const conditions = [
    {},
    { net_profit_margin: 99, dividend: -1, filter_5davgtrdvalue: -5000, filter_rs: -99 },
    { net_profit_margin: "2", dividend: "1", filter_5davgtrdvalue: "-1000", filter_rs: "-100" },
    { net_profit_margin: null, dividend: null, filter_5davgtrdvalue: null, filter_rs: null },
    { net_profit_margin: 1.5, dividend: 0.5, filter_5davgtrdvalue: 1000.5, filter_rs: 100.5 },
  ];
  const saved = conditions.map((condition, slot) => ({ slot, title: `기존 조건 ${slot + 1}`, condition: { ...condition, time: 10, price_correction: 5, rs: 1 } }));
  const settings = await openSettings(page, saved);
  for (let index = 0; index < saved.length; index++) {
    expect(await search(page, () => page.getByLabel("종목 및 저장 검색").getByRole("button", { name: `검색${index + 1}`, exact: true }).click())).toMatchObject({
      ...defaults, time: 10, price_correction: 5, rs: 1,
    });
    await expectSelections(settings, defaults);
  }
});
