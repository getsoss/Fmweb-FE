namespace Fmweb
{
    public class FmService
    {
        private readonly FmRepository _repo;
        public FmService()
        {
            _repo = new FmRepository();
        }
    }
}
