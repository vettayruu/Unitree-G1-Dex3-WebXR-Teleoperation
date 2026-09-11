# Build Your Reverse Proxy

This repository uses **Nginx** as the reverse proxy. Both Windows and Ubuntu can run Nginx.

## Installation and Setup on Windows

1. Download [nginx for Windows](https://nginx.org/en/download.html) and extract it, e.g. to `C:\Program Files\nginx-1.30.2`.

2. Open the configuration file `.\conf\nginx.conf` and add a proxy block inside the `http { ... }` section (see [Reverse Proxy Configuration](#reverse-proxy-configuration) below).

3. Start nginx:

    Double click the nginx icon to start.

    To kill the process:

    ```bash
    taskkill /f /im nginx.exe
    ```

📄 [Reference config file (Windows)](/Robot_Communication/Setting/Windows/nginx.conf)

## Installation and Setup on Ubuntu

1. Install nginx:

    ```bash
    sudo apt update
    sudo apt install nginx -y
    ```

2. Open the configuration file:

    ```bash
    sudo nano /etc/nginx/nginx.conf
    ```

3. Add the reverse proxy block (see [Reverse Proxy Configuration](#reverse-proxy-configuration) below), then test the config for syntax errors before applying it:

    ```bash
    sudo nginx -t
    ```

4. Reload nginx to apply changes:

    ```bash
    sudo systemctl reload nginx
    ```

5. Start / stop / restart the service as needed:

    ```bash
    sudo systemctl start nginx
    sudo systemctl stop nginx
    sudo systemctl restart nginx
    ```

📄 [Reference config file (Ubuntu)](/Robot_Communication/Setting/Ubuntu/nginx.conf)

## Reverse Proxy Configuration

Add a `server` block inside `http { ... }` to proxy requests to the target service, e.g.:

```nginx
server {
    listen 443 ssl;
    server_name your_server_ip_or_domain;

    location /your-path/ {
        proxy_pass http://target_ip:target_port/;
    }
}
```
