namespace Fmweb.Data
{
    internal class ModifiedHaveRow
    {
        public int Date;
        public double 개인투자자, 외국인투자자, 기관계, 금융투자, 보험, 투신, 기타금융, 은행, 연기금등, 사모펀드, 국가, 기타법인, 내외국인;

        public object[] ToObjects()
        {
            return new object[14] { Date, 개인투자자, 외국인투자자, 기관계, 금융투자, 보험, 투신, 기타금융, 은행, 연기금등, 사모펀드, 국가, 기타법인, 내외국인 };
        }

        public void Add(ModifiedHaveRow a)
        {
            개인투자자 += a.개인투자자;
            외국인투자자 += a.외국인투자자;
            기관계 += a.기관계;
            금융투자 += a.금융투자;
            보험 += a.보험;
            투신 += a.투신;
            기타금융 += a.기타금융;
            은행 += a.은행;
            연기금등 += a.연기금등;
            사모펀드 += a.사모펀드;
            국가 += a.국가;
            기타법인 += a.기타법인;
            내외국인 += a.내외국인;
        }


        public void Div(double b)
        {
            개인투자자 /= b;
            외국인투자자 /= b;
            기관계 /= b;
            금융투자 /= b;
            보험 /= b;
            투신 /= b;
            기타금융 /= b;
            은행 /= b;
            연기금등 /= b;
            사모펀드 /= b;
            국가 /= b;
            기타법인 /= b;
            내외국인 /= b;
        }

        public double Sum(Investor investors)
        {
            double ret = 0;
            if ((investors & Investor.개인투자자) != 0){ret += 개인투자자;}
            if ((investors & Investor.외국인투자자) != 0) { ret += 외국인투자자; }
            if ((investors & Investor.기관계) != 0) { ret += 기관계; }
            if ((investors & Investor.금융투자) != 0) { ret += 금융투자; }
            if ((investors & Investor.보험) != 0) { ret += 보험; }
            if ((investors & Investor.투신) != 0) { ret += 투신; }
            if ((investors & Investor.기타금융) != 0) { ret += 기타금융; }
            if ((investors & Investor.은행) != 0) { ret += 은행; }
            if ((investors & Investor.연기금등) != 0) { ret += 연기금등; }
            if ((investors & Investor.사모펀드) != 0) { ret += 사모펀드; }
            if ((investors & Investor.국가) != 0) { ret += 국가; }
            if ((investors & Investor.기타법인) != 0) { ret += 기타법인; }
            if ((investors & Investor.내외국인) != 0) { ret += 내외국인; }
            return ret;
        }

    }
}
