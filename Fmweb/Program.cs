using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;
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
            WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
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
            app.Run();
        }

    }

}

