using Newtonsoft.Json.Linq;
using System.Net;
using System.Text;
using System.Data.SQLite;
using System.Text.RegularExpressions;

namespace Fmweb
{
    public static class Program
    {



        public static void Main(string[] args)
        {
            Console.WriteLine("-----BEGIN MAIN-----");
            Console.WriteLine("current directory: " + Directory.GetCurrentDirectory());

            if (!File.Exists("fmclient.db"))
            {
                throw new FileNotFoundException("File 'fmclient.db' not found.");
            }

            // Do not initialize FmService before checking existence of "fmclient.db"
            // because FmService makes "fmclient.db" if it does not exist yet.

            FmController ctrl = new FmController();
            
            WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
            WebApplication app = builder.Build();

            app.MapGet("/modified-candles", ctrl.GetModifiedCandles);
            app.MapGet("/ticker-exists", ctrl.TickerExists);
            app.Run();

            Console.WriteLine("-----END MAIN-----");
        }
    }
}
