import cv2
import time
from WebRTC.WebRTC_Client import StereoSender

SIGNALING_URLS = ["wss://sora2.uclab.jp/signaling"]
LEFT_CHANNEL = "sora_liust_left"
RIGHT_CHANNEL = "sora_liust_right"
WIDTH, HEIGHT = 1920 * 2, 1080
MID = WIDTH // 2

def main():
    cap = cv2.VideoCapture(1)
    if not cap.isOpened():
        print("Error: Could not open camera.")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, HEIGHT)

    webrtc = StereoSender(SIGNALING_URLS, LEFT_CHANNEL, RIGHT_CHANNEL)
    webrtc.connect()

    try:
        frame_count = 0
        fps = 0
        prev_time = time.time()

        while True:
            retval, frame = cap.read()
            if not retval or frame is None:
                print("Failed to grab frame.")
                break

            left_image = frame[:, :MID]
            right_image = frame[:, MID:]

            frame_count += 1
            curr_time = time.time()
            elapsed = curr_time - prev_time
            if elapsed >= 1.0:
                fps = frame_count / elapsed
                frame_count = 0
                prev_time = curr_time

            cv2.putText(left_image, f"FPS: {fps:.1f}", (20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 2)

            webrtc.send_frames(left_image, right_image)

    except Exception as e:
        print(f"An error occurred: {e}")

    finally:
        webrtc.cleanup()
        cap.release()

if __name__ == "__main__":
    main()
