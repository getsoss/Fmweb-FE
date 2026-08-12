using Fmweb.Data;
using Microsoft.VisualBasic;
using Microsoft.VisualBasic.FileIO;
using System;
using System.Collections.Generic;
using System.Data.SQLite;
using System.Data.SqlTypes;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection.Emit;

namespace Fmweb.SQLite
{

    internal class SQLiteConnection3
    {


        public const int DAY_MAX = 600;

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


        /// <summary>
        /// Thread-safe.
        /// </summary>
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

        /// <summary>
        /// thread safe
        /// </summary>
        internal List<MarketCandle> GetMarketCandles(Market market)
        {
            lock (_readLock)
            {
                var ret = new List<MarketCandle>();
                string upcode = (market == Market.Kospi) ? "001" : "101";
                _conn.CommandText = $"SELECT 일자,현재가,거래량,거래대금,시가,고가,저가 FROM opt20006_{upcode} ORDER BY 일자 DESC LIMIT {DAY_MAX} ; ";
                using (SQLiteDataReader rdr = _conn.ExecuteReader())
                {
                    while (rdr.Read())
                    {
                        var row = new MarketCandle()
                        {
                            Date = rdr.GetInt32(0),
                            Close = rdr.GetInt64(1),
                            Volume = rdr.GetInt64(2),
                            VolumeMoney = rdr.GetInt64(3),
                            Open = rdr.GetInt64(4),
                            High = rdr.GetInt64(5),
                            Low = rdr.GetInt64(6)
                        };
                        ret.Add(row);
                    }
                    rdr.Close();
                }
                return ret;
            }
        }




        private Dictionary<string, Market> _marketDict;
        /// <summary>
        /// Thread-safe. Cached.
        /// </summary>
        public Dictionary<string, Market> GetMarketDict()
        {
            if (!(_marketDict is null))
            {
                return _marketDict;
            }

            lock (_readLock)
            {
                var ret = new Dictionary<string, Market>();
                _conn.CommandText = $"SELECT 종목코드,시장 FROM kospidaq ; ";
                using (SQLiteDataReader rdr = _conn.ExecuteReader())
                {
                    while (rdr.Read())
                    {
                        string ticker = rdr.GetString(0);
                        long market = rdr.GetInt64(1);
                        Market market2;
                        if (market == 0)
                        {
                            market2 = Market.Kospi;
                        }
                        else
                        {
                            market2 = Market.Kosdaq;
                        }
                        ret[ticker] = market2;
                    }
                    rdr.Close();
                }
                _marketDict = ret;
            }
            return _marketDict;
        }







        /// <summary>
        /// thread safe
        /// </summary>
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





        private List<Jongmok> _allJongmoks;

        /// <summary>
        /// thread safe
        /// </summary>
        public List<Jongmok> GetAllJongmoks()
        {
            if (!(_allJongmoks is null))
            {
                return _allJongmoks;
            }

            lock (_readLock)
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

                return _allJongmoks;
            }
        }




        private HashSet<string> _allTickers;
        /// <summary>
        /// Thread-safe. Cached.
        /// </summary>
        public HashSet<string> GetAllTickers()
        {
            if (_allTickers is null)
            {
                _allTickers = GetAllJongmoks().Select(x => x.Jmcode).ToHashSet();
            }

            return _allTickers;
        }




        private List<string> _allBojongTables;

        /// <summary>
        /// Thread-safe. Cached. Table name format is "bojong_{yyyyMMdd}".
        /// </summary>
        private List<string> GetAllBojongTables()
        {
            if (!(_allBojongTables is null))
            {
                return _allBojongTables;
            }

            List<string> allBojongTables = new List<string>();
            lock (_readLock)
            {
                _conn.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table' AND name like 'bojong_%';";
                using (var rdr = _conn.ExecuteReader())
                {
                    while (rdr.Read())
                    {
                        string s = rdr.GetString(0);
                        allBojongTables.Add(s);
                    }
                    rdr.Close();
                }
            }
            _allBojongTables = allBojongTables;
            return _allBojongTables;
        }


