using Serilog;
using System;
using System.Collections.Generic;

namespace Fmweb
{
    internal static class Log2
    {

        public static void Warn(string s)
        {
            Log.Warning(s);
        }

        private static readonly HashSet<LogType> _hashSet = new HashSet<LogType>();

        /// <summary>
        /// Do Log.Warning only once. If the same log type arrives, no operation is done.
        /// </summary>
        public static void WarnOnce(string s, LogType logType)
        {
            try
            {
                if (_hashSet.Contains(logType))
                {
                    return;
                }

                Warn(s);
                _hashSet.Add(logType);
            }
            catch { }
        }

        public static void Error(string s)
        {
            Log.Error(s);
        }
    }
}
