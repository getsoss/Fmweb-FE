namespace Fmweb
{
    public class FmService
    {
        private readonly FmRepository _repo;
        public FmService()
        {
            _repo = new FmRepository();
        }

        public IResult Opt10081()
        {
            return Results.Ok();
        }
    }
}
