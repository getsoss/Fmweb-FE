namespace Fmweb.Data
{

    public class BojongRow
    {
        /// <summary>
        /// yyyyMMdd 형식이다.
        /// </summary>
        public int Date;

        /// <summary>
        /// 종목코드
        /// </summary>
        public string Jmcode;

        /// <summary>
        /// 보유순위
        /// </summary>
        public int Rank;

        /// <summary>
        /// 보유계좌수
        /// </summary>
        public long NHaveAcc;

        /// <summary>
        /// 보유평균매수가
        /// </summary>
        public long AvgPrice;

        /// <summary>
        /// 보유계좌수익률
        /// </summary>
        public double ProfitRate;

        public static explicit operator object[](BojongRow x)
        {
            return new object[5] { x.Date, x.Rank, x.NHaveAcc, x.AvgPrice, x.ProfitRate };
        }
    }
}


