using Fmweb.Data;
using Microsoft.AspNetCore.Components;
using System;
using System.Collections.Generic;
using System.Data.SQLite;
using System.IO;
using System.Linq;
using System.Reflection.Emit;
using System.Text;

namespace Fmweb.SQLite
{

    internal class FMSDBV01ToFMSDBV02Converter : IDisposable
    {
        private const int PROGRESS_REPORT_INTERVAL_MS = 500; // Default is 500.
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

        public void Dispose()
        {
            _conn.Dispose();
        }

        public void Convert()
        {
            Log2.Info("Converting FMSDBV01 into FMSDBV02...");

            _conn.CommandText = "SELECT n FROM complete_tables ; ";
            HashSet<string> completeTables = new HashSet<string>();
            using (var rdr = _conn.ExecuteReader())
            {
                while (rdr.Read())
                {
                    completeTables.Add(rdr.GetString(0));
                }
                rdr.Close();
            }

            Log2.Info($"complete tables: {string.Join(", ", completeTables)}");

            if (!completeTables.Contains("modifyfactor"))
            {
                CreateTableModifyfactor();
            }

        }


        private void CreateTableModifyfactor()
        {
            _conn.CommandText = "DROP TABLE IF EXISTS modifyfactor ; ";
            _conn.ExecuteNonQuery();
            _conn.CommandText = "CREATE TABLE modifyfactor( c, d, m, PRIMARY KEY(c,d) ) ;";
            _conn.ExecuteNonQuery();
            _conn.CommandText = "SELECT DISTINCT j FROM opt10081 ; ";
            List<string> tickers = new List<string>();
            using (var rdr = _conn.ExecuteReader())
            {
                while (rdr.Read())
                {
                    tickers.Add(rdr.GetString(0));
                }
                rdr.Close();
            }
            StringBuilder sb = new StringBuilder();
            _conn.ExecuteAtomicTransaction(() =>
            {
                foreach (var c in tickers)
                {
                    List<KeyValuePair<int, double>> lis = new List<KeyValuePair<int, double>>();
                    double modifyFactor = 1;
                    _conn.CommandText = $"SELECT d,r FROM opt10081 WHERE j = $ticker ORDER BY d DESC ; ";
                    _conn.AddParamWithValue("$ticker", c);
                    using (SQLiteDataReader rdr = _conn.ExecuteReader())
                    {
                        while (rdr.Read())
                        {
                            int d = rdr.GetInt32(0);
                            double r = rdr.GetDouble(1);
                            lis.Add(new KeyValuePair<int, double>(d, modifyFactor));
                            modifyFactor *= (1 + (r / 100));
                        }
                        rdr.Close();
                    }
                    sb.Clear();
                    sb.Append("INSERT INTO modifyfactor(c,d,m) VALUES ");
                    for (int i = 0; i < lis.Count; i++)
                    {
                        sb.AppendFormat(" ('{0}',{1},{2}) ", c, lis[i].Key, lis[i].Value);
                        if (i + 1 < lis.Count)
                        {
                            sb.Append(" , ");
                        }
                    }
                    _conn.CommandText = sb.ToString();
                    _conn.ExecuteNonQuery();
                }
            });
            _conn.CommandText = "INSERT INTO complete_tables(n) VALUES ( 'modifyfactor' ) ; ";
            _conn.ExecuteNonQuery();
        }
    }

}
