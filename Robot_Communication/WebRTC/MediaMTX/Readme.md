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

## 4. Stream Video to MediaMTX

The video source should publish an **RTSP stream** to MediaMTX.

The following examples use:

```text
rtsp://192.168.123.235:8554/g1-vr180
```

as the RTSP stream URL, where `g1-vr180` is the video channel.

> **Recommendation:** For high-resolution video such as `2800 × 1400 @ 30 FPS`, use a PC equipped with an NVIDIA GPU when possible. Hardware H.264 encoding with NVENC can significantly reduce CPU usage.

---

## 5. Windows — FFmpeg + NVIDIA NVENC

On Windows, use FFmpeg with NVIDIA NVENC for hardware H.264 encoding.

```bash
ffmpeg -f dshow -video_size 2800x1400 -framerate 30 -i video="VR.Cam 02" `  -vf "format=nv12" `  -c:v h264_nvenc -b:v 10M -g 30 -preset p5 -tune ll -rc vbr `  -f rtsp -rtsp_transport tcp rtsp://192.168.123.235:8554/g1-vr180
```

### Parameters

| Parameter | Description |
|---|---|
| `2800x1400` | Input resolution |
| `30` | Frame rate |
| `format=nv12` | Convert input to NV12 |
| `h264_nvenc` | NVIDIA hardware H.264 encoder |
| `10M` | Target bitrate: 10 Mbps |
| `-g 30` | Keyframe interval: 30 frames |
| `-tune ll` | Low-latency encoding |
| `-rtsp_transport tcp` | Use TCP for RTSP streaming |

---

## 6. Jetson — GStreamer

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

## 7. Ubuntu — FFmpeg + NVIDIA NVENC

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

## 8. Streaming Architecture

The overall data flow is:

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
Robot Network
192.168.123.0/24
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

## 9. Stream URL

The RTSP publishing URL is:

```text
rtsp://192.168.123.235:8554/g1-vr180
```

The path name is:

```text
g1-vr180
```

The same MediaMTX path can then be accessed by WebRTC clients through the MediaMTX WebRTC interface.

## 10. Troubleshooting

### RTSP connection fails

Check that MediaMTX is running and that port `8554/TCP` is reachable.

```bash
ffplay rtsp://192.168.123.235:8554/g1-vr180
```

### WebRTC handshake succeeds but no video is received

Check the following:

1. `webrtcAdditionalHosts` contains the NAT-accessible IP.
2. UDP port `8119` is forwarded to the MediaMTX server.
3. The firewall allows UDP traffic on port `8119`.
4. The RTSP publisher is still connected.
5. MediaMTX can successfully read the RTSP stream.

### Check the MediaMTX log

Keep the MediaMTX terminal open while testing. It can be used to verify:

- RTSP publisher connection
- stream path creation
- WebRTC client connection
- ICE candidate information
- connection/disconnection events
