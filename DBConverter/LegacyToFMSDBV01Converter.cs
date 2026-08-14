using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text;

namespace DBConverter
{
    public class LegacyToFMSDBV01Converter : IDisposable
    {
        internal const int PROGRESS_REPORT_INTERVAL_MS = 500;
        private readonly SQLiteConnection2 origin;
        private readonly SQLiteConnection2 target;
        private static readonly string[] transaction = new string[2] { "001", "101" };

        /// <summary>
        /// The number of jongmoks.
        /// </summary>
        private readonly int _njm;

        public LegacyToFMSDBV01Converter(string fileOrigin, string fileTarget, int njm = -1)
        {
            if (!File.Exists(fileOrigin))
            {
                throw new FileNotFoundException();
            }

            if (fileOrigin == fileTarget)
            {
                throw new ArgumentException("File origin cannot be equal to file target.");
            }

            origin = new SQLiteConnection2(fileOrigin);
            target = new SQLiteConnection2(fileTarget);
            _njm = njm;
        }

        private void CompleteTable(string tableName)
        {
            target.CommandText = "INSERT OR IGNORE INTO complete_tables(n)VALUES($a)";
            target.AddParamWithValue("$a", tableName);
            target.ExecuteNonQuery();
            target.ClearParams();
        }


        public void Convert()
        {
            Log2.Info("Converting legacy to FMSDBV01...");
            target.CommandText = "CREATE TABLE IF NOT EXISTS meta(k PRIMARY KEY,v)";
            target.ExecuteNonQuery();

            string nowString = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
            target.CommandText = "INSERT INTO meta(k,v) VALUES('creat',$a) ON CONFLICT DO UPDATE SET v=excluded.v";
            target.AddParamWithValue("$a", nowString);
            target.ExecuteNonQuery();
            target.ClearParams();

            target.CommandText = "CREATE TABLE IF NOT EXISTS complete_tables(n PRIMARY KEY)";
            target.ExecuteNonQuery();
            target.CommandText = "SELECT n FROM complete_tables WHERE(n IN(SELECT name FROM sqlite_master WHERE(type='table')))";
            List<string> completeTables = target.ReadStringList();
            Log2.Info($"complete tables: {string.Join(", ", completeTables)}");
            Log2.Info("begin market");
            if (!completeTables.Contains("market"))
            {
                CreateTableMarket();
                CompleteTable("market");
            }
            Log2.Info("end market");
            Log2.Info("begin bojong");
            if (!completeTables.Contains("bojong"))
            {
                CreateTableBojong();
                CompleteTable("bojong");
            }
            Log2.Info("end bojong");
            Log2.Info("begin top");
            if (!completeTables.Contains("top"))
            {
                CreateTableTop();
                CompleteTable("top");
            }
            Log2.Info("end top");
            Log2.Info("begin opt10001");
            if (!completeTables.Contains("opt10001"))
            {
                CreateTableOpt10001();
                CompleteTable("opt10001");
            }
            Log2.Info("end opt10001");
            Log2.Info("begin opt20006");
            if (!completeTables.Contains("opt20006"))
            {
                CreateTableOpt20006();
                CompleteTable("opt20006");
            }
            Log2.Info("end opt20006");
            Log2.Info("begin opt10059");
            bool canSkipOpt10059 = completeTables.Contains("opt10059");
            if (canSkipOpt10059)
            {
                if(_njm > 0)
                {
                    target.CommandText = "SELECT COUNT(DISTINCT jmcode)FROM opt10059";
                    int nJmcode = target.ReadSingleInt32();
                    if(nJmcode != _njm)
                    {
                        canSkipOpt10059 = false;
                    }
                }
            }
            if (!canSkipOpt10059)
            {
                CreateTableOpt10059();
                CompleteTable("opt10059");
            }
            Log2.Info("end opt10059");
            Log2.Info("begin opt10081");
            bool canSkipOpt10081 = completeTables.Contains("opt10081");
            if (canSkipOpt10081)
            {
                if (_njm > 0)
                {
                    target.CommandText = "SELECT COUNT(DISTINCT j)FROM opt10081";
                    int nJmcode = target.ReadSingleInt32();
                    if (nJmcode != _njm)
                    {
                        canSkipOpt10081 = false;
                    }
                }
            }
            if (!canSkipOpt10081)
            {
                CreateTableOpt10081();
                CompleteTable("opt10081");
            }
            Log2.Info("end opt10081");

            nowString = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
            target.CommandText = "INSERT INTO meta(k,v) VALUES('write',$a) ON CONFLICT DO UPDATE SET v=excluded.v";
            target.AddParamWithValue("$a", nowString);
            target.ExecuteNonQuery();
            target.ClearParams();
        }








