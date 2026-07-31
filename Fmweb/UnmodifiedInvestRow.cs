namespace Fmweb
{
    internal class UnmodifiedInvestRow
    {
        internal enum BuySell
        {
            Buy,
            Sell
        }

        internal int Date;
        internal long 일자, 개인투자자, 외국인투자자, 기관계, 금융투자, 보험, 투신, 기타금융, 은행, 연기금등, 사모펀드, 국가, 기타법인, 내외국인;

        public object[] ToObjects()
        {
            return new object[] { Date, 일자, 개인투자자, 외국인투자자, 기관계, 금융투자, 보험, 투신, 기타금융, 은행, 연기금등, 사모펀드, 국가, 기타법인, 내외국인 };
        }

    }
}
