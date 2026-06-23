using Newtonsoft.Json.Linq;

namespace Fmweb
{
    public static class ResultHelper
    {
        public static IResult GetResultOfJObject(JObject jo)
        {
            return Results.Content(jo.ToString(Newtonsoft.Json.Formatting.None), "application/json");
        }

        public static IResult GetResultOfObject(object o)
        {
            return GetResultOfJObject(JObject.FromObject(o));
        }
    }
}
