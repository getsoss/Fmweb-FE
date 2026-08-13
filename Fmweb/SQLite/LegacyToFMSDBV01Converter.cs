using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;

namespace Fmweb.SQLite
{
    internal class LegacyToFMSDBV01Converter : IDisposable
    {
        private const bool SMALL_RUN = true; // Default is false.
        private const int PROGRESS_REPORT_INTERVAL_MS = 500; // Default is 500.
        private const bool IGNORE_COMPLETE_TABLES = false; // Default is false.
        private readonly Random _dice = new Random();
        private readonly SQLiteConnection2 origin;
        private readonly SQLiteConnection2 target;

        public LegacyToFMSDBV01Converter(string fileOrigin, string fileTarget)
        {
            if (!File.Exists(fileOrigin))
            {
                throw new FileNotFoundException();
            }

            if(fileOrigin == fileTarget)
            {
                throw new ArgumentException("File origin cannot be equal to file target.");
            }

            origin = new SQLiteConnection2(fileOrigin);
            target = new SQLiteConnection2(fileTarget);
        }

        private int _1d20()
        {
            return _dice.Next(1, 21);
        }

        private void DoOpt20006()
        {
            target.CommandText = "DROP TABLE IF EXISTS opt20006 ; ";
            target.ExecuteNonQuery();
            target.CommandText = "CREATE TABLE opt20006 ( d, p, c, v, u, o, h, l, PRIMARY KEY (d, p) ) ;";
            target.ExecuteNonQuery();
            target.ExecuteAtomicTransaction(() =>
            {
                foreach (var upcode in new string[2] { "001", "101" })
                {
                    origin.CommandText = $"SELECT 일자, 현재가, 거래량, 거래대금, 시가, 고가, 저가 FROM opt20006_{upcode} ; ";
                    using (var rdr = origin.ExecuteReader())
                    {
                        while (rdr.Read())
                        {
                            int d = rdr.GetInt32(0);
                            string p = upcode;
                            long c = rdr.GetInt64(1);
                            long v = rdr.GetInt64(2);
                            long u = rdr.GetInt64(3);
                            long o = rdr.GetInt64(4);
                            long h = rdr.GetInt64(5);
                            long l = rdr.GetInt64(6);
                            target.CommandText = $"INSERT INTO opt20006 ( d, p, c, v, u, o, h, l ) VALUES ( {d}, '{p}', {c}, {v}, {u}, {o}, {h}, {l} ) ; ";
                            target.ExecuteNonQuery();
                        }
                        rdr.Close();
                    }
                }
            });

            if (!IGNORE_COMPLETE_TABLES)
            {
                target.CommandText = "INSERT INTO complete_tables(n) VALUES ( 'opt20006' ) ; ";
                target.ExecuteNonQuery();
            }
        }

        private void DoOpt10001()
        {
            target.CommandText = "DROP TABLE IF EXISTS opt10001 ; ";
            target.ExecuteNonQuery();
            target.CommandText = "CREATE TABLE opt10001 ( cod, nam, mon, fac, cap, lis, ous, otr, lda, PRIMARY KEY ( cod ) ) ;";
            target.ExecuteNonQuery();
            target.ExecuteAtomicTransaction(() =>
            {
                origin.CommandText = $"SELECT 종목코드, 종목명, 결산월, 액면가, 자본금, 상장주식, 유통주식, 유통비율, 상장일 FROM opt10001 ; ";
                using (var rdr = origin.ExecuteReader())
                {
                    while (rdr.Read())
                    {
                        string cod = rdr.GetString(0);
                        string nam = rdr.GetString(1);
                        long mon = rdr.GetInt64(2);
                        long fac = rdr.GetInt64(3);
                        long cap = rdr.GetInt64(4);
                        long lis = rdr.GetInt64(5);
                        long ous = rdr.GetInt64(6);
                        double otr = rdr.GetDouble(7);
                        long lda = rdr.GetInt64(8);
                        target.CommandText = $"INSERT INTO opt10001 ( cod, nam, mon, fac, cap, lis, ous, otr, lda ) VALUES ( '{cod}', '{nam}', {mon}, {fac}, {cap}, {lis}, {ous}, {otr}, {lda} ) ; ";
                        target.ExecuteNonQuery();
                    }
                    rdr.Close();
                }
            });

            if (!IGNORE_COMPLETE_TABLES)
            {
                target.CommandText = "INSERT INTO complete_tables(n) VALUES ( 'opt10001' ) ; ";
                target.ExecuteNonQuery();
            }
        }

