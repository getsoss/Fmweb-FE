using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System.Text.RegularExpressions;

namespace Fmweb
{
    public class FmController
    {
        private readonly FmService _serv;
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
                jo[ERRNO] = 1001;
                jo[RESULT] = "ticker가 정규표현식 ^[A-Za-z0-9]{6}$ 과 매치되지 않습니다.";
            }
            else
            {
                if (_serv.GetAllTickers().Contains(ticker))
                {
                    List<ModifiedCandle> modifiedCandles = _serv.GetModifiedCandles(ticker);
                    jo[ERRNO] = 0;
                    jo[RESULT] = JArray.FromObject( modifiedCandles.Select(x=>(object[])x));
                }
                else
                {
                    jo[ERRNO] = 1002;
                    jo[RESULT] = "해당 ticker가 존재하지 않습니다.";
                }
            }

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

    }
}
