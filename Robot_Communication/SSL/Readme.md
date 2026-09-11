# SSL Certificate
 
To create a self-signed SSL certificate, run:
 
```bash
node generate-ssl-cert.js
```
 
Then copy the generated `cert.pem` and `key.pem` to your nginx SSL folder, and point `ssl_certificate` / `ssl_certificate_key` in the `server` block above to their paths.
