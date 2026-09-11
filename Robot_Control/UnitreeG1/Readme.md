# Start Robot Control

## 1. Access the Robot

```bash
ssh unitree@192.168.123.164
```

> The robot's IP may occasionally be reassigned by the router's DHCP. If you can't connect, check the device list on the router's admin page to find the current IP.

## 2. Start the MQTT Client

See [MQTT Client](/Robot_Communication/MQTT/MQTT_Client/py) for details.

```bash
python MQTT_Client.py
```

## 3. Start Robot Arm Control

```bash
python G1_arm_control.py
```

## 4. Start Robot Hand Control

```bash
python G1_hand_control.py
```

> Note: in this study, the lower limb is not included in the low-level controller.

## 5. Stream the Camera

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
