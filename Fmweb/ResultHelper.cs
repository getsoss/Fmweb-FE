using Newtonsoft.Json.Linq;

namespace Fmweb
{
    public static class ResultHelper
    {
        public static IResult FromJo(JObject jo)
        {
            return Results.Content(jo.ToString(Newtonsoft.Json.Formatting.None), "application/json");
        }

        public static IResult GetResultOfObject(object o)
        {
            return FromJo(JObject.FromObject(o));
        }
    }
}
