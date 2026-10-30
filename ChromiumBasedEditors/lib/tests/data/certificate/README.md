Test certificate and key for `certificatecheck_test.cpp`, generated once with:

```
openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 36500 -subj "/CN=Euro-Office unit test"
openssl pkey -in key.pem -aes256 -passout pass:secret -out key_encrypted.pem
openssl pkcs12 -export -inkey key.pem -in cert.pem -passout pass:secret -out cert_and_key.p12
openssl x509 -in cert.pem -outform DER -out cert.der
```

They exist only for these tests and protect nothing.
