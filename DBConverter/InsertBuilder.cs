using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBConverter
{
    internal class InsertBuilder
    {
        private const int DECOMPOSITION = 2000;
        private string _insertIntoTableValues;
        private readonly List<string> _values;

        public InsertBuilder()
        {
            _values = new List<string>();
        }

        public void SetInsertIntoTableValues(string insertIntoTableValues)
        {
            _insertIntoTableValues = insertIntoTableValues;
        }

        public void AddValues(string values)
        {
            _values.Add(values);
        }

        public List<string> GetCommandTexts()
        {
            List<string> ret = new List<string>();
            StringBuilder sb = new StringBuilder();

            for (int idxBegin = 0; idxBegin < _values.Count; idxBegin += DECOMPOSITION)
            {
                int idxEnd = Math.Min(_values.Count, idxBegin + DECOMPOSITION);
                sb.Clear();
                sb.Append(_insertIntoTableValues);
                for(int j = idxBegin; j < idxEnd; j++)
                {
                    if(j > idxBegin)
                    {
                        sb.Append(',');
                    }
                    sb.Append(_values[j]);
                }
                ret.Add(sb.ToString());
            }

            return ret;
        }

    }
}
