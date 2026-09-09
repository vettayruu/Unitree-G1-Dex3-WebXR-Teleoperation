Download Meida MTX from https://github.com/bluenviron/mediamtx

If use NAT, change `webrtcAdditionalHosts` in mediamtx.yml, for example the server IP in robot network is `192.168.123.235`, and the NAT net is `192.168.207.161`: 

```bash
webrtcAdditionalHosts: [192.168.207.161]
```

Run the MediaMTX, double click mediamtx.exe on Windows or ./mediamtx on Ubuntu

Stream your video, it is recommand to use PC with Nvida GPU

On windows

```bash
ffmpeg -f dshow -video_size 2800x1400 -framerate 30 -i video="VR.Cam 02" `  -vf "format=nv12" `  -c:v h264_nvenc -b:v 10M -g 30 -preset p5 -tune ll -rc vbr `  -f rtsp -rtsp_transport tcp rtsp://192.168.123.235:8554/g1-vr180
```

On Jetson 
```bash
gst-launch-1.0 v4l2src device=/dev/video0 ! 'image/jpeg,width=2800,height=1400,framerate=30/1' ! jpegdec ! nvvidconv ! 'video/x-raw(memory:NVMM),format=I420' ! nvv4l2h264enc bitrate=10000000 iframeinterval=30 insert-sps-pps=true ! h264parse ! video/x-h264,stream-format=byte-stream,alignment=au ! rtspclientsink location=rtsp://192.168.123.235:8554/g1-vr180 protocols=tcp
```

