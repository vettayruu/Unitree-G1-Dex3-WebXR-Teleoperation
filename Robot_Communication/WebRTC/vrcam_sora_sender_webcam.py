import cv2
import time
from WebRTC_Client import StereoSender, WebCamSender

SIGNALING_URLS = ["wss://sora2.uclab.jp/signaling"]
CHANNEL = "g1-vr180"
WIDTH, HEIGHT = 2880*2, 1620

def main():
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open camera.")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, HEIGHT)

    webrtc = WebCamSender(SIGNALING_URLS, CHANNEL)
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

            # ts = int(time.time()*1000)
            ts = time.time()*1000
            cv2.putText(frame, f"TS: {ts}", (20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 2)

            frame_count += 1
            curr_time = time.time()
            elapsed = curr_time - prev_time
            if elapsed >= 1.0:
                fps = frame_count / elapsed
                frame_count = 0
                prev_time = curr_time

            cv2.putText(frame, f"FPS: {fps:.1f}", (20, 80),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 2)
            # Option
            # cv2.imshow("frame", frame)
            
            webrtc.send_frames(frame)

            time.sleep(0.010)
            if cv2.waitKey(1) >= 0:
                break

    except Exception as e:
        print(f"An error occurred: {e}")

    finally:
        webrtc.cleanup()
        cap.release()

if __name__ == "__main__":
    main()
