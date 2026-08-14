using System;
using System.Collections.Generic;
using System.Data.SQLite;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection.Emit;
using System.Text;

namespace DBConverter
{

    public class FMSDBV01ToFMSDBV02Converter : IDisposable
    {
        private readonly SQLiteConnection2 _conn;

        public FMSDBV01ToFMSDBV02Converter(string fileOrigin, string fileTarget)
        {
            if (!File.Exists(fileOrigin))
            {
                throw new FileNotFoundException();
            }
            if (fileOrigin == fileTarget)
            {
                throw new ArgumentException("File origin cannot be equal to file target.");
            }
            if (!File.Exists(fileTarget))
            {
                File.Copy(fileOrigin, fileTarget);
            }
            _conn = new SQLiteConnection2(fileTarget);
        }



        public void Convert()
        {
            Log2.Info("Converting FMSDBV01 into FMSDBV02...");
            _conn.CommandText = "SELECT n FROM complete_tables";
            HashSet<string> completeTables = _conn.ReadStringSet();
            Log2.Info($"complete tables: {string.Join(", ", completeTables)}");
            if (!completeTables.Contains("modifyfactor"))
            {
                CreateTableModifyfactor();
                _conn.CommandText = "INSERT INTO complete_tables(n)VALUES('modifyfactor')";
                _conn.ExecuteNonQuery();
            }
            if (!completeTables.Contains("avgtrdprc"))
            {
                CreateTableAvgtrdprc();
                _conn.CommandText = "INSERT INTO complete_tables(n)VALUES('avgtrdprc')";
                _conn.ExecuteNonQuery();
            }
        }


        private static bool IsValid(
            List<ValueTuple2<int, long[]>> opt10059Buy,
            List<ValueTuple2<int, long[]>> opt10059Sell,
            List<ValueTuple2<int, long>> closes)
        {
            if (opt10059Buy.Count == 0)
            {
                return false;
            }

            if (opt10059Sell.Count == 0)
            {
                return false;
            }

            if (closes.Count == 0)
            {
                return false;
            }

            if ((opt10059Buy.Count == opt10059Sell.Count)
                && (opt10059Sell.Count == closes.Count))
            {
            }
            else
            {
                return false;
            }

            int n = opt10059Buy.Count;

            for (int i = 0; i < n; i++)
            {
                if ((opt10059Buy[i].Item1 == opt10059Sell[i].Item1)
                    && (opt10059Sell[i].Item1 == closes[i].Item1))
                {
                }
                else
                {
                    return false;
                }
            }

            return true;
        }

        private static long SafeDiv(long num, long denom)
        {
            if (denom == 0)
            {
                return 0;
            }

            return num / denom;
        }

        private const int N_INVESTOR = 13;

