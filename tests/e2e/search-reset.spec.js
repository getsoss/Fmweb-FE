const { expect, test } = require("@playwright/test");
const { mockStockData } = require("./helpers/stock-data");

async function openSettings(page, savedSearches = []) {
  const searches = [];
  await mockStockData(page, savedSearches);
  page.on("request", request => {
    if (new URL(request.url()).pathname === "/api/conditional-search" && request.method() === "POST") searches.push(request.postDataJSON());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "세력모니터 창으로 가기" }).click();
  await page.getByRole("button", { name: "검색조건 만들기" }).click();
  return { settings: page.getByLabel("검색 설정창"), searches };
}

const nestedGroups = ["개미 분석 필터", "보유비중 증감", "영향력", "세부 특이 거래량"];

async function expectEmptySubconditions(settings) {
  for (const title of nestedGroups) {
    const group = settings.getByRole("group", { name: title, exact: true });
    const use = group.getByRole("checkbox", { name: "사용", exact: true });
    await expect(use).not.toBeChecked();
    await use.check();
    await expect(group.locator('input[type="checkbox"]:checked')).toHaveCount(1);
  }
  const detail = settings.getByRole("group", { name: "세부 특이 거래량", exact: true });
  await expect(detail.getByRole("radio", { name: "무관", exact: true })).toBeChecked();
}

async function runSearch(page, settings) {
  const request = page.waitForRequest(request => request.url().includes("/api/conditional-search") && request.method() === "POST");
  await settings.locator(".builder-actions").getByRole("button", { name: "임시 검색", exact: true }).click();
  return (await request).postDataJSON();
}

function expectEmptyPayload(condition, disabled) {
  for (const key of ["ant_analysis_filter", "have", "power"]) {
    expect(condition[key].disabled).toBe(disabled);
    expect(Object.entries(condition[key]).filter(([name]) => name !== "disabled").every(([, value]) => value === 0)).toBe(true);
  }
  expect(Object.values(condition.specific_special_volume).every(value => value === 0)).toBe(true);
}

test("초기화는 부모 필터에 가려진 개미분석·보유비중·영향력·특이거래량 선택을 지운다", async ({ page }) => {
  const { settings } = await openSettings(page);
  const selections = ["주가 증가", "외국인 감소", "기관계 매수력", "외국인"];
  for (const [index, title] of nestedGroups.entries()) {
    const group = settings.getByRole("group", { name: title, exact: true });
    const use = group.getByRole("checkbox", { name: "사용", exact: true });
    await use.check();
    await group.getByRole("checkbox", { name: selections[index], exact: true }).check();
    if (title === "세부 특이 거래량") await group.getByRole("radio", { name: "6개월", exact: true }).check();
    await use.uncheck();
  }
  await settings.getByLabel("검색 제목").fill("초기화할 임시 조건");
  await settings.getByRole("button", { name: "초기화", exact: true }).click();
  await expect(settings.getByLabel("검색 제목")).toHaveValue("");
  expectEmptyPayload(await runSearch(page, settings), 1);
  await expectEmptySubconditions(settings);
  expectEmptyPayload(await runSearch(page, settings), 0);
});

test("저장 검색을 초기화하면 모든 하위 선택이 비워지고 원본 저장 조건은 보존된다", async ({ page }) => {
  const saved = { slot: 0, title: "보존할 저장 검색", condition: {
    time: 60, result_max: 300, each_result_max: 400,
    ant_analysis_filter: { disabled: 0, price: 2, n_top_account: 1 },
    have: { disabled: 0, foreigner: 1, organization: 2 },
    power: { disabled: 0, pension: 2 },
    specific_special_volume: { time: 240, privatefund: 1 },
    moving_average2: 31,
  } };
  const { settings, searches } = await openSettings(page, [saved]);
  const savedSlot = settings.locator(".preset-slots").getByRole("button", { name: /보존할 저장 검색/ });
  await savedSlot.click();
  await expect(settings.getByRole("checkbox", { name: "주가 감소", exact: true })).toBeChecked();
  await expect(settings.getByRole("checkbox", { name: "외국인 증가", exact: true })).toBeChecked();
  await expect(settings.getByRole("checkbox", { name: "연기금등 매도력", exact: true })).toBeChecked();
  await settings.getByRole("button", { name: "초기화", exact: true }).click();
  await expect(settings.getByRole("heading", { name: "새 검색 만들기" })).toBeVisible();
  await expect(settings.getByLabel("검색 제목")).toHaveValue("");
  await expect(settings.getByRole("group", { name: "이동평균선", exact: true }).locator("input:checked")).toHaveCount(0);
  const condition = await runSearch(page, settings);
  expect(condition).toMatchObject({ time: 5, result_max: 20, each_result_max: 100, moving_average2: 0 });
  expectEmptyPayload(condition, 1);
  await expectEmptySubconditions(settings);
  expectEmptyPayload(await runSearch(page, settings), 0);
  await savedSlot.click();
  await expect(settings.getByRole("checkbox", { name: "주가 감소", exact: true })).toBeChecked();
  await expect(settings.getByRole("checkbox", { name: "외국인 증가", exact: true })).toBeChecked();
  await expect(settings.getByLabel("검색 제목")).toHaveValue(saved.title);
  expect(searches).toHaveLength(2);
});
