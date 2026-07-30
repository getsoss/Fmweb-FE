using Microsoft.VisualBasic;
using Newtonsoft.Json.Linq;
using System.Collections.Generic;
using System.Data.SQLite;
using System.IO;
using System.Linq;
using System.Timers;

namespace Fmweb
{
    internal class SQLiteConnection3
    {
        public class UnmodifiedCandle
        {
            public int Date;
            public long Close;
            public long Volume;
            public long VolumeMoney;
            public long Open;
            public long High;
            public long Low;
            public long ModifyType;
            public double ModifyRatio;

            public UnmodifiedCandle(int date, long close, long volume, long volumeMoney, long open, long high, long low, long modifyType, double modifyRatio)
            {
                Date = date;
                Close = close;
                Volume = volume;
                VolumeMoney = volumeMoney;
                Open = open;
                High = high;
                Low = low;
                ModifyType = modifyType;
                ModifyRatio = modifyRatio;
            }

            public static ModifiedCandle operator *(UnmodifiedCandle a, ModifyFactor b)
            {
                return new ModifiedCandle(
                    a.Date,
                    a.Close * b.Factor,
                    a.Volume / b.Factor,
                    a.VolumeMoney,
                    a.Open * b.Factor,
                    a.High * b.Factor,
                    a.Low * b.Factor);

            }

        }

        public class BojongRow
        {
            public int Date;
            public string Jmcode;
            public int Rank;
            public long NHaveAcc;
            public long AvgPrice;
            public double ProfitRate;

            public static explicit operator object[](BojongRow x)
            {
                return new object[5] { x.Date, x.Rank, x.NHaveAcc, x.AvgPrice, x.ProfitRate };
            }
        }

        public class Jongmok
        {
            public string Jmcode;
            public string Jmname;
            public byte ReportMonth;
            public long FaceValue;
            public long Capital;
            public long ListedStock;
            public long OutstandingStock;
            public double OutstandingRatio;
            public int ListDate;
        }

        public class ModifiedCandle
        {
            public int Date;
            public double Close;
            public double Volume;
            public long VolumeMoney;
            public double Open;
            public double High;
            public double Low;

            public ModifiedCandle(int date, double close, double volume, long volumeMoney, double open, double high, double low)
            {
                Date = date;
                Close = close;
                Volume = volume;
                VolumeMoney = volumeMoney;
                Open = open;
                High = high;
                Low = low;
            }

            public static explicit operator object[](ModifiedCandle x)
            {
                return new object[7] { x.Date, x.Close, x.Volume, x.VolumeMoney, x.Open, x.High, x.Low };
            }

        }

        public class ModifyFactor
        {
            public int Date;
            public double Factor;

            public ModifyFactor(int date, double factor)
            {
                Date = date;
                Factor = factor;
            }
        }


        private const int DAY_MAX = 600;

        private readonly SQLiteConnection2 _conn;
        private readonly object _readLock = new object();

        public SQLiteConnection3()
        {
            if (!File.Exists("fmclient.db"))
            {
                throw new FileNotFoundException("File 'fmclient.db' not found.");
            }

            _conn = new SQLiteConnection2("fmclient.db");
        }

        public List<UnmodifiedCandle> GetUnmodifiedCandles(string ticker)
        {
            lock (_readLock)
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
            lock (_readLock)
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
            lock (_readLock)
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
            lock (_readLock)
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
            lock (_readLock)
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
