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
                    var tmp = new List<Jongmok>();
                    _conn.CommandText = "SELECT 종목코드,종목명,결산월,액면가,자본금,상장주식,유통주식,유통비율,상장일 FROM opt10001";
                    using (SQLiteDataReader rdr = _conn.ExecuteReader())
                    {
                        while (rdr.Read())
                        {
                            Jongmok row = new Jongmok();
                            row.종목코드 = rdr.GetString(0);
                            row.종목명 = rdr.GetString(1);
                            row.결산월 = rdr.GetByte(2);
                            row.액면가 = rdr.GetInt64(3);
                            row.자본금 = rdr.GetInt64(4);
                            row.상장주식 = rdr.GetInt64(5);
                            row.유통주식 = rdr.GetInt64(6);
                            row.유통비율 = rdr.GetDouble(7);
                            row.상장일 = rdr.GetInt32(8);
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
                _allTickers = ReadAllJongmoks().Select(x => x.종목코드).ToHashSet();
            }

            return _allTickers;
        }

    }

}
