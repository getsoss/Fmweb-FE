namespace Fmweb.Data
{
    internal class DirectionRow
    {
        internal int Date;
        internal double 개인투자자, 외국인투자자, 기관계, 금융투자, 보험, 투신, 기타금융, 은행, 연기금등, 사모펀드, 국가, 기타법인, 내외국인;

        internal object[] ToObjects()
        {
            return new object[14] { Date, 개인투자자, 외국인투자자, 기관계, 금융투자, 보험, 투신, 기타금융, 은행, 연기금등, 사모펀드, 국가, 기타법인, 내외국인 };
        }
    }
}
