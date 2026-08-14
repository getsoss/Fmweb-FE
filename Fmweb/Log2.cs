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

        public static void Error(string s)
        {
            Log.Error(s);
        }

        public static void Info(string s)
        {
            Log.Information(s);
        }

    }
}
