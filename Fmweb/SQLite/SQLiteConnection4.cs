using System;
using System.Collections.Generic;
using System.Data.SQLite;

namespace Fmweb.SQLite
{
    internal class SQLiteConnection4
    {
        private readonly SQLiteConnection3 _conn;

        public SQLiteConnection4()
        {
            _conn = new SQLiteConnection3();
        }


        /// <summary>
        /// In percentage. Thread-safe.
        /// </summary>
        public List<RsRow> GetRs(string ticker)
        {
            var market = _conn.GetMarketDict()[ticker];
            var marketCandles = _conn.GetMarketCandles(market);
            var modifiedCandles = GetModifiedCandles(ticker);
            var ret = new List<RsRow>();
            int n = Math.Min(marketCandles.Count, modifiedCandles.Count);

            // Prevent division by zero.
            double jongmokDenominator = Math.Max(1, Math.Abs(modifiedCandles[n - 1].Close));
            double marketDenominator = Math.Max(1, Math.Abs(marketCandles[n - 1].Close));

            for (int i = 0; i < n; i++)
            {
                double jongmokStrength = (Math.Abs(modifiedCandles[i].Close) / jongmokDenominator);
                double marketStrength = (Math.Abs(marketCandles[i].Close) / marketDenominator);
                var row = new RsRow();
                row.Rs = jongmokStrength / marketStrength * 100; // Make it percentage.
                row.Date = modifiedCandles[i].Date;
                ret.Add(row);
            }

            return ret;
        }


        

        /// <summary>
        /// Thread-safe.
        /// </summary>
        public List<ModifiedCandle> GetModifiedCandles(string ticker)
        {
            List<UnmodifiedCandle> org = _conn.GetUnmodifiedCandles(ticker);
            List<ModifyFactor> modifyFactors = _conn.GetModifyFactors(ticker);
            List<ModifiedCandle> ret = new List<ModifiedCandle>();
            for (int i = 0; i < modifyFactors.Count; i++)
            {
                ModifiedCandle modifiedCandle = org[i] * modifyFactors[i];
                ret.Add(modifiedCandle);
            }
            return ret;
        }


        /// <summary>
        /// In percentage. Thread-safe.
        /// </summary>
        public List<ModifiedHaveRow> GetModifiedHaveRows(string ticker)
        {
            var modifiedInvestRowsBuy = _conn.GetModifiedInvestRows(ticker, BuySell.Buy);
            var modifiedInvestRowsSell = _conn.GetModifiedInvestRows(ticker, BuySell.Sell);
            var jongmok = _conn.GetJongmokDict()[ticker];

            // ( jongmok.outstandingStock * 1000 ) is exact actual quantity.
            // But we set denominator to ( jongmok.outstandingStock * 10 ) to get "have" value in **PERCENTAGE** unit.
            long denominator = jongmok.OutstandingStock * 10;

            // Prevent division by zero.
            denominator = Math.Max(denominator, 1);

            List<ModifiedHaveRow> ret = new List<ModifiedHaveRow>();

            for (int i = 0; i < modifiedInvestRowsBuy.Count; i++)
            {
                var row = new ModifiedHaveRow();
                row.Date = modifiedInvestRowsBuy[i].Date;

                double f(Func<ModifiedInvestRow, double> func)
                {
                    return Math.Abs(func(modifiedInvestRowsBuy[i])) - Math.Abs(func(modifiedInvestRowsSell[i]));
                }

                row.개인투자자 = f(x => x.개인투자자);
                row.외국인투자자 = f(x => x.외국인투자자);
                row.기관계 = f(x => x.기관계);
                row.금융투자 = f(x => x.금융투자);
                row.보험 = f(x => x.보험);
                row.투신 = f(x => x.투신);
                row.기타금융 = f(x => x.기타금융);
                row.은행 = f(x => x.은행);
                row.연기금등 = f(x => x.연기금등);
                row.사모펀드 = f(x => x.사모펀드);
                row.국가 = f(x => x.국가);
                row.기타법인 = f(x => x.기타법인);
                row.내외국인 = f(x => x.내외국인);
                ret.Add(row);
            }

            // Make prefix sum.
            for (int i = modifiedInvestRowsBuy.Count - 2; i >= 0; i--)
            {
                ret[i].Add(ret[i + 1]);
            }

            // 각 일자의 각 세력의 주식보유량을 유통주식수로 나눠준다.
            for (int i = 0; i < modifiedInvestRowsBuy.Count; i++)
            {
                ret[i].Div(denominator);
            }

            return ret;
        }