        private void InsertIntoAvgtrdprc(string ticker, StringBuilder sb, ref int nAppend)
        {
            // opt10059 buy
            var opt10059Buy = new List<ValueTuple2<int, long[]>>();
            _conn.CommandText = $"SELECT dat, ind,fore,org,fin, ins,inv,ofin,bank, yun,priv,nation,oco, ne FROM opt10059 WHERE (jmcode = $ticker AND buysell = 0) ORDER BY dat DESC ; ";
            _conn.AddParamWithValue("$ticker", ticker);
            using (var rdr = _conn.ExecuteReader())
            {
                while (rdr.Read())
                {
                    int dat = rdr.GetInt32(0);
                    long[] investors = new long[N_INVESTOR];
                    for (int i = 0; i < N_INVESTOR; i++)
                    {
                        investors[i] = rdr.GetInt64(i + 1);
                    }
                    opt10059Buy.Add(new ValueTuple2<int, long[]>(dat, investors));
                }
                rdr.Close();
            }
            _conn.ClearParams();

            // opt10059 sell
            var opt10059Sell = new List<ValueTuple2<int, long[]>>();
            _conn.CommandText = $"SELECT dat, ind,fore,org,fin, ins,inv,ofin,bank, yun,priv,nation,oco, ne FROM opt10059 WHERE (jmcode = $ticker AND buysell = 1) ORDER BY dat DESC ; ";
            _conn.AddParamWithValue("$ticker", ticker);
            using (var rdr = _conn.ExecuteReader())
            {
                while (rdr.Read())
                {
                    int dat = rdr.GetInt32(0);
                    long[] investors = new long[N_INVESTOR];
                    for (int i = 0; i < N_INVESTOR; i++)
                    {
                        investors[i] = rdr.GetInt64(i + 1);
                    }
                    opt10059Sell.Add(new ValueTuple2<int, long[]>(dat, investors));
                }
                rdr.Close();
            }
            _conn.ClearParams();

            // opt10081 close prices
            var closes = new List<ValueTuple2<int, long>>();
            _conn.CommandText = "SELECT d,c FROM opt10081 WHERE (j = $ticker ) ORDER BY d DESC ; ";
            _conn.AddParamWithValue("$ticker", ticker);
            using (var rdr = _conn.ExecuteReader())
            {
                while (rdr.Read())
                {
                    int d = rdr.GetInt32(0);
                    long cl = rdr.GetInt64(1);
                    closes.Add(new ValueTuple2<int, long>(d, cl));
                }
                rdr.Close();
            }
            _conn.ClearParams();

            // Validate.
            if (!IsValid(opt10059Buy, opt10059Sell, closes))
            {
                return;
            }

            // calculate avgtrdprc
            int nDate = opt10059Buy.Count;
            long[,] avgbuyprc = new long[nDate, N_INVESTOR];
            long[,] avgsellprc = new long[nDate, N_INVESTOR];
            long[] buy_money = new long[N_INVESTOR];
            long[] buy_volume = new long[N_INVESTOR];
            long[] sell_money = new long[N_INVESTOR];
            long[] sell_volume = new long[N_INVESTOR];
            for (int i = nDate - 1; i >= 0; i--)
            {
                for (int investorIdx = 0; investorIdx < N_INVESTOR; investorIdx++)
                {
                    long net_buy = Math.Abs(opt10059Buy[i].Item2[investorIdx]) - Math.Abs(opt10059Sell[i].Item2[investorIdx]);
                    long money = Math.Abs(closes[i].Item2) * net_buy;
                    if (net_buy > 0)
                    {
                        buy_volume[investorIdx] += net_buy;
                        buy_money[investorIdx] += money;
                    }
                    else
                    {
                        sell_volume[investorIdx] += net_buy;
                        sell_money[investorIdx] += money;
                    }
                    avgbuyprc[i, investorIdx] = SafeDiv(buy_money[investorIdx], buy_volume[investorIdx]);
                    avgsellprc[i, investorIdx] = SafeDiv(sell_money[investorIdx], sell_volume[investorIdx]);
                }
            }

            // adjust
            for (int i = 1; i < nDate; i++)
            {
                for (int investorIdx = 0; investorIdx < N_INVESTOR; investorIdx++)
                {
                    if (avgbuyprc[i, investorIdx] == 0)
                    {
                        avgbuyprc[i, investorIdx] = avgbuyprc[i - 1, investorIdx];
                    }

                    if (avgsellprc[i, investorIdx] == 0)
                    {
                        avgsellprc[i, investorIdx] = avgsellprc[i - 1, investorIdx];
                    }
                }
            }

            // INSERT avgbuyprc
            for (int i = 0; i < nDate; i++)
            {
                if (nAppend > 0)
                {
                    sb.Append(',');
                }
                sb.AppendFormat("('{0}',{1},{2}", ticker, opt10059Buy[i].Item1, 0);
                for (int investorIdx = 0; investorIdx < N_INVESTOR; investorIdx++)
                {
                    sb.Append("," + avgbuyprc[i, investorIdx]);
                }
                sb.Append(')');
                nAppend++;
            }

            // INSERT avgsellprc
            for (int i = 0; i < nDate; i++)
            {
                if (nAppend > 0)
                {
                    sb.Append(',');
                }
                sb.AppendFormat("('{0}',{1},{2}", ticker, opt10059Buy[i].Item1, 1);
                for (int investorIdx = 0; investorIdx < N_INVESTOR; investorIdx++)
                {
                    sb.Append("," + avgsellprc[i, investorIdx]);
                }
                sb.Append(')');
                nAppend++;
            }
        }

