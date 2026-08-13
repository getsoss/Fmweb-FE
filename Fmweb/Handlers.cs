using Fmweb.Data;
using Fmweb.SQLite;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json.Linq;
using System.Linq;
using System.Text.RegularExpressions;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace Fmweb
{
    internal class Handlers
    {
        private readonly Regex _tickerRegex = new Regex("^[A-Za-z0-9]{6}$");
        private readonly SQLiteConnection4 _conn = new SQLiteConnection4();


        private static IResult ToResult(JObject jo)
        {
            return Results.Content(jo.ToString(Newtonsoft.Json.Formatting.None), "application/json");
        }

        public IResult modified_candles(string ticker)
        {
            JObject jo = new JObject();
            bool isMatch = _tickerRegex.IsMatch(ticker);

            if (!isMatch)
            {
                jo["errno"] = 1;
            }
            else if (!_conn.GetAllTickers().Contains(ticker))
            {
                jo["errno"] = 1;
            }
            else
            {
                var modifiedCandles = _conn.GetModifiedCandles(ticker);
                jo["errno"] = 0;
                jo["result"] = JArray.FromObject(modifiedCandles.Select(x => (object[])x));
            }

            return ToResult(jo);
        }

        public IResult ticker_exists(string ticker)
        {
            var jo = new JObject();

            if (_conn.GetAllTickers().Contains(ticker))
            {
                jo["result"] = true;
            }
            else
            {
                jo["result"] = false;
            }

            return ToResult(jo);
        }

        public IResult bojong(string ticker)
        {
            var jo = new JObject();
            bool isMatch = _tickerRegex.IsMatch(ticker);

            if (!isMatch)
            {
                jo["errno"] = 1;
            }

            else if (!_conn.GetAllTickers().Contains(ticker))
            {
                jo["errno"] = 1;
            }
            else
            {
                var bojongRows = _conn.GetAllBojongRowsByTicker(ticker);
                jo["errno"] = 0;
                jo["result"] = JArray.FromObject(bojongRows.Select(x => (object[])x));
            }

            return ToResult(jo);
        }


        public IResult modified_average_trade_price(string ticker)
        {
            var jo = new JObject();

            if (!_tickerRegex.IsMatch(ticker))
            {
                jo["errno"] = 1;
                
            }
            else if (!_conn.GetAllTickers().Contains(ticker))
            {
                jo["errno"] = 1;
            }
            else
            {
                jo["errno"] = 0;
                jo["result"] = JArray.FromObject(_conn.GetModifiedAverageTradePrices(ticker).Select(x=>x.ToObjects()));
            }

            return ToResult(jo);
        }


        public IResult modified_have(string ticker)
        {
            var jo = new JObject();

            if (!_tickerRegex.IsMatch(ticker))
            {
                jo["errno"] = 1;

            }
            else if (!_conn.GetAllTickers().Contains(ticker))
            {
                jo["errno"] = 1;
            }
            else
            {
                jo["errno"] = 0;
                jo["result"] = JArray.FromObject(_conn.GetModifiedHaveRows(ticker).Select(x => x.ToObjects()));
            }

            return ToResult(jo);
        }


        public IResult power(string ticker)
        {
            var jo = new JObject();

            if (!_tickerRegex.IsMatch(ticker))
            {
                jo["errno"] = 1;

            }
            else if (!_conn.GetAllTickers().Contains(ticker))
            {
                jo["errno"] = 1;
            }
            else
            {
                jo["errno"] = 0;
                jo["result"] = JArray.FromObject(_conn.GetPowerRows(ticker).Select(x => x.ToObjects()));
            }

            return ToResult(jo);
        }

        public IResult direction(string ticker)
        {
            var jo = new JObject();

            if (!_tickerRegex.IsMatch(ticker))
            {
                jo["errno"] = 1;
            }
            else if (!_conn.GetAllTickers().Contains(ticker))
            {
                jo["errno"] = 1;
            }
            else
            {
                jo["errno"] = 0;
                jo["result"] = JArray.FromObject(_conn.GetDirectionRows(ticker).Select(x => x.ToObjects()));
            }

            return ToResult(jo);
        }


        public IResult rs(string ticker)
        {
            var jo = new JObject();
            if (!_tickerRegex.IsMatch(ticker))
            {
                jo["errno"] = 1;
            }
            else if (!_conn.GetAllTickers().Contains(ticker))
            {
                jo["errno"] = 1;
            }
            else
            {
                jo["errno"] = 0;
                jo["result"] = JArray.FromObject(_conn.GetRs(ticker).Select(x=>x.ToObjects()));
            }
            return ToResult(jo);
        }


        public IResult search_by_date_and_price(int date, long price, SearchFilter filter)
        {
            var jo = new JObject();
            jo["errno"] = 0;
            jo["result"] = JArray.FromObject(_conn.SearchByDateAndPrice(date, price, filter).Select(x => x.ToObjects()));
            return ToResult(jo);
        }


        public IResult search_by_bojong_profit_rate(int date)
        {
            var jo = new JObject();

            if (!_conn.BojongExists(date))
            {
                jo["errno"] = 1;
            }
            else
            {
                jo["errno"] = 0;
                jo["result"] = JArray.FromObject(_conn.SearchByBojongProfitRate(date).Select(x => x.ToObjects()));
            }

            return ToResult(jo);
        }


        public IResult search_by_have(int datebegin, int dateend, Investor investors)
        {
            var jo = new JObject();

            try
            {
                jo["errno"] = 0;
                jo["result"] = JArray.FromObject(_conn.SearchByHave(datebegin, dateend, investors).Select(x => x.ToObjects()));
            }
            catch (DateNotFoundException ex)
            {
                jo["errno"] = 1;
                jo["errmsg"] = ex.Date + " not found";
            }

            return ToResult(jo);
        }

    }

}

