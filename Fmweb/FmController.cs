using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System.Text.RegularExpressions;

namespace Fmweb
{
    public class FmController
    {
        private readonly FmService _serv;
        private static readonly Regex _sqlInjectionSafeRegex = new Regex("^[A-Za-z0-9]{6}$");
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
                jo["code"] = 1;
                jo["errmsg"] = "ticker가 정규표현식 ^[A-Za-z0-9]{6}$ 과 매치되지 않습니다.";
            }
            else
            {
                List<ModifiedCandle> modifiedCandles = _serv.GetModifiedCandles(ticker);
                jo["code"] = 0;
                jo["result"] = JArray.FromObject(modifiedCandles.Select(x=>(object[])x));
            }

            return ResultHelper.GetResultOfJObject(jo);
        }

    }
}