        private void DoMarket()
        {
            target.CommandText = "DROP TABLE IF EXISTS market ; ";
            target.ExecuteNonQuery();
            target.CommandText = "CREATE TABLE market( c PRIMARY KEY , m ) ;";
            target.ExecuteNonQuery();
            target.ExecuteAtomicTransaction(() =>
            {
                origin.CommandText = $"SELECT 종목코드, 시장 FROM kospidaq ; ";
                using (var rdr = origin.ExecuteReader())
                {
                    while (rdr.Read())
                    {
                        string c = rdr.GetString(0);
                        int m = rdr.GetInt32(1);
                        target.CommandText = $"INSERT INTO market ( c,m ) VALUES ( '{c}', {m} ) ; ";
                        target.ExecuteNonQuery();
                    }
                    rdr.Close();
                }
            });

            if (!IGNORE_COMPLETE_TABLES)
            {
                target.CommandText = "INSERT INTO complete_tables(n) VALUES ( 'market' ) ; ";
                target.ExecuteNonQuery();
            }
        }

        private void DoOpt10081()
        {
            target.CommandText = "DROP TABLE IF EXISTS opt10081 ; ";
            target.ExecuteNonQuery();
            target.CommandText = "CREATE TABLE opt10081 ( d, j, c, v, u, o, h, l, m, r, PRIMARY KEY (d, j) ) ;";
            target.ExecuteNonQuery();

            origin.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table' AND name like 'opt10081_%';";
            var opt10081Tables = new HashSet<string>();
            using (var rdr = origin.ExecuteReader())
            {
                while (rdr.Read())
                {
                    string s = rdr.GetString(0);
                    opt10081Tables.Add(s);
                }
                rdr.Close();
            }

            Stopwatch stopwatch = Stopwatch.StartNew();

            target.ExecuteAtomicTransaction(() =>
            {
                int i = 0;

                foreach (var opt10081Table in opt10081Tables)
                {
                    i++;

                    if (SMALL_RUN)
                    {
                        if (_1d20() > 1)
                        {
                            continue;
                        }
                    }

                    if (stopwatch.ElapsedMilliseconds > PROGRESS_REPORT_INTERVAL_MS)
                    {
                        Console.WriteLine($"opt10081: {i}/{opt10081Tables.Count}");
                        stopwatch.Restart();
                    }

                    origin.CommandText = $"SELECT 일자, 현재가, 거래량, 거래대금, 시가, 고가, 저가, 수정주가구분, 수정비율 FROM {opt10081Table} ;";
                    using (var rdr = origin.ExecuteReader())
                    {
                        while (rdr.Read())
                        {
                            int d = rdr.GetInt32(0);
                            string j = opt10081Table.Substring(9);
                            long c = rdr.GetInt64(1);
                            long v = rdr.GetInt64(2);
                            long u = rdr.GetInt64(3);
                            long o = rdr.GetInt64(4);
                            long h = rdr.GetInt64(5);
                            long l = rdr.GetInt64(6);
                            long m = rdr.GetInt64(7);
                            double r = rdr.GetDouble(8);
                            target.CommandText = $"INSERT INTO opt10081( d, j, c, v, u, o, h, l, m, r ) VALUES ( {d}, '{j}', {c}, {v}, {u}, {o}, {h}, {l}, {m}, {r} ) ; ";
                            target.ExecuteNonQuery();
                        }
                    }

                }
            });

            if (!IGNORE_COMPLETE_TABLES)
            {
                target.CommandText = "INSERT INTO complete_tables(n) VALUES ( 'opt10081' ) ; ";
                target.ExecuteNonQuery();
            }
        }