        private void CreateTableBojong()
        {
            target.CommandText = "DROP TABLE IF EXISTS bojong";
            target.ExecuteNonQuery();
            target.CommandText = "CREATE TABLE bojong (d,j,r,n,a,p,PRIMARY KEY(d,j))";
            target.ExecuteNonQuery();
            List<string> bojongTables = origin.GetTablesLike("bojong_%");
            if (bojongTables.Count == 0)
            {
                return;
            }
            Stopwatch stopwatch = Stopwatch.StartNew();
            InsertBuilder ib = new InsertBuilder();
            ib.SetInsertIntoTableValues("INSERT INTO bojong(d,j,r,n,a,p)VALUES");
            for (int i = 0; i < bojongTables.Count; i++)
            {
                string bojongTable = bojongTables[i];
                if (stopwatch.ElapsedMilliseconds > PROGRESS_REPORT_INTERVAL_MS)
                {
                    Log2.Info($"bojong: SELECT: {i}/{bojongTables.Count}");
                    stopwatch.Restart();
                }
                origin.CommandText = $"SELECT 종목코드,보유순위,보유계좌수,보유평균매수가,보유계좌수익률 FROM {bojongTable}";
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
                        ib.AddValues(string.Format("({0},'{1}',{2},{3},{4},{5})", d, j, r, n, a, p));
                    }
                }
            }
            Log2.Info("begin INSERT");
            Stopwatch stopwatchInsert = Stopwatch.StartNew();
            List<string> commandTexts = ib.GetCommandTexts();
            target.ExecuteAtomicTransaction(() =>
            {
                for (int i = 0; i < commandTexts.Count; i++)
                {
                    if (stopwatch.ElapsedMilliseconds > PROGRESS_REPORT_INTERVAL_MS)
                    {
                        Log2.Info($"bojong: INSERT: {i}/{commandTexts.Count}");
                        stopwatch.Restart();
                    }
                    string commandText = commandTexts[i];
                    target.CommandText = commandText;
                    target.ExecuteNonQuery();
                }
            });
            Log2.Info($"bojong INSERT done ({stopwatchInsert.ElapsedMilliseconds}ms)");
        }


        private void CreateTableTop()
        {
            target.CommandText = "DROP TABLE IF EXISTS top";
            target.ExecuteNonQuery();
            target.CommandText = "CREATE TABLE top(dat,jmcode,rank,buy,sell,net,nacc,qty,avg,pr,PRIMARY KEY(dat,jmcode))";
            target.ExecuteNonQuery();
            List<string> topTables = origin.GetTablesLike("top_%");
            if (topTables.Count == 0)
            {
                return;
            }
            Stopwatch stopwatch = Stopwatch.StartNew();
            StringBuilder sb = new StringBuilder();
            sb.Append("INSERT INTO top(dat,jmcode,rank,buy,sell,net,nacc,qty,avg,pr)VALUES");
            bool first = true;
            for (int i = 0; i < topTables.Count; i++)
            {
                string topTable = topTables[i];
                if (stopwatch.ElapsedMilliseconds > PROGRESS_REPORT_INTERVAL_MS)
                {
                    Log2.Info($"top: SELECT: {i}/{topTables.Count}");
                    stopwatch.Restart();
                }
                origin.CommandText = $"SELECT 종목코드,상위순위,상위매수수량,상위매도수량,상위순매매수량,상위계좌수,상위수량,상위평균매입가,상위수익률 FROM {topTable}";
                using (var rdr = origin.ExecuteReader())
                {
                    while (rdr.Read())
                    {
                        if (first)
                        {
                            first = false;
                        }
                        else
                        {
                            sb.Append(',');
                        }
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
                        sb.AppendFormat("({0},'{1}',{2},{3},{4},{5},{6},{7},{8},{9})", dat, jmcode, rank, buy, sell, net, nacc, qty, avg, pr);
                    }
                }
            }
            target.CommandText = sb.ToString();
            target.ExecuteNonQuery();
        }


        private void CreateTableOpt10059()
        {
            target.CommandText = "DROP TABLE IF EXISTS opt10059";
            target.ExecuteNonQuery();
            target.CommandText = "CREATE TABLE opt10059(dat,jmcode,buysell,ind,fore,org,fin,ins,inv,ofin,bank,yun,priv,nation,oco,ne,PRIMARY KEY(dat,jmcode,buysell))";
            target.ExecuteNonQuery();
            List<string> opt10059Tables = origin.GetTablesLike("opt10059_%");
            if (opt10059Tables.Count == 0)
            {
                return;
            }
            opt10059Tables.Sort((sortee1, sortee2) =>
            {
                return sortee1.Substring(13).CompareTo(sortee2.Substring(13));
            });
            Stopwatch stopwatch = Stopwatch.StartNew();
            InsertBuilder ib = new InsertBuilder();
            ib.SetInsertIntoTableValues("INSERT INTO opt10059(dat,jmcode,buysell,ind,fore,org,fin,ins,inv,ofin,bank,yun,priv,nation,oco,ne)VALUES");
            int nTable = opt10059Tables.Count;
            if(_njm > 0)
            {
                nTable = Math.Min(nTable, _njm * 2);
            }
            for (int i = 0; i < nTable; i++)
            {
                string opt10059Table = opt10059Tables[i];
                if (stopwatch.ElapsedMilliseconds > PROGRESS_REPORT_INTERVAL_MS)
                {
                    Log2.Info($"opt10059: SELECT: {i}/{opt10059Tables.Count}");
                    stopwatch.Restart();
                }
                origin.CommandText = $"SELECT 일자,개인투자자,외국인투자자,기관계,금융투자,보험,투신,기타금융,은행,연기금등,사모펀드,국가,기타법인,내외국인 FROM {opt10059Table}";
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
                        ib.AddValues(string.Format("({0},'{1}',{2},{3},{4},{5},{6},{7},{8},{9},{10},{11},{12},{13},{14},{15})", dat, jmcode, buysell, ind, fore, org, fin, ins, inv, ofin, bank, yun, priv, nation, oco, ne));
                    }
                }
            }
            Log2.Info("begin INSERT");
            List<string> commandTexts = ib.GetCommandTexts();
            target.ExecuteAtomicTransaction(() =>
            {
                for (int i = 0; i < commandTexts.Count; i++)
                {
                    if (stopwatch.ElapsedMilliseconds > PROGRESS_REPORT_INTERVAL_MS)
                    {
                        Log2.Info($"opt10059: INSERT: {i}/{commandTexts.Count}");
                        stopwatch.Restart();
                    }
                    string commandText = commandTexts[i];
                    target.CommandText = commandText;
                    target.ExecuteNonQuery();
                }
            });
            Log2.Info("end INSERT");
        }

        private void CreateTableOpt10081()
        {
            target.CommandText = "DROP TABLE IF EXISTS opt10081";
            target.ExecuteNonQuery();
            target.CommandText = "CREATE TABLE opt10081(d,j,c,v,u,o,h,l,m,r,PRIMARY KEY(d,j))";
            target.ExecuteNonQuery();
            List<string> opt10081Tables = origin.GetTablesLike("opt10081_%");
            if(opt10081Tables.Count == 0)
            {
                return;
            }
            opt10081Tables.Sort();
            Stopwatch stopwatch = Stopwatch.StartNew();
            InsertBuilder ib = new InsertBuilder();
            ib.SetInsertIntoTableValues("INSERT INTO opt10081(d,j,c,v,u,o,h,l,m,r)VALUES");
            int nTable = opt10081Tables.Count;
            if (_njm > 0)
            {
                nTable = Math.Min(nTable, _njm);
            }
            for (int i = 0; i < nTable; i++)
            {
                string opt10081Table = opt10081Tables[i];
                if (stopwatch.ElapsedMilliseconds > PROGRESS_REPORT_INTERVAL_MS)
                {
                    Log2.Info($"opt10081: SELECT: {i}/{opt10081Tables.Count}");
                    stopwatch.Restart();
                }
                origin.CommandText = $"SELECT 일자,현재가,거래량,거래대금,시가,고가,저가,수정주가구분,수정비율 FROM {opt10081Table}";
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
                        if (m < 0) { m = 0; } // Convert -999999999999999(unmodified) into 0.
                        double r = rdr.GetDouble(8);
                        ib.AddValues(string.Format("({0},'{1}',{2},{3},{4},{5},{6},{7},{8},{9})", d, j, c, v, u, o, h, l, m, r));
                    }
                }
            }
            Log2.Info("begin INSERT");
            List<string> commandTexts = ib.GetCommandTexts();
            target.ExecuteAtomicTransaction(() =>
            {
                for (int i = 0; i < commandTexts.Count; i++)
                {
                    if (stopwatch.ElapsedMilliseconds > PROGRESS_REPORT_INTERVAL_MS)
                    {
                        Log2.Info($"opt10081: INSERT: {i}/{commandTexts.Count}");
                        stopwatch.Restart();
                    }
                    string commandText = commandTexts[i];
                    target.CommandText = commandText;
                    target.ExecuteNonQuery();
                }
            });
            Log2.Info("end INSERT");
        }

        private void CreateTableOpt10001()
        {
            target.CommandText = "DROP TABLE IF EXISTS opt10001";
            target.ExecuteNonQuery();
            target.CommandText = "CREATE TABLE opt10001(cod,nam,mon,fac,cap,lis,ous,otr,lda,PRIMARY KEY(cod))";
            target.ExecuteNonQuery();
            StringBuilder sb = new StringBuilder();
            sb.Append("INSERT INTO opt10001(cod,nam,mon,fac,cap,lis,ous,otr,lda)VALUES");
            bool first = true;
            origin.CommandText = $"SELECT 종목코드,종목명,결산월,액면가,자본금,상장주식,유통주식,유통비율,상장일 FROM opt10001";
            using (var rdr = origin.ExecuteReader())
            {
                while (rdr.Read())
                {
                    if (first)
                    {
                        first = false;
                    }
                    else
                    {
                        sb.Append(',');
                    }
                    string cod = rdr.GetString(0);
                    string nam = rdr.GetString(1);
                    long mon = rdr.GetInt64(2);
                    long fac = rdr.GetInt64(3);
                    long cap = rdr.GetInt64(4);
                    long lis = rdr.GetInt64(5);
                    long ous = rdr.GetInt64(6);
                    double otr = rdr.GetDouble(7);
                    long lda = rdr.GetInt64(8);
                    sb.AppendFormat("('{0}','{1}',{2},{3},{4},{5},{6},{7},{8})", cod, nam, mon, fac, cap, lis, ous, otr, lda);
                }
            }
            target.CommandText = sb.ToString();
            target.ExecuteNonQuery();
        }


        private void CreateTableMarket()
        {
            target.CommandText = "DROP TABLE IF EXISTS market";
            target.ExecuteNonQuery();
            target.CommandText = "CREATE TABLE market(c PRIMARY KEY,m)";
            target.ExecuteNonQuery();
            StringBuilder sb = new StringBuilder();
            sb.Append("INSERT INTO market(c,m)VALUES");
            bool first = true;
            origin.CommandText = $"SELECT 종목코드,시장 FROM kospidaq";
            using (var rdr = origin.ExecuteReader())
            {
                while (rdr.Read())
                {
                    if (first)
                    {
                        first = false;
                    }
                    else
                    {
                        sb.Append(',');
                    }
                    string c = rdr.GetString(0);
                    int m = rdr.GetInt32(1);
                    sb.AppendFormat("('{0}',{1})", c, m);
                }
            }
            target.CommandText = sb.ToString();
            target.ExecuteNonQuery();
        }


        private void CreateTableOpt20006()
        {
            target.CommandText = "DROP TABLE IF EXISTS opt20006";
            target.ExecuteNonQuery();
            target.CommandText = "CREATE TABLE opt20006(d,p,c,v,u,o,h,l,PRIMARY KEY(d,p))";
            target.ExecuteNonQuery();
            StringBuilder sb = new StringBuilder();
            sb.Append("INSERT INTO opt20006(d,p,c,v,u,o,h,l)VALUES");
            bool first = true;
            foreach (var upcode in transaction)
            {
                origin.CommandText = $"SELECT 일자,현재가,거래량,거래대금,시가,고가,저가 FROM opt20006_{upcode}";
                using (var rdr = origin.ExecuteReader())
                {
                    while (rdr.Read())
                    {
                        if (first)
                        {
                            first = false;
                        }
                        else
                        {
                            sb.Append(',');
                        }
                        int d = rdr.GetInt32(0);
                        string p = upcode;
                        long c = rdr.GetInt64(1);
                        long v = rdr.GetInt64(2);
                        long u = rdr.GetInt64(3);
                        long o = rdr.GetInt64(4);
                        long h = rdr.GetInt64(5);
                        long l = rdr.GetInt64(6);
                        sb.AppendFormat("({0},'{1}',{2},{3},{4},{5},{6},{7})", d, p, c, v, u, o, h, l);
                    }
                    rdr.Close();
                }
            }
            target.CommandText = sb.ToString();
            target.ExecuteNonQuery();
        }


        public void Dispose()
        {
            origin.Dispose();
            target.Dispose();
        }


    }
}


