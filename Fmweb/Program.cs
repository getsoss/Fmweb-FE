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
            Console.WriteLine("begin main");
            Console.WriteLine("cw: " + Directory.GetCurrentDirectory());

            if (!File.Exists("fmclient.db"))
            {
                throw new FileNotFoundException("File 'fmclient.db' not found.");
            }

            // Do not initialize FmService before checking existence of "fmclient.db".

            FmService serv = new FmService();

            WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
            WebApplication app = builder.Build();

            Regex injectionSafeRegex = new Regex("[A-Za-z0-9]+");

            app.MapGet("/opt10081", serv.Opt10081);

            app.Run();

            Console.WriteLine("end main");
        }
    }
}
