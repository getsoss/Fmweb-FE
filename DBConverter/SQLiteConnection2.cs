using System;
using System.Collections.Generic;
using System.Data.SQLite;
using System.Text.RegularExpressions;

namespace DBConverter
{
    internal class SQLiteConnection2 : IDisposable
    {
        private readonly SQLiteConnection _conn;
        private readonly SQLiteCommand _cmd;

        public SQLiteConnection2(string dataSource)
        {
            _conn = new SQLiteConnection("Data Source=\"" + dataSource + "\"");
            _conn.Open();
            _cmd = _conn.CreateCommand();

        }


        public HashSet<string> ReadAllTableNames()
        {
            var ret = new HashSet<string>();
            CommandText = "SELECT name FROM sqlite_master WHERE type = 'table'";
            using (SQLiteDataReader r = ExecuteReader())
            {
                while (r.Read())
                {
                    ret.Add(r.GetString(0));
                }
                r.Close();
            }
            return ret;
        }


        public List<string> GetTablesLike(string like)
        {
            CommandText = "SELECT name FROM sqlite_master WHERE type='table' AND name like $a";
            AddParamWithValue("$a", like);
            var ret = new List<string>();
            using (var rdr = ExecuteReader())
            {
                while (rdr.Read())
                {
                    string s = rdr.GetString(0);
                    ret.Add(s);
                }
            }
            return ret;
        }


        /// <summary>
        /// Usage example:
        /// <code>
        /// using(var rdr=ExecuteReader())
        /// {
        ///  while(rdr.Read())
        ///  {
        ///   r.GetString(0);
        ///  }
        /// }
        /// </code>
        /// </summary>
        public SQLiteDataReader ExecuteReader()
        {

            SQLiteDataReader ret = _cmd.ExecuteReader() ?? throw new Exception();
            return ret;
        }


        /// <inheritdoc cref="SQLiteCommand.ExecuteScalar()"/>
        public object ExecuteScalar()
        {
            return _cmd.ExecuteScalar();
        }


        /// <inheritdoc cref="SQLiteCommand.ExecuteNonQuery()"/>
        public int ExecuteNonQuery()
        {
            int ret = _cmd.ExecuteNonQuery();
            return ret;
        }


        public SQLiteParameter AddParamWithValue(string parameterName, object value)
        {
            return _cmd.Parameters.AddWithValue(parameterName, value);
        }


        public void ClearParams()
        {
            _cmd.Parameters.Clear();
        }


        /// <inheritdoc cref="SQLiteCommand.CommandText"/>
        public string CommandText { get => _cmd.CommandText; set => _cmd.CommandText = value; }


        public void Dispose()
        {
            _cmd?.Dispose();
            _conn?.Close();
            _conn?.Dispose();
        }


        /// <summary>
        /// <code>
        /// BEGIN;
        /// try{
        /// YOUR_TRANSACTION;
        /// END;
        /// }
        /// catch{
        /// ROLLBACK;
        /// throw;
        /// }
        /// </code>
        /// </summary>
        /// <exception cref="ArgumentNullException"></exception>
        public void ExecuteAtomicTransaction(Action transaction)
        {
            if (transaction is null)
            {
                throw new ArgumentNullException(nameof(transaction));
            }

            CommandText = "BEGIN;";
            ExecuteNonQuery();

            try
            {
                transaction();
                CommandText = "END;";
                ExecuteNonQuery();
            }
            catch
            {
                CommandText = "ROLLBACK;";
                ExecuteNonQuery();
                throw;
            }

        }

    }
}

