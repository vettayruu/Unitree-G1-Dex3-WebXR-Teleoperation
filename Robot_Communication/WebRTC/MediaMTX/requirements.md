# MediaMTX Video Streaming Requirenemts

This document describes how to use MediaMTX to receive an RTSP video stream and provide it for WebRTC playback, including a setup with NAT.

## 1. Prerequisites

The following tools may be required depending on your platform:

- **MediaMTX** — RTSP/WebRTC streaming server
- **FFmpeg** — Video capture, encoding, and RTSP streaming
- **GStreamer** — Recommended for video streaming on NVIDIA Jetson

---

## 2. Install MediaMTX

Download MediaMTX from the official GitHub releases page:

[MediaMTX Releases](https://github.com/bluenviron/mediamtx/releases?utm_source=chatgpt.com)

Download the appropriate package for your operating system.

### Windows

Download and extract the Windows package. The directory should contain:

```text
mediamtx.exe
mediamtx.yml
```

No installation is required.

### Ubuntu

Download and extract the Linux package, then make it executable:

```bash
chmod +x mediamtx
```

---

# 3. Install FFmpeg

FFmpeg is used for video capture, encoding, RTSP streaming, and stream testing.

## 3.1 Windows

Open the terminal as administrator, and install ffmpeg with choco

```bash
choco install ffmpeg
```

Check [Download FFmpeg](https://ffmpeg.org/download.html#build-windows) for more details.

Verify the installation:

```bash
ffmpeg -version
```

You can also check whether NVIDIA NVENC encoding is available:

```bash
ffmpeg -encoders | findstr nvenc
```

The following encoder should be available:

```text
 V....D av1_nvenc            NVIDIA NVENC av1 encoder (codec av1)
 V....D h264_nvenc           NVIDIA NVENC H.264 encoder (codec h264)
 V....D hevc_nvenc           NVIDIA NVENC hevc encoder (codec hevc)
```

Check available cameras:

```bash
ffmpeg -list_devices true -f dshow -i dummy
```

Check supported formats of a camera:

```bash
ffmpeg -f dshow -list_options true -i video="VR.Cam 02"
```

Replace `VR.Cam 02` with the actual camera name.

---

## 3.2 Ubuntu

Install FFmpeg:

```bash
sudo apt update
sudo apt install -y ffmpeg
```

Verify the installation:

```bash
ffmpeg -version
```

List available video devices:

```bash
ls /dev/video*
```

You can also use:

```bash
v4l2-ctl --list-devices
```

Install `v4l-utils` if `v4l2-ctl` is not available:

```bash
sudo apt install -y v4l-utils
```

Check the supported camera formats:

```bash
v4l2-ctl -d /dev/video0 --list-formats-ext
```

Check whether NVIDIA NVENC is available:

```bash
ffmpeg -encoders | grep nvenc
```

You should see:

```text
h264_nvenc
```

If `h264_nvenc` is not available, the installed FFmpeg build may not include NVIDIA NVENC support.

---

# 4. Install GStreamer

GStreamer is recommended for NVIDIA Jetson because it can directly use NVIDIA hardware acceleration.

## 4.1 Install GStreamer on Jetson

Install the required packages:

```bash
sudo apt update
sudo apt install -y gstreamer1.0-tools gstreamer1.0-plugins-good
```

Verify the installation:

```bash
gst-launch-1.0 --version
```

Check whether the NVIDIA H.264 encoder is available:

```bash
gst-inspect-1.0 nvv4l2h264enc
```

Check whether the RTSP client sink is available:

```bash
gst-inspect-1.0 rtspclientsink
```

Check the USB camera:

```bash
v4l2-ctl --list-devices
```

Check supported camera formats:

```bash
v4l2-ctl -d /dev/video0 --list-formats-ext
```
