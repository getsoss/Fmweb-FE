using Newtonsoft.Json.Linq;
using System.Net;
using System.Text;
using System.Data.SQLite;
using Fmweb.Data.SQLite;
using System.Text.RegularExpressions;

namespace Fmweb
{
    public static class Program
    {
        static IResult GetResult(JObject jo)
        {
            return Results.Content(jo.ToString(Newtonsoft.Json.Formatting.None), "application/json");
        }

        static IResult GetResultB(object o)
        {
            return GetResult(JObject.FromObject(o));
        }


        public static void Main(string[] args)
        {
            Console.WriteLine("begin main");
            Console.WriteLine("cw: " + Directory.GetCurrentDirectory());

            WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
            WebApplication app = builder.Build();
            using (SQLiteConnectionB conn = new SQLiteConnectionB("fmclient.db"))
            {
                Regex injectionSafeRegex = new Regex("[A-Za-z0-9]+");

                app.MapGet("/opt10081", (string ticker) =>
                {
                    if (injectionSafeRegex.IsMatch(ticker))
                    {
                        conn.CommandText = $"SELECT 일자,현재가,거래량,거래대금,시가,고가,저가,수정주가구분,수정비율 FROM opt10081_{ticker}";
                        using (SQLiteDataReader rdr = conn.ExecuteReader())
                        {
                            List<List<object>> matrix = new List<List<object>>();

                            while (rdr.Read())
                            {
                                var list = new List<object>();
                                list.Add(rdr.GetInt32(0));
                                list.Add(rdr.GetInt32(1));
                                list.Add(rdr.GetInt64(2));
                                list.Add(rdr.GetInt64(3));
                                list.Add(rdr.GetInt32(4));
                                list.Add(rdr.GetInt32(5));
                                list.Add(rdr.GetInt32(6));
                                list.Add(rdr.GetInt32(7));
                                list.Add(rdr.GetDouble(8));
                                matrix.Add(list);
                            }

                            string sJo = JArray.FromObject(matrix).ToString();
                            byte[] b = GzipHelper.Zip(sJo);
                            return b;
                        }

                    }

                    return null;

                });

                app.Run();
            }

            Console.WriteLine("end main");
        }
    }
}
