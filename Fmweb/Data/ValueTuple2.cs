// First write: 2026-06-22
// Author: nsb
// Struct "System.ValueTuple" is not supported in versions .NET Framework 4.7 and below.
// To support versions .NET Framework 4.7 and below, use ValueTuple2.

namespace Fmweb.Data
{
    public struct ValueTuple2<T1, T2>
    {
        public T1 Item1;
        public T2 Item2;
        public ValueTuple2(T1 t1, T2 t2)
        {
            Item1 = t1;
            Item2 = t2;
        }
    }
    public struct ValueTuple2<T1, T2, T3>
    {
        public T1 Item1;
        public T2 Item2;
        public T3 Item3;
        public ValueTuple2(T1 t1, T2 t2, T3 t3)
        {
            this.Item1 = t1;
            this.Item2 = t2;
            this.Item3 = t3;
        }
    }
}
