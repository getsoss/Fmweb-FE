namespace Fmweb.Data
{
    internal class TickerAndScore
    {
        public string Ticker;
        public double Score;

        public TickerAndScore(string ticker, double score)
        {
            Ticker = ticker;
            Score = score;
        }

        public object[] ToObjects()
        {
            return new object[2] { Ticker, Score };
        }

    }
}
