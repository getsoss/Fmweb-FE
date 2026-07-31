namespace Fmweb
{
    internal partial class UnmodifiedInvestRow
    {

        internal int Date;
        internal long 개인투자자, 외국인투자자, 기관계, 금융투자, 보험, 투신, 기타금융, 은행, 연기금등, 사모펀드, 국가, 기타법인, 내외국인;

        public object[] ToObjects()
        {
            return new object[14] { Date, 개인투자자, 외국인투자자, 기관계, 금융투자, 보험, 투신, 기타금융, 은행, 연기금등, 사모펀드, 국가, 기타법인, 내외국인 };
        }

        public static ModifiedInvestRow operator *(UnmodifiedInvestRow a, ModifyFactor b)
        {
            var ret = new ModifiedInvestRow();
            ret.Date = a.Date;
            ret.개인투자자 = a.개인투자자 / b.Factor;
            ret.외국인투자자 = a.외국인투자자 / b.Factor;
            ret.기관계 = a.기관계 / b.Factor;
            ret.금융투자 = a.금융투자 / b.Factor;
            ret.보험 = a.보험 / b.Factor;
            ret.투신 = a.투신 / b.Factor;
            ret.기타금융 = a.기타금융 / b.Factor;
            ret.은행 = a.은행 / b.Factor;
            ret.연기금등 = a.연기금등 / b.Factor;
            ret.사모펀드 = a.사모펀드 / b.Factor;
            ret.국가 = a.국가 / b.Factor;
            ret.기타법인 = a.기타법인 / b.Factor;
            ret.내외국인 = a.내외국인 / b.Factor;

            return ret;
        }

    }
}
