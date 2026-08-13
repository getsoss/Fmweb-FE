using System.Diagnostics;
using System.Reflection;

namespace DBConverter
{
    internal static class DBConverterProgram
    {
        private const bool SMALL_RUN = true; // Default is false.
        private const int PROGRESS_REPORT_INTERVAL_MS = 500; // Default is 500.
        private const bool IGNORE_COMPLETE_TABLES = true; // Default is false.


        private static readonly Random _dice = new Random();

        private static int _1d20()
        {
            return _dice.Next(1, 21);
        }

        private static void DoOpt20006(SQLiteConnection2 origin, SQLiteConnection2 target)
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

        private static void DoOpt10081(SQLiteConnection2 origin, SQLiteConnection2 target)
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
                        if(_1d20() > 1)
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


        private static void DoOpt10059(SQLiteConnection2 origin, SQLiteConnection2 target)
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


        private static void ConvertDB(SQLiteConnection2 origin, SQLiteConnection2 target)
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
                DoOpt10081(origin, target);
            }

            if (!completeTables.Contains("opt20006"))
            {
                DoOpt20006(origin, target);
            }

            if (!completeTables.Contains("opt10059"))
            {
                DoOpt10059(origin, target);
            }
        }

        private static void Main(string[] args)
        {
            try
            {
                Console.WriteLine("Build time: " + File.GetLastWriteTime(Assembly.GetExecutingAssembly().Location));

                if (args.Length != 2)
                {
                    Console.WriteLine("usage: ./DBConverter <origin file> <target file>");
                    return;
                }

                string originFile = args[0];

                if (!File.Exists(originFile))
                {
                    Console.WriteLine(originFile + " : origin file not found.");
                    return;
                }

                string targetFile = args[1];

                using (SQLiteConnection2 connOrigin = new SQLiteConnection2(originFile))
                {

                    using (SQLiteConnection2 connTarget = new SQLiteConnection2(targetFile))
                    {
                        ConvertDB(connOrigin, connTarget);
                    }
                }




            }
            catch (Exception ex)
            {
                Console.WriteLine(ex);
            }

        }

    }

}



