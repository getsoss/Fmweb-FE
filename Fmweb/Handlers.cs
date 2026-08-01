using Microsoft.AspNetCore.Http;
using Newtonsoft.Json.Linq;
using System.Linq;
using System.Text.RegularExpressions;

namespace Fmweb
{
    internal class Handlers
    {
        private readonly Regex _tickerRegex = new Regex("^[A-Za-z0-9]{6}$");
        private readonly SQLiteConnection3 _conn = new SQLiteConnection3();

        public IResult modified_candles(string ticker)
        {
            JObject jo = new JObject();
            bool isMatch = _tickerRegex.IsMatch(ticker);

            if (!isMatch)
            {
                jo["errno"] = 1;
                return Results.Content(jo.ToString(Newtonsoft.Json.Formatting.None), "application/json");
            }

            if (!_conn.GetAllTickers().Contains(ticker))
            {
                jo["errno"] = 1;
                return Results.Content(jo.ToString(Newtonsoft.Json.Formatting.None), "application/json");
            }

            var modifiedCandles = _conn.GetModifiedCandles(ticker);
            jo["errno"] = 0;
            jo["result"] = JArray.FromObject(modifiedCandles.Select(x => (object[])x));

            return Results.Content(jo.ToString(Newtonsoft.Json.Formatting.None), "application/json");
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

            return Results.Content(jo.ToString(Newtonsoft.Json.Formatting.None), "application/json");
        }

        public IResult bojong(string ticker)
        {
            var jo = new JObject();
            bool isMatch = _tickerRegex.IsMatch(ticker);

            if (!isMatch)
            {
                jo["errno"] = 1;
                return Results.Content(jo.ToString(Newtonsoft.Json.Formatting.None), "application/json");
            }

            if (!_conn.GetAllTickers().Contains(ticker))
            {
                jo["errno"] = 1;
                return Results.Content(jo.ToString(Newtonsoft.Json.Formatting.None), "application/json");
            }

            var bojongRows = _conn.ReadAllBojongRows(ticker);
            jo["errno"] = 0;
            jo["result"] = JArray.FromObject(bojongRows.Select(x => (object[])x));
            return Results.Content(jo.ToString(Newtonsoft.Json.Formatting.None), "application/json");
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

            return Results.Content(jo.ToString(Newtonsoft.Json.Formatting.None), "application/json");
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

            return Results.Content(jo.ToString(Newtonsoft.Json.Formatting.None), "application/json");
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

            return Results.Content(jo.ToString(Newtonsoft.Json.Formatting.None), "application/json");
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

            return Results.Content(jo.ToString(Newtonsoft.Json.Formatting.None), "application/json");
        }

        //public IResult rs(string ticker)
        //{
            
        //}

    }

}

