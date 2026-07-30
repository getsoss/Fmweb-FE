namespace Fmweb
{

    public class BojongRow
    {
        public int Date;
        public string Jmcode;
        public int Rank;
        public long NHaveAcc;
        public long AvgPrice;
        public double ProfitRate;

        public static explicit operator object[](BojongRow x)
        {
            return new object[5] { x.Date, x.Rank, x.NHaveAcc, x.AvgPrice, x.ProfitRate };
        }
    }
}


