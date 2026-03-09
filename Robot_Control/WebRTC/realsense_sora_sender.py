import cv2
import time
from Robot_Control.WebRTC.WebRTC_Client import StereoSender

signaling_urls = ["wss://sora2.uclab.jp/signaling"]
left_channel = "sora_liust_left"
right_channel = "sora_liust_right"

# Open the ZED camera
cap = cv2.VideoCapture(6)
if cap.isOpened() == 0:
    exit(-1)

webrtc = StereoSender(signaling_urls, left_channel, right_channel)
webrtc.initialize_sora_connections()

# connect once
webrtc.sub_sendonly.connect()

# Set the video resolution to HD720 (2560*720)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

frame_count = 0
fps = 0
prev_time = time.time()

while True :
    # Get a new frame from camera
    retval, frame = cap.read()
    frame_count += 1
    if time.time() - prev_time > 1.0:
        fps = frame_count
        frame_count = 0
        prev_time = time.time()
    cv2.putText(frame, f"fps: {fps}", (20, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
    # Display images
    # cv2.imshow("frame", frame)
    webrtc.send_subcam_frames(frame)
    # cv2.imshow("left", frame)
    if cv2.waitKey(1) >= 0 :
        break

exit(0)