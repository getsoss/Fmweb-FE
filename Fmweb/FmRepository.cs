using Newtonsoft.Json.Linq;
using System.Data.SQLite;
using System.Timers;

namespace Fmweb
{
    public class FmRepository
    {
        private readonly SQLiteConnection2 _conn;
        public FmRepository()
        {
            _conn = new SQLiteConnection2("fmclient.db");
        }

        public void Opt10081(string ticker)
        {
            _conn.CommandText = $"SELECT 일자,현재가,거래량,거래대금,시가,고가,저가,수정주가구분,수정비율 FROM opt10081_{ticker}";
            using (SQLiteDataReader rdr = _conn.ExecuteReader())
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
                    list.Add(rdr.GetInt64(7));
                    list.Add(rdr.GetDouble(8));
                    matrix.Add(list);
                }

                JArray jarr = JArray.FromObject(matrix);
                JObject jo = new JObject();
                jo["status"] = 200;
                jo["errmsg"] = string.Empty;
                jo["result"] = jarr;
                //return ResultHelper.GetResultOfJObject(jo);
            }
        }
    }
}