        /// <summary>
        /// Thread-safe.
        /// </summary>
        public List<BojongRow> GetAllBojongRowsByTicker(string ticker)
        {
            lock (_readLock)
            {
                List<string> allBojongTables = GetAllBojongTables();

                List<BojongRow> ret = new List<BojongRow>();

                foreach (var bojongTable in allBojongTables)
                {
                    _conn.CommandText = $"SELECT 종목코드,보유순위,보유계좌수,보유평균매수가,보유계좌수익률 FROM {bojongTable} WHERE 종목코드 = $ticker ;";
                    _conn.AddParamWithValue("$ticker", ticker);

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
                            row.Date = int.Parse(bojongTable.Substring(bojongTable.Length - 8)); // yyyyMMdd
                            ret.Add(row);
                        }
                        rdr.Close();
                    }

                    _conn.ClearParams();
                }

                // Sort by date descending order.
                ret.Sort((a, b) =>
                {
                    return b.Date.CompareTo(a.Date);
                });

                if (ret.Count > DAY_MAX)
                {
                    ret.RemoveRange(DAY_MAX, ret.Count - DAY_MAX);
                }

                return ret;
            }
        }




        /// <summary>
        /// Thread-safe.
        /// </summary>
        /// <param name="date">8 digits. yyyyMMdd format.</param>
        public List<BojongRow> GetAllBojongRowsByDate(int date)
        {
            lock (_readLock)
            {
                List<BojongRow> ret = new List<BojongRow>();

                _conn.CommandText = $"SELECT 종목코드,보유순위,보유계좌수,보유평균매수가,보유계좌수익률 FROM bojong_{date} ; ";

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
                        row.Date = date; // yyyyMMdd
                        ret.Add(row);
                    }
                    rdr.Close();
                }

                return ret;
            }
        }




        /// <summary>
        /// Thread-safe.
        /// </summary>
        public List<ModifiedAverageTradePriceRow> GetModifiedAverageTradePrices(string ticker)
        {
            lock (_readLock)
            {
                var ret = new List<ModifiedAverageTradePriceRow>();

                _conn.CommandText = $"SELECT 일자,개인투자자B,개인투자자S,외국인투자자B,외국인투자자S,기관계B,기관계S,금융투자B,금융투자S,보험B,보험S,투신B,투신S,기타금융B,기타금융S,은행B,은행S,연기금등B,연기금등S,사모펀드B,사모펀드S,국가B,국가S,기타법인B,기타법인S,내외국인B,내외국인S FROM mvgtradeprice_{ticker} ORDER BY 일자 DESC LIMIT {DAY_MAX};";
                using (SQLiteDataReader rdr = _conn.ExecuteReader())
                {
                    while (rdr.Read())
                    {
                        var row = new ModifiedAverageTradePriceRow();
                        row.Date = rdr.GetInt32(0);
                        row.개인투자자B = rdr.GetDouble(1);
                        row.개인투자자S = rdr.GetDouble(2);
                        row.외국인투자자B = rdr.GetDouble(3);
                        row.외국인투자자S = rdr.GetDouble(4);
                        row.기관계B = rdr.GetDouble(5);
                        row.기관계S = rdr.GetDouble(6);
                        row.금융투자B = rdr.GetDouble(7);
                        row.금융투자S = rdr.GetDouble(8);
                        row.보험B = rdr.GetDouble(9);
                        row.보험S = rdr.GetDouble(10);
                        row.투신B = rdr.GetDouble(11);
                        row.투신S = rdr.GetDouble(12);
                        row.기타금융B = rdr.GetDouble(13);
                        row.기타금융S = rdr.GetDouble(14);
                        row.은행B = rdr.GetDouble(15);
                        row.은행S = rdr.GetDouble(16);
                        row.연기금등B = rdr.GetDouble(17);
                        row.연기금등S = rdr.GetDouble(18);
                        row.사모펀드B = rdr.GetDouble(19);
                        row.사모펀드S = rdr.GetDouble(20);
                        row.국가B = rdr.GetDouble(21);
                        row.국가S = rdr.GetDouble(22);
                        row.기타법인B = rdr.GetDouble(23);
                        row.기타법인S = rdr.GetDouble(24);
                        row.내외국인B = rdr.GetDouble(25);
                        row.내외국인S = rdr.GetDouble(26);
                        ret.Add(row);
                    }
                }

                return ret;
            }
        }




        /// <summary>
        /// Thread-safe.
        /// </summary>
        public List<UnmodifiedInvestRow> GetUnmodifiedInvestRows(string ticker, BuySell buySell)
        {
            lock (_readLock)
            {
                string bs = (buySell == BuySell.Buy) ? "buy" : "sel";
                string tableName = $"opt10059_{bs}_{ticker}";
                var ret = new List<UnmodifiedInvestRow>();
                _conn.CommandText = $"SELECT 일자,개인투자자,외국인투자자,기관계,금융투자,보험,투신,기타금융,은행,연기금등,사모펀드,국가,기타법인,내외국인 FROM {tableName} ORDER BY 일자 DESC LIMIT {DAY_MAX} ;";
                using (SQLiteDataReader rdr = _conn.ExecuteReader())
                {
                    while (rdr.Read())
                    {
                        var row = new UnmodifiedInvestRow();
                        row.Date = rdr.GetInt32(0);
                        row.개인투자자 = rdr.GetInt64(1);
                        row.외국인투자자 = rdr.GetInt64(2);
                        row.기관계 = rdr.GetInt64(3);
                        row.금융투자 = rdr.GetInt64(4);
                        row.보험 = rdr.GetInt64(5);
                        row.투신 = rdr.GetInt64(6);
                        row.기타금융 = rdr.GetInt64(7);
                        row.은행 = rdr.GetInt64(8);
                        row.연기금등 = rdr.GetInt64(9);
                        row.사모펀드 = rdr.GetInt64(10);
                        row.국가 = rdr.GetInt64(11);
                        row.기타법인 = rdr.GetInt64(12);
                        row.내외국인 = rdr.GetInt64(13);
                        ret.Add(row);
                    }
                    rdr.Close();
                }

                return ret;
            }
        }


        /// <summary>
        /// thread safe
        /// </summary>
        public List<ModifiedInvestRow> GetModifiedInvestRows(string ticker, BuySell buySell)
        {
            lock (_readLock)
            {
                var org = GetUnmodifiedInvestRows(ticker, buySell);
                List<ModifyFactor> modifyFactors = GetModifyFactors(ticker);
                var ret = new List<ModifiedInvestRow>();
                for (int i = 0; i < modifyFactors.Count; i++)
                {
                    ModifiedInvestRow modifiedCandle = org[i] * modifyFactors[i];
                    ret.Add(modifiedCandle);
                }
                return ret;
            }
        }



        private Dictionary<string, Jongmok> _jongmokDict;

        /// <summary>
        /// thread safe
        /// </summary>
        public Dictionary<string, Jongmok> GetJongmokDict()
        {
            if (!(_jongmokDict is null))
            {
                return _jongmokDict;
            }

            _jongmokDict = GetAllJongmoks().ToDictionary(x => x.Jmcode);
            return _jongmokDict;
        }








        /// <summary> Thread-safe. </summary>
        /// <param name="date">8 digits. yyyyMMdd format.</param>
        /// <returns> -1 if date does not exist. </returns>
        public double GetModifiedClosePrice(int date, string ticker)
        {
            double ret = -1;
            lock (_readLock)
            {
                _conn.CommandText = $"SELECT 현재가 FROM opt10081_{ticker} WHERE 일자 = {date} ;";
                using (SQLiteDataReader rdr = _conn.ExecuteReader())
                {
                    if (rdr.StepCount == 0)
                    {
                        return -1;
                    }
                    while (rdr.Read())
                    {
                        ret = Math.Abs(rdr.GetInt64(0));
                    }
                    rdr.Close();
                }
                _conn.CommandText = $"SELECT 수정인수 FROM mpt10081_{ticker} WHERE 일자 = {date} ;";
                using (SQLiteDataReader rdr = _conn.ExecuteReader())
                {
                    while (rdr.Read())
                    {
                        double modifyFactor = Math.Abs(rdr.GetDouble(0));
                        ret *= modifyFactor;
                    }
                    rdr.Close();
                }
            }
            return ret;
        }

    }

}

