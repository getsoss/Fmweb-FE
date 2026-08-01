using System;

namespace Fmweb
{
    internal class PowerRow
    {
        internal int Date;
        internal double 개인투자자, 외국인투자자, 기관계, 금융투자, 보험, 투신, 기타금융, 은행, 연기금등, 사모펀드, 국가, 기타법인, 내외국인;

        public object[] ToObjects()
        {
            return new object[14] { Date, 개인투자자, 외국인투자자, 기관계, 금융투자, 보험, 투신, 기타금융, 은행, 연기금등, 사모펀드, 국가, 기타법인, 내외국인 };
        }

        public void Divide(long x)
        {
            개인투자자 /= x;
            외국인투자자 /= x;
            기관계 /= x;
            금융투자 /= x;
            보험 /= x;
            투신 /= x;
            기타금융 /= x;
            은행 /= x;
            연기금등 /= x;
            사모펀드 /= x;
            국가 /= x;
            기타법인 /= x;
            내외국인 /= x;
        }

        public void Multiply(byte x)
        {
            개인투자자 *= x;
            외국인투자자 *= x;
            기관계 *= x;
            금융투자 *= x;
            보험 *= x;
            투신 *= x;
            기타금융 *= x;
            은행 *= x;
            연기금등 *= x;
            사모펀드 *= x;
            국가 *= x;
            기타법인 *= x;
            내외국인 *= x;
        }

    }
}
