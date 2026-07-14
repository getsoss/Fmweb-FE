using Microsoft.VisualBasic;
using Newtonsoft.Json.Linq;
using System.Data.SQLite;
using System.Timers;

namespace Fmweb
{
    public class FmRepository
    {
        private const int DAY_MAX = 600;

        private readonly SQLiteConnection2 _conn;
        private readonly object _dbReadLock = new object();

        public FmRepository()
        {
            _conn = new SQLiteConnection2("fmclient.db");
        }

        public List<UnmodifiedCandle> GetUnmodifiedCandles(string ticker)
        {
            lock (_dbReadLock)
            {
                List<UnmodifiedCandle> ret = new List<UnmodifiedCandle>();

                _conn.CommandText = $"SELECT 일자,현재가,거래량,거래대금,시가,고가,저가,수정주가구분,수정비율 FROM opt10081_{ticker} ORDER BY 일자 DESC LIMIT {DAY_MAX};";
                using (SQLiteDataReader rdr = _conn.ExecuteReader())
                {
                    while (rdr.Read())
                    {
                        int date = rdr.GetInt32(0);
                        long Close = rdr.GetInt64(1);
                        long Volume = rdr.GetInt64(2);
                        long VolumeMoney = rdr.GetInt64(3);
                        long Open = rdr.GetInt64(4);
                        long High = rdr.GetInt64(5);
                        long Low = rdr.GetInt64(6);
                        long modifyType = rdr.GetInt64(7);
                        double modifyRatio = rdr.GetDouble(8);
                        ret.Add(new UnmodifiedCandle(date, Close, Volume, VolumeMoney, Open, High, Low, modifyType, modifyRatio));
                    }
                    rdr.Close();
                }

                return ret;
            }
        }

        public List<ModifyFactor> GetModifyFactors(string ticker)
        {
            lock (_dbReadLock)
            {
                List<ModifyFactor> list = new List<ModifyFactor>();

                _conn.CommandText = $"SELECT 일자,수정인수 FROM mpt10081_{ticker} ORDER BY 일자 DESC LIMIT {DAY_MAX}";
                using (SQLiteDataReader rdr = _conn.ExecuteReader())
                {
                    while (rdr.Read())
                    {
                        int date = rdr.GetInt32(0);
                        double modifyFactor = rdr.GetDouble(1);
                        list.Add(new ModifyFactor(date, modifyFactor));
                    }
                    rdr.Close();
                }

                return list;
            }
        }


        public List<ModifiedCandle> GetModifiedCandles(string ticker)
        {
            lock (_dbReadLock)
            {
                List<UnmodifiedCandle> ucs = GetUnmodifiedCandles(ticker);
                List<ModifyFactor> mfs = GetModifyFactors(ticker);
                List<ModifiedCandle> ret = new List<ModifiedCandle>();

                for (int i = 0; i < mfs.Count; i++)
                {
                    ModifiedCandle modifiedCandle = ucs[i] * mfs[i];
                    ret.Add(modifiedCandle);
                }

                return ret;
            }
        }


        private List<Jongmok> _allJongmoks;
        public List<Jongmok> ReadAllJongmoks()
        {
            lock (_dbReadLock)
            {
                if (_allJongmoks is null)
                {
                    List<Jongmok> tmp = new List<Jongmok>();
                    _conn.CommandText = "SELECT 종목코드,종목명,결산월,액면가,자본금,상장주식,유통주식,유통비율,상장일 FROM opt10001";
                    using (SQLiteDataReader rdr = _conn.ExecuteReader())
                    {
                        while (rdr.Read())
                        {
                            Jongmok row = new Jongmok();
                            row.Jmcode = rdr.GetString(0);
                            row.Jmname = rdr.GetString(1);
                            row.ReportMonth = rdr.GetByte(2);
                            row.FaceValue = rdr.GetInt64(3);
                            row.Capital = rdr.GetInt64(4);
                            row.ListedStock = rdr.GetInt64(5);
                            row.OutstandingStock = rdr.GetInt64(6);
                            row.OutstandingRatio = rdr.GetDouble(7);
                            row.ListDate = rdr.GetInt32(8);
                            tmp.Add(row);
                        }
                        rdr.Close();
                    }
                    _allJongmoks = tmp;
                }

                return _allJongmoks;
            }
        }


        private HashSet<string> _allTickers;
        public HashSet<string> GetAllTickers()
        {
            if (_allTickers is null)
            {
                _allTickers = ReadAllJongmoks().Select(x => x.Jmcode).ToHashSet();
            }

            return _allTickers;
        }


        public List<BojongRow> ReadAllBojongRows(string ticker)
        {
            lock (_dbReadLock)
            {
                List<string> allBojongTables = new List<string>();

                _conn.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table' AND name like 'bojong_%';";
                using(var rdr = _conn.ExecuteReader())
                {
                    while (rdr.Read())
                    {
                        string s = rdr.GetString(0);
                        allBojongTables.Add(s);
                    }
                    rdr.Close();
                }

                List<BojongRow> tmp = new List<BojongRow>();

                foreach (var bojongTable in allBojongTables)
                {
                    _conn.CommandText = $"SELECT 종목코드,보유순위,보유계좌수,보유평균매수가,보유계좌수익률 FROM {bojongTable} WHERE 종목코드 = $a1 ;";
                    _conn.AddParamWithValue("$a1", ticker);

                    using (SQLiteDataReader rdr = _conn.ExecuteReader())
                    {
                        while (rdr.Read())
                        {
                            BojongRow row = new BojongRow();
                            row.Jmcode = rdr.GetString(0);
                            row.Rank = rdr.GetInt32(1);
                            row.NHaveAcc = rdr.GetInt64(2);
                            row.AvgPrice = rdr.GetInt64(3);
                            row.ProfitRate = rdr.GetDouble(4);
                            row.Date = int.Parse(bojongTable.Substring(bojongTable.Length - 8));
                            tmp.Add(row);
                        }
                        rdr.Close();
                    }
                }

                tmp.Sort((a, b) =>
                {
                    return b.Date.CompareTo(a.Date);
                });



                if(tmp.Count > DAY_MAX)
                {
                    tmp.RemoveRange(DAY_MAX, tmp.Count - DAY_MAX);
                }

                return tmp;

            }

        }

    }

}