        private void DoBojong()
        {
            target.CommandText = "DROP TABLE IF EXISTS bojong ; ";
            target.ExecuteNonQuery();
            target.CommandText = "CREATE TABLE bojong ( d, j, r, n, a, p, PRIMARY KEY (d, j) ) ;";
            target.ExecuteNonQuery();
            origin.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table' AND name like 'bojong_%';";
            var bojongTables = new HashSet<string>();
            using (var rdr = origin.ExecuteReader())
            {
                while (rdr.Read())
                {
                    string s = rdr.GetString(0);
                    bojongTables.Add(s);
                }
                rdr.Close();
            }
            Stopwatch stopwatch = Stopwatch.StartNew();
            target.ExecuteAtomicTransaction(() =>
            {
                int i = 0;

                foreach (var bojongTable in bojongTables)
                {
                    i++;

                    if (SMALL_RUN)
                    {
                        if (_1d20() > 1)
                        {
                            continue;
                        }
                    }

                    if (stopwatch.ElapsedMilliseconds > PROGRESS_REPORT_INTERVAL_MS)
                    {
                        Console.WriteLine($"bojong: {i}/{bojongTables.Count}");
                        stopwatch.Restart();
                    }

                    origin.CommandText = $"SELECT 종목코드, 보유순위, 보유계좌수, 보유평균매수가, 보유계좌수익률 FROM {bojongTable} ;";
                    using (var rdr = origin.ExecuteReader())
                    {
                        while (rdr.Read())
                        {
                            int d = int.Parse(bojongTable.Substring(7));
                            string j = rdr.GetString(0);
                            long r = rdr.GetInt64(1);
                            long n = rdr.GetInt64(2);
                            long a = rdr.GetInt64(3);
                            double p = rdr.GetDouble(4);
                            target.CommandText = $"INSERT INTO bojong( d, j, r, n, a, p ) VALUES ( {d}, '{j}', {r}, {n}, {a}, {p} ) ; ";
                            target.ExecuteNonQuery();
                        }
                    }

                }
            });

            if (!IGNORE_COMPLETE_TABLES)
            {
                target.CommandText = "INSERT INTO complete_tables(n) VALUES ( 'bojong' ) ; ";
                target.ExecuteNonQuery();
            }
        }


        private void DoTop()
        {
            target.CommandText = "DROP TABLE IF EXISTS top ; ";
            target.ExecuteNonQuery();
            target.CommandText = "CREATE TABLE top ( dat, jmcode, rank, buy, sell, net, nacc, qty, avg, pr, PRIMARY KEY (dat, jmcode) ) ;";
            target.ExecuteNonQuery();
            origin.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table' AND name like 'top_%';";
            var topTables = new HashSet<string>();
            using (var rdr = origin.ExecuteReader())
            {
                while (rdr.Read())
                {
                    string s = rdr.GetString(0);
                    topTables.Add(s);
                }
                rdr.Close();
            }
            Stopwatch stopwatch = Stopwatch.StartNew();
            target.ExecuteAtomicTransaction(() =>
            {
                int i = 0;

                foreach (var topTable in topTables)
                {
                    i++;

                    if (SMALL_RUN)
                    {
                        if (_1d20() > 1)
                        {
                            continue;
                        }
                    }

                    if (stopwatch.ElapsedMilliseconds > PROGRESS_REPORT_INTERVAL_MS)
                    {
                        Console.WriteLine($"top: {i}/{topTables.Count}");
                        stopwatch.Restart();
                    }

                    origin.CommandText = $"SELECT 종목코드, 상위순위, 상위매수수량, 상위매도수량, 상위순매매수량, 상위계좌수, 상위수량, 상위평균매입가, 상위수익률 FROM {topTable} ;";
                    using (var rdr = origin.ExecuteReader())
                    {
                        while (rdr.Read())
                        {
                            int dat = int.Parse(topTable.Substring(4));
                            string jmcode = rdr.GetString(0);
                            long rank = rdr.GetInt64(1);
                            long buy = rdr.GetInt64(2);
                            long sell = rdr.GetInt64(3);
                            long net = rdr.GetInt64(4);
                            long nacc = rdr.GetInt64(5);
                            long qty = rdr.GetInt64(6);
                            long avg = rdr.GetInt64(7);
                            double pr = rdr.GetDouble(8);

                            target.CommandText = $"INSERT INTO top( dat, jmcode, rank, buy, sell, net, nacc, qty, avg, pr ) VALUES ( {dat}, '{jmcode}', {rank}, {buy}, {sell}, {net}, {nacc}, {qty}, {avg}, {pr} ) ; ";
                            target.ExecuteNonQuery();
                        }
                    }

                }
            });

            if (!IGNORE_COMPLETE_TABLES)
            {
                target.CommandText = "INSERT INTO complete_tables(n) VALUES ( 'top' ) ; ";
                target.ExecuteNonQuery();
            }
        }


