# MediaMTX Video Streaming Setup

This document describes how to use **MediaMTX** to receive an RTSP video stream and provide it for WebRTC playback, including a setup with NAT.

## 1. Download MediaMTX

Download the latest MediaMTX release from the official GitHub repository:

[MediaMTX Releases](https://github.com/bluenviron/mediamtx/releases?utm_source=chatgpt.com)

Download the appropriate package for your operating system.

- **Windows:** `mediamtx.exe`
- **Ubuntu:** `mediamtx`

## 2. Configure MediaMTX

Edit `mediamtx.yml` before starting MediaMTX.

### NAT Configuration

If the MediaMTX server is behind NAT, add the **NAT-side IP address** to `webrtcAdditionalHosts`.

For example:

- Server IP in the robot network: `192.168.123.235`
- NAT-mapped IP: `192.168.207.161`

Set:

```yaml
webrtcAdditionalHosts: [192.168.207.161]
```

This allows WebRTC clients outside the robot network to discover the NAT-accessible address.

### NAT Port Forwarding

The following ports need to be forwarded through the NAT:

| Port | Protocol | Purpose |
|---:|:---:|---|
| `8554` | TCP | RTSP |
| `8119` | UDP | WebRTC media |

> Make sure the NAT/router forwards these ports to the MediaMTX server.

## 3. Start MediaMTX

### Windows

Double-click:

```text
mediamtx.exe
```

Alternatively, run it from PowerShell or Command Prompt:

```powershell
.\mediamtx.exe
```

### Ubuntu

Run:

```bash
./mediamtx
```

If necessary, make the binary executable first:

```bash
chmod +x mediamtx
./mediamtx
```


## 4. Streaming Architecture

The overall communication flow is:

```text
VR Camera
    │
    │ USB
    ▼
Video Capture PC / Jetson
    │
    │ RTSP / TCP
    ▼
MediaMTX
    │
    │ WebRTC / UDP
    ▼
WebRTC Client
```

When NAT is used:

```text
Robot
192.168.123.164
        │
        │
        ▼
MediaMTX Server
192.168.123.235
        │
        │ NAT
        ▼
NAT Address
192.168.207.161
        │
        │ WebRTC
        ▼
Remote WebRTC Client
```

## 5. Stream Video to MediaMTX

The video source should publish an **RTSP stream** to MediaMTX.

The following examples use:

```text
rtsp://192.168.123.235:8554/g1-vr180
```

as the RTSP stream URL, where `g1-vr180` is the video channel.

> **Recommendation:** For high-resolution video such as `2800 × 1400 @ 30 FPS`, use a PC equipped with an NVIDIA GPU when possible. Hardware H.264(AVC) or H.265(HEVC) encoding with NVENC can significantly reduce CPU usage.

---

### 5.1 Windows — FFmpeg + NVIDIA NVENC

On Windows, use FFmpeg with NVIDIA NVENC for hardware HEVC encoding.

```bash
ffmpeg -f dshow -video_size 2800x1400 -framerate 30 -i video="VR.Cam 02" `  -vf "format=nv12" `  -c:v hevc_nvenc -b:v 10M -g 30 -preset p5 -tune ll -rc vbr `  -f rtsp -rtsp_transport tcp rtsp://192.168.123.235:8554/g1-vr180
```

### Parameters

| Parameter | Description |
|---|---|
| `2800x1400` | Input resolution |
| `30` | Frame rate |
| `format=nv12` | Convert input to NV12 |
| `hevc_nvenc` | NVIDIA hardware HEVC(H.265) encoder |
| `10M` | Target bitrate: 10 Mbps |
| `-g 30` | Keyframe interval: 30 frames |
| `-tune ll` | Low-latency encoding |
| `-rtsp_transport tcp` | Use TCP for RTSP streaming |

To check encoder

```bash
ffmpeg -encoders | findstr nvenc
```

---

### 5.2 Jetson — GStreamer

On NVIDIA Jetson, GStreamer can use the hardware video encoder directly.

```bash
gst-launch-1.0 \
  v4l2src device=/dev/video0 \
  ! 'image/jpeg,width=2800,height=1400,framerate=30/1' \
  ! jpegdec \
  ! nvvidconv \
  ! 'video/x-raw(memory:NVMM),format=I420' \
  ! nvv4l2h264enc bitrate=10000000 iframeinterval=30 insert-sps-pps=true \
  ! h264parse \
  ! video/x-h264,stream-format=byte-stream,alignment=au \
  ! rtspclientsink \
  location=rtsp://192.168.123.235:8554/g1-vr180 \
  protocols=tcp
```

### Pipeline

The pipeline is:

```text
USB Camera
    ↓
v4l2src
    ↓
JPEG
    ↓
jpegdec
    ↓
nvvidconv
    ↓
I420 / NVMM
    ↓
NVIDIA H.264 Encoder
    ↓
H.264
    ↓
RTSP
    ↓
MediaMTX
```

### 5.3 Ubuntu — FFmpeg + NVIDIA NVENC

On an Ubuntu PC with an NVIDIA GPU:

```bash
ffmpeg \
  -f v4l2 \
  -input_format mjpeg \
  -video_size 2800x1400 \
  -framerate 30 \
  -i /dev/video0 \
  -vf "format=nv12" \
  -c:v h264_nvenc \
  -b:v 10M \
  -g 30 \
  -preset p5 \
  -tune ll \
  -rc vbr \
  -f rtsp \
  -rtsp_transport tcp \
  rtsp://192.168.123.235:8554/g1-vr180
```

## 6. Media Playback

This section describes how to test and access MediaMTX WebRTC streams from a local PC and from a VR device.

### 6.1 Test with the Web Player

The project provides two HTML files for testing:

* `player.html` — WebRTC player for testing a MediaMTX WHEP stream.
* `example.html` — Example implementation of the WebRTC signaling procedure.

Open `player.html` in a web browser and enter the WHEP URL of the stream.

### 6.2 Local Network

When the client and MediaMTX server are on the same network, the WHEP endpoint can be accessed directly:

```text
http://192.168.123.235:8889/g1-vr180/whep
```

where:

* `192.168.123.235` is the MediaMTX server.
* `8889` is the MediaMTX WebRTC HTTP port.
* `g1-vr180` is the MediaMTX stream path.
* `/whep` is the WHEP endpoint.

The direct URL is suitable for testing on the local network.

---

### 6.3 VR Device

When accessing the stream from a VR device, a **reverse proxy is recommended**.

In particular, if the WebXR application is served over HTTPS, the WebRTC endpoint should also be accessible through HTTPS. A reverse proxy such as Nginx can be used to provide the HTTPS endpoint and forward requests to MediaMTX.

It is also recommended to use a **dedicated domain or subdomain for the video streaming service**, rather than sharing the same path with other application components.

For example:

```text
https://192.168.123.235/vrstream/g1-vr180/whep
```

The request is forwarded by Nginx to:

```text
http://127.0.0.1:8889/g1-vr180/whep
```

---

### 6.4 Nginx Reverse Proxy Configuration

Add the following configuration to the Nginx configuration file:

```nginx
location ~ ^/vrstream/(?<channel>[a-zA-Z0-9_-]+)(?<path_extra>/.*)?$ {
    rewrite ^/vrstream/(.*)$ /$1 break;

    proxy_pass             http://127.0.0.1:8889;
    proxy_http_version     1.1;

    proxy_set_header       Upgrade           $http_upgrade;
    proxy_set_header       Connection        $connection_upgrade;
    proxy_set_header       Host              $host;
    proxy_set_header       X-Real-IP         $remote_addr;
    proxy_set_header       X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header       X-Forwarded-Proto $scheme;

    proxy_pass_header      Location;

    # CORS
    proxy_hide_header      Access-Control-Allow-Origin;
    add_header             Access-Control-Allow-Origin '*' always;
    add_header             Access-Control-Expose-Headers 'Location' always;
    add_header             Access-Control-Allow-Headers 'Content-Type, Authorization' always;
    add_header             Access-Control-Allow-Methods 'GET, POST, OPTIONS, PATCH, DELETE' always;

    # CORS preflight
    if ($request_method = 'OPTIONS') {
        return 204;
    }
}
```

After modifying the configuration, check the Nginx configuration:

```bash
sudo nginx -t
```

If the configuration is valid, reload Nginx:

```bash
sudo systemctl reload nginx
```

If necessary, check the Nginx status:

```bash
sudo systemctl status nginx
```

---

### 6.5 WebRTC Stream URL

After configuring the reverse proxy, the WHEP endpoint can be accessed through the Nginx HTTPS endpoint:

```text
https://192.168.123.235/vrstream/g1-vr180/whep
```

The URL structure is:

```text
https://<server>/vrstream/<stream-path>/whep
```

For example:

```text
https://192.168.123.235/vrstream/g1-vr180/whep
```

corresponds to the MediaMTX endpoint:

```text
http://127.0.0.1:8889/g1-vr180/whep
```

### 6.6 Recommended Architecture

The complete playback architecture is:

```text
                         Local Network

Camera
   │
   │ RTSP
   ▼
MediaMTX
192.168.123.235:8554
   │
   │ WebRTC / WHEP
   ▼
player.html / WebXR
192.168.123.235:8889
```

For VR devices using HTTPS:

```text
Camera
   │
   │ RTSP
   ▼
MediaMTX
192.168.123.235
   │
   │ HTTP :8889
   ▼
Nginx Reverse Proxy
   │
   │ HTTPS :443
   ▼
https://<server>/vrstream/g1-vr180/whep
   │
   ▼
VR Device / WebXR
```

The reverse proxy therefore provides a single HTTPS endpoint for the WebXR client while MediaMTX remains responsible for WebRTC stream handling.

