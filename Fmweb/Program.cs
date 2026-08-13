using Fmweb.SQLite;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;
using Serilog;
using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace Fmweb
{

    internal static class Program
    {

        private static void Main(string[] args)
        {
            try
            {
                Log.Logger = new LoggerConfiguration().WriteTo.File("log.txt",
                    fileSizeLimitBytes: 0x100000, // 1MB
                    buffered: true,
                    flushToDiskInterval: TimeSpan.FromSeconds(10),
                    rollingInterval: RollingInterval.Infinite,
                    rollOnFileSizeLimit: true,
                    retainedFileCountLimit: 4
                    ).WriteTo.Console().CreateLogger();

                if (args.Length > 0)
                {
                    string command = args[0];

                    if (command == "legacy_to_FMSDBV01")
                    {
                        using (var converter = new LegacyToFMSDBV01Converter(args[1], args[2]))
                        {
                            converter.Convert();
                        }
                        return;
                    }

                    if (command == "FMSDBV01_to_FMSDBV02")
                    {
                        throw new NotImplementedException();
                        return;
                    }
                }

                WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
                builder.Services.AddSerilog();

                WebApplication app = builder.Build();
                var handlers = new Handlers();
                app.MapGet("/modified-candles", handlers.modified_candles);
                app.MapGet("/ticker-exists", handlers.ticker_exists);
                app.MapGet("/bojong", handlers.bojong);
                app.MapGet("/modified-average-trade-price", handlers.modified_average_trade_price);
                app.MapGet("/modified-have", handlers.modified_have);
                app.MapGet("/power", handlers.power);
                app.MapGet("/direction", handlers.direction);
                app.MapGet("/rs", handlers.rs);
                app.MapGet("/search-by-date-and-price", handlers.search_by_date_and_price);
                app.MapGet("/search-by-bojong-profit-rate", handlers.search_by_bojong_profit_rate);
                app.MapGet("/search-by-have", handlers.search_by_have);
                app.Run();
            }
            catch(Exception ex)
            {
                Log2.Error(ex.ToString());
            }

            Log.CloseAndFlush();
        }

    }

}

