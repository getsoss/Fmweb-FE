using System;

namespace Fmweb
{
    internal class DateNotFoundException:Exception
    {
        public int Date;

        public DateNotFoundException(int date)
        {
            Date = date;
        }

    }
}
