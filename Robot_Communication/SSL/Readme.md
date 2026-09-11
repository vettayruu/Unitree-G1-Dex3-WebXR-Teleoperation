# SSL Certificate
 
To create a self-signed SSL certificate, run:
 
```bash
node generate-ssl-cert.js
```
 
Then copy the generated `cert.pem` and `key.pem` to your nginx SSL folder, and point `ssl_certificate` / `ssl_certificate_key` in the `server` block above to their paths.

```bash
sudo mkdir -p /etc/nginx/ssl
sudo cp cert.pem key.pem /etc/nginx/ssl/
```

Since Nginx handles all proxying behind a single certificate, you only need to trust/accept it once — when first opening the teleoperation app's webpage.
