namespace Fmweb
{
    public class FmController
    {
        private readonly FmService _serv;
        public FmController()
        {
            _serv = new FmService();
        }
    }
}
