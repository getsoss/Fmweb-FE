using System;

namespace DBConverter
{
    internal static class DBConvertProgram
    {

        private static void PrintUsage()
        {
            Console.WriteLine("usage:");
            Console.WriteLine("./DBConverter legacy_to_FMSDBV01 <src> <target> [--njm=<njm>]");
            Console.WriteLine("./DBConverter FMSDBV01_to_FMSDBV02 <src> <target>");
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

                if (command == "legacy_to_FMSDBV01")
                {
                    int njm = -1;

                    if(args.Length > 3)
                    {
                        if (args[3].StartsWith("--njm="))
                        {
                            njm = int.Parse(args[3].Substring(6));
                        }
                    }

                    Console.WriteLine($"njm={njm}");

                    using (var converter = new LegacyToFMSDBV01Converter(args[1], args[2], njm))
                    {
                        converter.Convert();
                    }
                    return;
                }

                if (command == "FMSDBV01_to_FMSDBV02")
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
                Console.WriteLine(ex);
            }
        }
    }
}
