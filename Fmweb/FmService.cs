namespace Fmweb
{
    public class FmService
    {
        private readonly FmRepository _repo;

        public FmService()
        {
            _repo = new FmRepository();
        }

        
        public List<ModifiedCandle> GetModifiedCandles(string ticker)
        {
            return _repo.GetModifiedCandles(ticker);
        }

        public HashSet<string> GetAllTickers()
        {
            return _repo.GetAllTickers();
        }


        public List<BojongRow> ReadAllBojongRows(string ticker)
        {
            return _repo.ReadAllBojongRows(ticker);
        }

    }
}
