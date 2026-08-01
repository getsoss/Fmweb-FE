namespace Fmweb
{
    internal class RsRow
    {
        public int Date;
        public double Rs;


        public object[] ToObjects()
        {
            return new object[2] { Date, Rs };
        }

    }
}
