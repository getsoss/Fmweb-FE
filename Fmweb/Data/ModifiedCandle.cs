namespace Fmweb.Data
{

    public class ModifiedCandle
    {
        public int Date;
        public double Close;
        public double Volume;
        public long VolumeMoney;
        public double Open;
        public double High;
        public double Low;

        public ModifiedCandle(int date, double close, double volume, long volumeMoney, double open, double high, double low)
        {
            Date = date;
            Close = close;
            Volume = volume;
            VolumeMoney = volumeMoney;
            Open = open;
            High = high;
            Low = low;
        }

        public static explicit operator object[](ModifiedCandle x)
        {
            return new object[7] { x.Date, x.Close, x.Volume, x.VolumeMoney, x.Open, x.High, x.Low };
        }

    }

}