        /// <summary>
        /// In percentage. Thread-safe.
        /// </summary>
        public List<PowerRow> GetPowerRows(string ticker)
        {
            var unmodifiedInvestRowsBuy = _conn.GetUnmodifiedInvestRows(ticker, BuySell.Buy);
            var unmodifiedInvestRowsSell = _conn.GetUnmodifiedInvestRows(ticker, BuySell.Buy);
            List<PowerRow> ret = new List<PowerRow>();
            for (int i = 0; i < unmodifiedInvestRowsBuy.Count; i++)
            {
                var row = new PowerRow();
                row.Date = unmodifiedInvestRowsBuy[i].Date;
                row.개인투자자 = Math.Abs(unmodifiedInvestRowsBuy[i].개인투자자) + Math.Abs(unmodifiedInvestRowsSell[i].개인투자자);
                row.외국인투자자 = Math.Abs(unmodifiedInvestRowsBuy[i].외국인투자자) + Math.Abs(unmodifiedInvestRowsSell[i].외국인투자자);
                row.기관계 = Math.Abs(unmodifiedInvestRowsBuy[i].기관계) + Math.Abs(unmodifiedInvestRowsSell[i].기관계);
                row.금융투자 = Math.Abs(unmodifiedInvestRowsBuy[i].금융투자) + Math.Abs(unmodifiedInvestRowsSell[i].금융투자);
                row.보험 = Math.Abs(unmodifiedInvestRowsBuy[i].보험) + Math.Abs(unmodifiedInvestRowsSell[i].보험);
                row.투신 = Math.Abs(unmodifiedInvestRowsBuy[i].투신) + Math.Abs(unmodifiedInvestRowsSell[i].투신);
                row.기타금융 = Math.Abs(unmodifiedInvestRowsBuy[i].기타금융) + Math.Abs(unmodifiedInvestRowsSell[i].기타금융);
                row.은행 = Math.Abs(unmodifiedInvestRowsBuy[i].은행) + Math.Abs(unmodifiedInvestRowsSell[i].은행);
                row.연기금등 = Math.Abs(unmodifiedInvestRowsBuy[i].연기금등) + Math.Abs(unmodifiedInvestRowsSell[i].연기금등);
                row.사모펀드 = Math.Abs(unmodifiedInvestRowsBuy[i].사모펀드) + Math.Abs(unmodifiedInvestRowsSell[i].사모펀드);
                row.국가 = Math.Abs(unmodifiedInvestRowsBuy[i].국가) + Math.Abs(unmodifiedInvestRowsSell[i].국가);
                row.기타법인 = Math.Abs(unmodifiedInvestRowsBuy[i].기타법인) + Math.Abs(unmodifiedInvestRowsSell[i].기타법인);
                row.내외국인 = Math.Abs(unmodifiedInvestRowsBuy[i].내외국인) + Math.Abs(unmodifiedInvestRowsSell[i].내외국인);
                row.Divide(Math.Max(1, unmodifiedInvestRowsBuy[i].Volume * 2));
                row.Multiply(100); // Make it percentage.
                ret.Add(row);
            }
            return ret;
        }