        private void CreateTableAvgtrdprc()
        {
            _conn.CommandText = "DROP TABLE IF EXISTS avgtrdprc";
            _conn.ExecuteNonQuery();
            _conn.CommandText = "CREATE TABLE avgtrdprc(jmcode,dat,buysell,ind,fore,org,fin,ins,inv,ofin,bank,yun,priv,nation,oco,ne,PRIMARY KEY(jmcode,dat,buysell))";
            _conn.ExecuteNonQuery();
            _conn.CommandText = "SELECT DISTINCT j FROM opt10081";
            List<string> tickers = _conn.ReadStringList();
            Stopwatch stopwatch = Stopwatch.StartNew();
            StringBuilder sb = new StringBuilder();
            sb.Append("INSERT INTO avgtrdprc(jmcode,dat,buysell,ind,fore,org,fin,ins,inv,ofin,bank,yun,priv,nation,oco,ne)VALUES");
            int nAppend = 0;
            for (int i = 0; i < tickers.Count; i++)
            {
                if (stopwatch.ElapsedMilliseconds > LegacyToFMSDBV01Converter.PROGRESS_REPORT_INTERVAL_MS)
                {
                    Log2.Info($"avgtrdprc: {i}/{tickers.Count}");
                    stopwatch.Restart();
                }
                string ticker = tickers[i];
                InsertIntoAvgtrdprc(ticker, sb, ref nAppend);
            }
            if (nAppend > 0)
            {
                _conn.CommandText = sb.ToString();
                _conn.ExecuteNonQuery();
            }
        }


        private void CreateTableModifyfactor()
        {
            _conn.CommandText = "DROP TABLE IF EXISTS modifyfactor";
            _conn.ExecuteNonQuery();
            _conn.CommandText = "CREATE TABLE modifyfactor(c,d,m,PRIMARY KEY(c,d))";
            _conn.ExecuteNonQuery();
            _conn.CommandText = "SELECT DISTINCT j FROM opt10081";
            List<string> tickers = _conn.ReadStringList();
            if(tickers.Count == 0)
            {
                return;
            }
            Stopwatch stopwatch = Stopwatch.StartNew();
            StringBuilder sb = new StringBuilder();
            sb.Append("INSERT INTO modifyfactor(c,d,m)VALUES");
            int nAppend = 0;
            for (int tickerIdx = 0; tickerIdx < tickers.Count; tickerIdx++)
            {
                string ticker = tickers[tickerIdx];
                if (stopwatch.ElapsedMilliseconds > LegacyToFMSDBV01Converter.PROGRESS_REPORT_INTERVAL_MS)
                {
                    Log2.Info($"modifyfactor: {tickerIdx}/{tickers.Count}");
                    stopwatch.Restart();
                }
                double modifyFactor = 1;
                _conn.CommandText = $"SELECT d,r FROM opt10081 WHERE j = $ticker ORDER BY d DESC ; ";
                _conn.AddParamWithValue("$ticker", ticker);
                using (SQLiteDataReader rdr = _conn.ExecuteReader())
                {
                    while (rdr.Read())
                    {
                        if (nAppend > 0)
                        {
                            sb.Append(',');
                        }
                        int d = rdr.GetInt32(0);
                        double r = rdr.GetDouble(1);
                        sb.AppendFormat("('{0}',{1},{2})", ticker, d, modifyFactor);
                        modifyFactor *= (1 + (r / 100));
                        nAppend++;
                    }
                    rdr.Close();
                }
                _conn.ClearParams();
            }
            if (nAppend > 0)
            {
                _conn.CommandText = sb.ToString();
                _conn.ExecuteNonQuery();
            }
        }


        public void Dispose()
        {
            _conn.Dispose();
        }

    }

}