        private void DoOpt10059()
        {
            target.CommandText = "DROP TABLE IF EXISTS opt10059 ; ";
            target.ExecuteNonQuery();
            target.CommandText = "CREATE TABLE opt10059 ( dat, jmcode, buysell, ind, fore, org, fin, ins, inv, ofin, bank, yun, priv, nation, oco, ne, PRIMARY KEY (dat, jmcode, buysell) ) ;";
            target.ExecuteNonQuery();

            origin.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table' AND name like 'opt10059_%';";
            HashSet<string> opt10059Tables = new HashSet<string>();

            using (var rdr = origin.ExecuteReader())
            {
                while (rdr.Read())
                {
                    string s = rdr.GetString(0);
                    opt10059Tables.Add(s);
                }
                rdr.Close();
            }

            Stopwatch stopwatch = Stopwatch.StartNew();

            target.ExecuteAtomicTransaction(() =>
            {
                int i = 0;

                foreach (var opt10059Table in opt10059Tables)
                {
                    i++;

                    if (SMALL_RUN)
                    {
                        if (_1d20() > 1)
                        {
                            continue;
                        }
                    }

                    if (stopwatch.ElapsedMilliseconds > PROGRESS_REPORT_INTERVAL_MS)
                    {
                        Console.WriteLine($"opt10059: {i}/{opt10059Tables.Count}");
                        stopwatch.Restart();
                    }

                    origin.CommandText = $"SELECT 일자, 개인투자자,외국인투자자,기관계,금융투자, 보험,투신,기타금융,은행, 연기금등,사모펀드,국가,기타법인, 내외국인 FROM {opt10059Table} ;";
                    using (var rdr = origin.ExecuteReader())
                    {
                        while (rdr.Read())
                        {
                            int dat = rdr.GetInt32(0);
                            string jmcode = opt10059Table.Substring(13);
                            int buysell = (opt10059Table.Substring(9, 3) == "buy") ? 0 : 1;
                            long ind = rdr.GetInt64(1);
                            long fore = rdr.GetInt64(2);
                            long org = rdr.GetInt64(3);
                            long fin = rdr.GetInt64(4);
                            long ins = rdr.GetInt64(5);
                            long inv = rdr.GetInt64(6);
                            long ofin = rdr.GetInt64(7);
                            long bank = rdr.GetInt64(8);
                            long yun = rdr.GetInt64(9);
                            long priv = rdr.GetInt64(10);
                            long nation = rdr.GetInt64(11);
                            long oco = rdr.GetInt64(12);
                            long ne = rdr.GetInt64(13);

                            target.CommandText = $"INSERT INTO opt10059( dat, jmcode, buysell, ind, fore, org, fin, ins, inv, ofin, bank, yun, priv, nation, oco, ne ) VALUES ( {dat}, '{jmcode}', {buysell}, {ind}, {fore}, {org}, {fin}, {ins}, {inv}, {ofin}, {bank}, {yun}, {priv}, {nation}, {oco}, {ne} ) ; ";
                            target.ExecuteNonQuery();
                        }
                    }

                }
            });

            if (!IGNORE_COMPLETE_TABLES)
            {
                target.CommandText = "INSERT INTO complete_tables(n) VALUES ( 'opt10059' ) ; ";
                target.ExecuteNonQuery();
            }
        }


        public void Convert()
        {
            target.CommandText = "CREATE TABLE IF NOT EXISTS complete_tables ( n PRIMARY KEY ) ; ";
            target.ExecuteNonQuery();

            target.CommandText = "SELECT n FROM complete_tables ; ";
            HashSet<string> completeTables = new HashSet<string>();
            using (var rdr = target.ExecuteReader())
            {
                while (rdr.Read())
                {
                    completeTables.Add(rdr.GetString(0));
                }
                rdr.Close();
            }

            if (IGNORE_COMPLETE_TABLES)
            {
                completeTables.Clear();
            }

            Console.WriteLine($"complete tables: {string.Join(", ", completeTables)}");

            if (!completeTables.Contains("opt10081"))
            {
                DoOpt10081();
            }

            if (!completeTables.Contains("opt20006"))
            {
                DoOpt20006();
            }

            if (!completeTables.Contains("opt10059"))
            {
                DoOpt10059();
            }

            if (!completeTables.Contains("bojong"))
            {
                DoBojong();
            }

            if (!completeTables.Contains("top"))
            {
                DoTop();
            }

            if (!completeTables.Contains("opt10001"))
            {
                DoOpt10001();
            }

            if (!completeTables.Contains("market"))
            {
                DoMarket();
            }
        }

        public void Dispose()
        {
            origin.Dispose();
            target.Dispose();
        }

    }

}



