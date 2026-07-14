using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System.Text.RegularExpressions;

namespace Fmweb
{
    public class FmController
    {
        private readonly FmService _serv;

        // Regex is always thread-safe.

        private static readonly Regex _sqlInjectionSafeRegex = new Regex("^[A-Za-z0-9]{6}$");

        private const string ERRNO = "errno";
        private const string RESULT = "result";

        public FmController()
        {
            _serv = new FmService();
        }

        public IResult GetModifiedCandles(string ticker)
        {
            JObject jo = new JObject();
            bool isMatch = _sqlInjectionSafeRegex.IsMatch(ticker);

            if (!isMatch)
            {
                jo[ERRNO] = 1;
                return ResultHelper.FromJo(jo);
            }

            if (!_serv.GetAllTickers().Contains(ticker))
            {
                jo[ERRNO] = 1;
                return ResultHelper.FromJo(jo);
            }

            List<ModifiedCandle> modifiedCandles = _serv.GetModifiedCandles(ticker);
            jo[ERRNO] = 0;
            jo[RESULT] = JArray.FromObject(modifiedCandles.Select(x => (object[])x));
            return ResultHelper.FromJo(jo);
        }

        public IResult TickerExists(string ticker)
        {
            var jo = new JObject();

            if (_serv.GetAllTickers().Contains(ticker))
            {
                jo[RESULT] = true;
            }
            else
            {
                jo[RESULT] = false;
            }

            return ResultHelper.FromJo(jo);
        }


        public IResult Bojong(string ticker)
        {
            var jo = new JObject();
            bool isMatch = _sqlInjectionSafeRegex.IsMatch(ticker);

            if (!isMatch)
            {
                jo[ERRNO] = 1;
                return ResultHelper.FromJo(jo);
            }

            if (!_serv.GetAllTickers().Contains(ticker))
            {
                jo[ERRNO] = 1;
                return ResultHelper.FromJo(jo);
            }

            var bojongRows = _serv.ReadAllBojongRows(ticker);
            jo[ERRNO] = 0;
            jo[RESULT] = JArray.FromObject(bojongRows.Select(x => (object[])x));
            return ResultHelper.FromJo(jo);
        }


    }
}
