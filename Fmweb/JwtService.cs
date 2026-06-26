using JWT;
using JWT.Algorithms;
using JWT.Serializers;
using System.Security.Cryptography;

namespace Fmweb
{
    public class JwtService
    {
        private readonly RSA _privateKey;
        private readonly RSA _publicKey;
        private readonly IJwtAlgorithm _alg;
        private readonly IBase64UrlEncoder _urlEncoder;
        private readonly IJsonSerializer _serializer;
        private readonly IJwtEncoder _encoder;
        private readonly IDateTimeProvider _provider;
        private readonly IJwtValidator _validator;
        private readonly IJwtDecoder _decoder;

        public JwtService()
        {
            _privateKey = RSA.Create();
            // openssl genrsa -out privkey.pem
            string privkey = File.ReadAllText("privkey.pem");
            _privateKey.ImportFromPem(privkey);

            _publicKey = RSA.Create();
            // openssl rsa -in privkey.pem -pubout -out pubkey.pem
            string pubkey = File.ReadAllText("pubkey.pem");
            _publicKey.ImportFromPem(pubkey);

            _alg = new RS256Algorithm(_publicKey, _privateKey);
            _urlEncoder = new JwtBase64UrlEncoder();
            _serializer = new JsonNetSerializer();
            _encoder = new JwtEncoder(_alg, _serializer, _urlEncoder);
            _provider = new UtcDateTimeProvider();
            _validator = new JwtValidator(_serializer, _provider);
            _decoder = new JwtDecoder(_serializer, _validator, _urlEncoder, _alg);
        }


        public string Encode(Dictionary<string, object> payload)
        {
            string token = _encoder.Encode(payload, (string)null);
            return token;
        }

        public string Decode(string token)
        {
            return _decoder.Decode(token, true);
        }

    }
}
