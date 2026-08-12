namespace Fmweb.Data
{
    internal class ModifiedAverageTradePriceRow
    {
        internal int Date;
        internal double 개인투자자B, 개인투자자S, 외국인투자자B, 외국인투자자S, 기관계B, 기관계S, 금융투자B, 금융투자S, 보험B, 보험S, 투신B, 투신S, 기타금융B, 기타금융S, 은행B, 은행S, 연기금등B, 연기금등S, 사모펀드B, 사모펀드S, 국가B, 국가S, 기타법인B, 기타법인S, 내외국인B, 내외국인S;

        public object[] ToObjects()
        {
            return new object[] { Date, 개인투자자B, 개인투자자S, 외국인투자자B, 외국인투자자S, 기관계B, 기관계S, 금융투자B, 금융투자S, 보험B, 보험S, 투신B, 투신S, 기타금융B, 기타금융S, 은행B, 은행S, 연기금등B, 연기금등S, 사모펀드B, 사모펀드S, 국가B, 국가S, 기타법인B, 기타법인S, 내외국인B, 내외국인S };
        }

    }
}
