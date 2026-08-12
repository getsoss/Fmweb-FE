namespace Fmweb.Data
{
    internal class TickerAndPrice
    {
        public string Ticker;
        public double Price;
        public object[] ToObjects()
        {
            return new object[2] { Ticker, Price };
        }
    }
}
