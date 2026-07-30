using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Data.SQLite;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace Fmweb
{
    internal static class Program
    {

        private static readonly Regex _tickerRegex = new Regex("^[A-Za-z0-9]{6}$");
        private static readonly SQLiteConnection3 _conn = new SQLiteConnection3();

        private static void Main(string[] args)
        {
            Console.WriteLine("-----BEGIN MAIN-----");
            Console.WriteLine("current directory: " + Directory.GetCurrentDirectory());

            WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
            WebApplication app = builder.Build();

            app.MapGet("/modified-candles", (string ticker) =>
        {
            JObject jo = new JObject();
            bool isMatch = _tickerRegex.IsMatch(ticker);

            if (!isMatch)
            {
                jo["errno"] = 1;
                return Results.Content(jo.ToString(Newtonsoft.Json.Formatting.None), "application/json");
            }

            if (!_conn.GetAllTickers().Contains(ticker))
            {
                jo["errno"] = 1;
                return Results.Content(jo.ToString(Newtonsoft.Json.Formatting.None), "application/json");
            }

            var modifiedCandles = _conn.GetModifiedCandles(ticker);
            jo["errno"] = 0;
            jo["result"] = JArray.FromObject(modifiedCandles.Select(x => (object[])x));

            return Results.Content(jo.ToString(Newtonsoft.Json.Formatting.None), "application/json");
        });

            app.MapGet("/ticker-exists", (string ticker) =>
        {
            var jo = new JObject();

            if (_conn.GetAllTickers().Contains(ticker))
            {
                jo["result"] = true;
            }
            else
            {
                jo["result"] = false;
            }

            return Results.Content(jo.ToString(Newtonsoft.Json.Formatting.None), "application/json");
        });

            app.MapGet("/bojong", (string ticker) =>
        {
            var jo = new JObject();
            bool isMatch = _tickerRegex.IsMatch(ticker);

            if (!isMatch)
            {
                jo["errno"] = 1;
                return Results.Content(jo.ToString(Newtonsoft.Json.Formatting.None), "application/json");
            }

            if (!_conn.GetAllTickers().Contains(ticker))
            {
                jo["errno"] = 1;
                return Results.Content(jo.ToString(Newtonsoft.Json.Formatting.None), "application/json");
            }

            var bojongRows = _conn.ReadAllBojongRows(ticker);
            jo["errno"] = 0;
            jo["result"] = JArray.FromObject(bojongRows.Select(x => (object[])x));
            return Results.Content(jo.ToString(Newtonsoft.Json.Formatting.None), "application/json");
        });

            app.Run();

            Console.WriteLine("-----END MAIN-----");
        }
    }
}