        /// <summary>
        /// In percentage. Thread-safe.
        /// </summary>
        public List<DirectionRow> GetDirectionRows(string ticker)
        {
            var unmodifiedInvestRowsBuy = _conn.GetUnmodifiedInvestRows(ticker, BuySell.Buy);
            var unmodifiedInvestRowsSell = _conn.GetUnmodifiedInvestRows(ticker, BuySell.Sell);
            var ret = new List<DirectionRow>();



            for (int i = 0; i < unmodifiedInvestRowsBuy.Count; i++)
            {
                var row = new DirectionRow();
                row.Date = unmodifiedInvestRowsBuy[i].Date;

                double f(Func<UnmodifiedInvestRow, long> func)
                {
                    long denominator = Math.Abs(func(unmodifiedInvestRowsBuy[i])) + Math.Abs(func(unmodifiedInvestRowsSell[i]));

                    // Prevent division by zero.
                    denominator = Math.Max(denominator, 1);

                    long numerator = Math.Abs(func(unmodifiedInvestRowsBuy[i])) - Math.Abs(func(unmodifiedInvestRowsSell[i]));
                    return (numerator / (double)denominator) * 100; // make it percentage
                }

                row.개인투자자 = f(x => x.개인투자자);
                row.외국인투자자 = f(x => x.외국인투자자);
                row.기관계 = f(x => x.기관계);
                row.금융투자 = f(x => x.금융투자);
                row.보험 = f(x => x.보험);
                row.투신 = f(x => x.투신);
                row.기타금융 = f(x => x.기타금융);
                row.은행 = f(x => x.은행);
                row.연기금등 = f(x => x.연기금등);
                row.사모펀드 = f(x => x.사모펀드);
                row.국가 = f(x => x.국가);
                row.기타법인 = f(x => x.기타법인);
                row.내외국인 = f(x => x.내외국인);
                ret.Add(row);
            }

            return ret;
        }


        /// <returns>true if <paramref name="actualPrice"/> meets the condition; otherwise, false. </returns>
        private static bool Compare(long searchPrice, SearchFilter searchFilter, double actualPrice)
        {
            if ((searchFilter & SearchFilter.OnlyEqualTo) == SearchFilter.OnlyEqualTo)
            {
                if (searchPrice == actualPrice)
                {
                    return true;
                }
            }

            if ((searchFilter & SearchFilter.OnlyGreaterThan) == SearchFilter.OnlyGreaterThan)
            {
                if (searchPrice < actualPrice)
                {
                    return true;
                }
            }

            if ((searchFilter & SearchFilter.OnlyLessThan) == SearchFilter.OnlyLessThan)
            {
                if (searchPrice > actualPrice)
                {
                    return true;
                }
            }

            return false;
        }

        



        ///<summary> Thread-safe. </summary>
        /// <param name="date">8 digits. yyyyMMdd format.</param>
        /// <returns>(price, ticker) ascending order.</returns>
        public List<TickerAndPrice> SearchByDateAndPrice(int date, long price, SearchFilter searchFilter)
        {
            var ret = new List<TickerAndPrice>();
            var allTickers = GetAllTickers();

            foreach (var ticker in allTickers)
            {
                double actualPrice = _conn.GetModifiedClosePrice(date, ticker);
                if (actualPrice == -1)
                {
                    continue;
                }
                if (Compare(price, searchFilter, actualPrice))
                {
                    var row = new TickerAndPrice();
                    row.Ticker = ticker;
                    row.Price = actualPrice;
                    ret.Add(row);
                }
            }

            ret.Sort((a, b) =>
            {
                int compareResult = a.Price.CompareTo(b.Price);
                if (compareResult == 0)
                {
                    return a.Ticker.CompareTo(b.Ticker);
                }
                return compareResult;
            });

            return ret;
        }


        /// <inheritdoc cref="SQLiteConnection3.GetAllTickers"/>
        public HashSet<string> GetAllTickers()
        {
            return _conn.GetAllTickers();
        }


        /// <inheritdoc cref="SQLiteConnection3.GetAllBojongRows(string)"/>
        public List<BojongRow> GetAllBojongRows(string ticker)
        {
            return _conn.GetAllBojongRows(ticker);
        }

        /// <inheritdoc cref="SQLiteConnection3.GetModifiedAverageTradePrices(string)"/>
        public List<ModifiedAverageTradePriceRow> GetModifiedAverageTradePrices(string ticker)
        {
            return _conn.GetModifiedAverageTradePrices(ticker);
        }

    }
}
