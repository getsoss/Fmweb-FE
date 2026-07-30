namespace Fmweb
{

    public class UnmodifiedCandle
    {
        public int Date;
        public long Close;
        public long Volume;
        public long VolumeMoney;
        public long Open;
        public long High;
        public long Low;
        public long ModifyType;
        public double ModifyRatio;

        public UnmodifiedCandle(int date, long close, long volume, long volumeMoney, long open, long high, long low, long modifyType, double modifyRatio)
        {
            Date = date;
            Close = close;
            Volume = volume;
            VolumeMoney = volumeMoney;
            Open = open;
            High = high;
            Low = low;
            ModifyType = modifyType;
            ModifyRatio = modifyRatio;
        }

        public static ModifiedCandle operator *(UnmodifiedCandle a, ModifyFactor b)
        {
            return new ModifiedCandle(
                a.Date,
                a.Close * b.Factor,
                a.Volume / b.Factor,
                a.VolumeMoney,
                a.Open * b.Factor,
                a.High * b.Factor,
                a.Low * b.Factor);

        }

    }

}

