namespace Fmweb.Data
{
    internal class ModifiedHaveRow
    {
        public int Date;
        public double individual, foreigner, organization, financeinvest, insurance, investtrust, otherfinance, bank, pension, privatefund, nation, othercorporation, inout;

        public object[] ToObjects()
        {
            return new object[14] { Date, individual, foreigner, organization, financeinvest, insurance, investtrust, otherfinance, bank, pension, privatefund, nation, othercorporation, inout };
        }

        public void Add(ModifiedHaveRow a)
        {
            individual += a.individual;
            foreigner += a.foreigner;
            organization += a.organization;
            financeinvest += a.financeinvest;
            insurance += a.insurance;
            investtrust += a.investtrust;
            otherfinance += a.otherfinance;
            bank += a.bank;
            pension += a.pension;
            privatefund += a.privatefund;
            nation += a.nation;
            othercorporation += a.othercorporation;
            inout += a.inout;
        }


        public void Div(double b)
        {
            individual /= b;
            foreigner /= b;
            organization /= b;
            financeinvest /= b;
            insurance /= b;
            investtrust /= b;
            otherfinance /= b;
            bank /= b;
            pension /= b;
            privatefund /= b;
            nation /= b;
            othercorporation /= b;
            inout /= b;
        }

        public double Sum(Investor investors)
        {
            double ret = 0;
            if ((investors & Investor.개인투자자) != 0){ret += individual;}
            if ((investors & Investor.외국인투자자) != 0) { ret += foreigner; }
            if ((investors & Investor.기관계) != 0) { ret += organization; }
            if ((investors & Investor.금융투자) != 0) { ret += financeinvest; }
            if ((investors & Investor.보험) != 0) { ret += insurance; }
            if ((investors & Investor.투신) != 0) { ret += investtrust; }
            if ((investors & Investor.기타금융) != 0) { ret += otherfinance; }
            if ((investors & Investor.은행) != 0) { ret += bank; }
            if ((investors & Investor.연기금등) != 0) { ret += pension; }
            if ((investors & Investor.사모펀드) != 0) { ret += privatefund; }
            if ((investors & Investor.국가) != 0) { ret += nation; }
            if ((investors & Investor.기타법인) != 0) { ret += othercorporation; }
            if ((investors & Investor.내외국인) != 0) { ret += inout; }
            return ret;
        }

    }
}
