using System;
using System.Collections.Generic;
using System.Data.SQLite;
using System.Text.RegularExpressions;

namespace Fmweb.SQLite
{
    /// <summary>
    /// Manages both DbConnection and DbCommand.
    /// </summary>
    internal class SQLiteConnection2 : IDisposable
    {
        private readonly SQLiteConnection _conn;
        private readonly SQLiteCommand _cmd;


        /// <summary>
        /// Initializes the connection and its command with the specified data source.
        /// </summary>
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


        /// <inheritdoc cref="SQLiteCommand.ExecuteReader()"/>
        public SQLiteDataReader ExecuteReader()
        {
            return _cmd.ExecuteReader();
        }


        /// <inheritdoc cref="SQLiteCommand.ExecuteNonQuery()"/>
        public int ExecuteNonQuery()
        {
            int ret = _cmd.ExecuteNonQuery();
            return ret;
        }


        /// <inheritdoc cref="SQLiteParameterCollection.AddWithValue(string, object)"/>
        public SQLiteParameter AddParamWithValue(string parameterName, object value)
        {
            return _cmd.Parameters.AddWithValue(parameterName, value);
        }


        /// <inheritdoc cref="SQLiteParameterCollection.Clear"/>
        public void ClearParams()
        {
            _cmd.Parameters.Clear();
        }


        /// <inheritdoc cref="SQLiteCommand.CommandText"/>
        public string CommandText
        {
            get
            {
                return _cmd.CommandText;
            }

            set
            {
                _cmd.CommandText = value;
            }
        }


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

