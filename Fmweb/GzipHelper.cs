using System.IO.Compression;
using System.Text;

namespace Fmweb
{
    public static class GzipHelper
    {
        // Source - https://stackoverflow.com/a/7343623
        // Posted by xanatos, modified by community. See post 'Timeline' for change history
        // Retrieved 2026-06-08, License - CC BY-SA 3.0


        public static byte[] Zip(string str)
        {
            byte[] bytes = Encoding.UTF8.GetBytes(str);

            using (MemoryStream msi = new MemoryStream(bytes))
            using (MemoryStream mso = new MemoryStream())
            {
                using (GZipStream gs = new GZipStream(mso, CompressionMode.Compress))
                {
                    msi.CopyTo(gs);
                }

                return mso.ToArray();
            }
        }

        public static string Unzip(byte[] bytes)
        {
            using (MemoryStream msi = new MemoryStream(bytes))
            using (MemoryStream mso = new MemoryStream())
            {
                using (GZipStream gs = new GZipStream(msi, CompressionMode.Decompress))
                {
                    gs.CopyTo(mso);
                }

                return Encoding.UTF8.GetString(mso.ToArray());
            }
        }

    }
}
