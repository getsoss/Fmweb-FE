using System;

namespace DBConverter
{
    internal static class DBConvertProgram
    {

        private static void PrintUsage()
        {
            Log2.Info("usage:");
            Log2.Info("./DBConverter e <legacy> <FMSDBV01> [--njm=<njm>]");
            Log2.Info("./DBConverter f <FMSDBV01> <FMSDBV02>");
        }

        private static void Main(string[] args)
        {
            try
            {
                if (args.Length < 1)
                {
                    PrintUsage();
                    return;
                }

                string command = args[0];

                if (command == "--help" || command == "-h" || command == "-?" || command == "/?")
                {
                    PrintUsage();
                    return;
                }

                if (command == "e")
                {
                    int njm = -1;

                    if(args.Length > 3)
                    {
                        if (args[3].StartsWith("--njm="))
                        {
                            njm = int.Parse(args[3].Substring(6));
                        }
                    }

                    Log2.Info($"njm={njm}");

                    using (var converter = new LegacyToFMSDBV01Converter(args[1], args[2], njm))
                    {
                        converter.Convert();
                    }
                    return;
                }

                if (command == "f")
                {
                    using (var converter = new FMSDBV01ToFMSDBV02Converter(args[1], args[2]))
                    {
                        converter.Convert();
                    }
                    return;
                }

                PrintUsage();
                return;
            }
            catch(Exception ex)
            {
                Log2.Info(ex.ToString());
            }
        }
    }
}
