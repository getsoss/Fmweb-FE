namespace Fmweb
{
    internal class ModifiedHaveRow
    {
        internal int Date;
        internal double 개인투자자, 외국인투자자, 기관계, 금융투자, 보험, 투신, 기타금융, 은행, 연기금등, 사모펀드, 국가, 기타법인, 내외국인;

        internal object[] ToObjects()
        {
            return new object[14] { Date, 개인투자자, 외국인투자자, 기관계, 금융투자, 보험, 투신, 기타금융, 은행, 연기금등, 사모펀드, 국가, 기타법인, 내외국인 };
        }

        public static ModifiedHaveRow operator +(ModifiedHaveRow a, ModifiedHaveRow b)
        {
            var ret = new ModifiedHaveRow();
            ret.Date = a.Date;
            ret.개인투자자 = a.개인투자자 + b.개인투자자;
            ret.외국인투자자 = a.외국인투자자 + b.외국인투자자;
            ret.기관계 = a.기관계 + b.기관계;
            ret.금융투자 = a.금융투자 + b.금융투자;
            ret.보험 = a.보험 + b.보험;
            ret.투신 = a.투신 + b.투신;
            ret.기타금융 = a.기타금융 + b.기타금융;
            ret.은행 = a.은행 + b.은행;
            ret.연기금등 = a.연기금등 + b.연기금등;
            ret.사모펀드 = a.사모펀드 + b.사모펀드;
            ret.국가 = a.국가 + b.국가;
            ret.기타법인 = a.기타법인 + b.기타법인;
            ret.내외국인 = a.내외국인 + b.내외국인;
            return ret;
        }

        public static ModifiedHaveRow operator /(ModifiedHaveRow a, long b)
        {
            var ret = new ModifiedHaveRow();
            ret.Date = a.Date;
            ret.개인투자자 = a.개인투자자 / b;
            ret.외국인투자자 = a.외국인투자자 / b;
            ret.기관계 = a.기관계 / b ;
            ret.금융투자 = a.금융투자 / b ;
            ret.보험 = a.보험 / b ;
            ret.투신 = a.투신 / b ;
            ret.기타금융 = a.기타금융 / b ;
            ret.은행 = a.은행 / b ;
            ret.연기금등 = a.연기금등 / b ;
            ret.사모펀드 = a.사모펀드 / b ;
            ret.국가 = a.국가 / b ;
            ret.기타법인 = a.기타법인 / b ;
            ret.내외국인 = a.내외국인 / b ;
            return ret;
        }

    }
}
