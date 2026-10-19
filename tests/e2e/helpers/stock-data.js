async function mockStockData(page, savedSearches = [], portfolio) {
  const state = portfolio ?? {
    watchlists: { "1": ["005930"], "2": ["000660"] }, limit: 50,
    alarmPrices: { "005930": 100000, "000660": 100000, "005380": 100000 },
    currentPrices: { "005930": 88000, "000660": 150000, "005380": 80000, "000020": 6000, "010140": 12680 },
  };
  await page.route("**/api/watchlist-max", route => route.fulfill({ json: { result: state.limit } }));
  await page.route("**/api/current-price", route => route.fulfill({ json: { result: state.currentPrices } }));
  await page.route("**/api/watchlist", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { result: state.watchlists } });
    const { slot, jmcodes, mode } = route.request().postDataJSON();
    const current = state.watchlists[String(slot)] ?? [];
    const next = mode === "add" ? [...new Set([...current, ...jmcodes])] : current.filter(code => !jmcodes.includes(code));
    if (mode === "add" && next.length > state.limit) return route.fulfill({ status: 409, json: { message: "최대 개수를 초과했습니다." } });
    state.watchlists[String(slot)] = next;
    return route.fulfill({ status: 200, body: "" });
  });
  await page.route("**/api/alarm-price", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { result: state.alarmPrices } });
    const { alarm_prices, mode } = route.request().postDataJSON();
    for (const [code, price] of Object.entries(alarm_prices)) {
      if (mode === "delete") delete state.alarmPrices[code];
      else state.alarmPrices[code] = price;
    }
    return route.fulfill({ status: 200, body: "" });
  });
  const user = { userId: 1, name: "테스트 사용자", email: "test@example.com", grade: "4", certYn: "Y", joinDate: "2026-01-01", loginDate: "2026-09-24", withdraw: "N" };
  await page.route("**/api/auth/me", route => route.fulfill({ json: { status: 200, user } }));
  await page.route("**/api/auth/subscription", route => route.fulfill({ json: { status: 200, subscribe: null } }));
  await page.route("**/api/auth/logout", route => route.fulfill({ json: { status: 200 } }));
  await page.route("**/api/stock-info", route => route.fulfill({ json: {
    count: 5,
    result: {
      "000020": { name: "동화약품", ma20_up: true, bojong_profit_rate: -48.95, trading_value: 241, _5d_avg_trading_value: 352.6, ibdrs: 37.73953852170512, n_top_acc: 0 },
      "005930": { name: "삼성전자", ma20_up: true, bojong_profit_rate: 1.42, trading_value: 456700, _5d_avg_trading_value: 543000, ibdrs: 99, n_top_acc: 33 },
      "000660": { name: "SK하이닉스", ma20_up: false, bojong_profit_rate: -0.31, trading_value: 345300, _5d_avg_trading_value: 363400, ibdrs: 98, n_top_acc: 27 },
      "005380": { name: "현대차", ma20_up: true, bojong_profit_rate: 2.16, trading_value: 212300, _5d_avg_trading_value: 197400, ibdrs: 97, n_top_acc: 14 },
      "010140": { name: "삼성중공업", ma20_up: true, bojong_profit_rate: 0.48, trading_value: 97800, _5d_avg_trading_value: 88400, ibdrs: 95, n_top_acc: 45 },
    },
  } }));
  await page.route("**/api/conditional-search*", route => {
    const method = route.request().method();
    if (method === "GET") return route.fulfill({ json: { result: savedSearches } });
    if (method === "DELETE") return route.fulfill({ status: 204 });
    if (method === "PUT") return route.fulfill({ json: { slot: route.request().postDataJSON().slot, last_updated: 1789531886 } });
    return route.fulfill({ json: { errno: 0, elapsed_milliseconds: 1, count: 4, result: [["005930", 99], ["000660", 98], ["005380", 97], ["010140", 95]] } });
  });
  await page.route("**/api/stocks/*", route => {
    const ticker = new URL(route.request().url()).pathname.split("/").at(-1);
    const investors = (date, base) => [date, ...Array.from({ length: 13 }, (_, index) => base + index)];
    const candles = Array.from({ length: 80 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 7, 31 - index));
      const dateValue = Number(date.toISOString().slice(0, 10).replaceAll("-", ""));
      const close = 74200 - index * 50;
      return [dateValue, close, 1200000 - index * 1000, 0, close - 700, close + 600, close - 1200];
    });
    return route.fulfill({
      json: {
        ticker,
        candles,
        holdings: [[20260831, 0, 1413177, 69800], [20260830, 0, 1400000, 69400]],
        holdingChanges: [investors(20260831, 1), investors(20260830, 0)],
        power: [investors(20260831, 2), investors(20260830, 1)],
        direction: [investors(20260831, 1), investors(20260830, -1)],
        rs: [[20260831, 94], [20260830, 92]],
      },
    });
  });
  await page.route("**/api/news?*", route => {
    const query = new URL(route.request().url()).searchParams.get("query");
    return route.fulfill({
      json: { result: [[`${query} 뉴스 제목`, "3일 전", "https://example.com/news"]] },
    });
  });
  return state;
}

module.exports = { mockStockData };
