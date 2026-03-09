import time
import threading
import cv2
import numpy as np
from Robot_Control.WebRTC.media_sendonly import Sendonly

import json
from Robot_Control.WebRTC.messaging import Messaging
import multiprocessing.shared_memory as sm

class StereoSender:
    """ZED Miniの両目映像をSoraに同時送信するクラス"""
    def __init__(self, signaling_urls: list[str], left_channel: str, right_channel: str):
        self.signaling_urls = signaling_urls
        self.left_channel = left_channel
        self.right_channel = right_channel
        self.subcam_channel = 'sora_liust_sub'

        # 各目の最新フレーム
        self.latest_left_frame = None
        self.latest_right_frame = None
        self.frame_lock = threading.Lock()

        # 各目のSora接続
        self.left_sendonly = None
        self.right_sendonly = None
        self.sub_sendonly = None

    def initialize_sora_connections(self):
        """左目と右目のSora接続を初期化"""
        print("Sora接続を初期化中...")

        # 左目接続
        self.left_sendonly = Sendonly(
            signaling_urls=self.signaling_urls,
            channel_id=self.left_channel,
            video=True,
            audio=False,
            video_codec_type="VP8",
            video_bit_rate=5000,
        )

        # 右目接続
        self.right_sendonly = Sendonly(
            signaling_urls=self.signaling_urls,
            channel_id=self.right_channel,
            video=True,
            audio=False,
            video_codec_type="VP8",
            video_bit_rate=5000,
        )

        self.sub_sendonly = Sendonly(
            signaling_urls=self.signaling_urls,
            channel_id=self.subcam_channel,
            video=True,
            audio=False,
            video_codec_type="VP8",
            video_bit_rate=5000,
        )

        print(f"  左目チャンネル: {self.left_channel}")
        print(f"  右目チャンネル: {self.right_channel}")

    def start_capture(self):
        """ZED映像キャプチャを開始"""
        self.running = True
        self.capture_thread = threading.Thread(target=self._uvc_capture_loop, daemon=True)
        self.capture_thread.start()
        print("ZED両目映像キャプチャを開始しました")

    def _uvc_capture_loop(self):
        cap = cv2.VideoCapture(0)
        if cap.isOpened() == 0:
            exit(-1)

        # Set the video resolution to HD720 (2560*720)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 2560)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

        while True:
            # Get a new frame from camera
            retval, frame = cap.read()
            # Extract left and right images from side-by-side
            left_right_image = np.split(frame, 2, axis=1)

            left_image = left_right_image[0]
            right_image = left_right_image[1]

            with self.frame_lock:
                self.latest_left_frame = left_image.copy()
                self.latest_right_frame = right_image.copy()


    def get_frames(self):
        """最新の左目・右目フレームを取得"""
        with self.frame_lock:
            left_frame = self.latest_left_frame.copy() if self.latest_left_frame is not None else None
            right_frame = self.latest_right_frame.copy() if self.latest_right_frame is not None else None
            return left_frame, right_frame

    def prepare(self):
        """Initialize everything except the send loop"""
        self.initialize_sora_connections()
        self.start_capture()
        time.sleep(1)

        print("Connecting to Sora...")
        self.left_sendonly.connect()
        self.right_sendonly.connect()
        print("ZED stereo sender ready.")

    def send_frames(self, left_frame, right_frame):
        """Send user-provided frames (from outside)"""
        if self.left_sendonly is None or self.right_sendonly is None:
            raise RuntimeError(
                "Sora connections not initialized. Call initialize_sora_connections() and connect() first.")

        if left_frame is not None and right_frame is not None:
            self.left_sendonly._video_source.on_captured(left_frame)
            self.right_sendonly._video_source.on_captured(right_frame)
            return True
        return False

    def send_subcam_frames(self, subcam_frame):
        """Send user-provided frames (from outside)"""
        if self.sub_sendonly is None:
            raise RuntimeError(
                "Sora connections not initialized. Call initialize_sora_connections() and connect() first.")

        if subcam_frame is not None:
            self.sub_sendonly._video_source.on_captured(subcam_frame)
            return True
        return False

    def run(self, duration_seconds=0):
        """両目映像送信を実行"""
        print("ZED ステレオ映像送信を開始します")
        print(f"左目チャンネル: {self.left_channel}")
        print(f"右目チャンネル: {self.right_channel}")

        if duration_seconds == 0:
            print("送信時間: 無制限 (Ctrl+Cで停止)")
        else:
            print(f"送信時間: {duration_seconds}秒")

        print("=" * 60)

        try:
            # Sora接続初期化
            self.initialize_sora_connections()

            # キャプチャ開始
            self.start_capture()
            time.sleep(1)  # フレームが準備されるまで待機

            # 両方のSora接続を開始
            print("Soraサーバーに接続中...")
            self.left_sendonly.connect()
            self.right_sendonly.connect()

            print("両目映像送信を開始します")
            print("=" * 50)
            print(f"左目チャンネル: {self.left_channel}")
            print(f"右目チャンネル: {self.right_channel}")
            print("=" * 50)

            # 映像送信ループ
            start_time = time.time()
            sent_frames = 0

            if duration_seconds == 0:
                # 無制限送信
                while True:
                    left_frame, right_frame = self.get_frames()
                    sent_frames += 1

                    if left_frame is not None and right_frame is not None:
                        self.left_sendonly._video_source.on_captured(left_frame)
                        self.right_sendonly._video_source.on_captured(right_frame)

                    time.sleep(0.005)  # MAX 100FPS
            else:
                # 指定時間送信
                while time.time() - start_time < duration_seconds:
                    left_frame, right_frame = self.get_frames()

                    if left_frame is not None and right_frame is not None:
                        self.left_sendonly._video_source.on_captured(left_frame)
                        self.right_sendonly._video_source.on_captured(right_frame)
                        sent_frames += 1

                        # 5秒ごとに進捗表示
                        if sent_frames % 500 == 0:
                            elapsed = time.time() - start_time
                            # yolo_pose.record(left_frame, right_frame)
                            print(f"ステレオ送信中... {elapsed:.1f}秒経過 (送信フレーム数: {sent_frames})")

                    time.sleep(0.008)  # MAX 120FPS

            print(f"ステレオ映像送信完了! 総送信フレーム数: {sent_frames}")

        except KeyboardInterrupt:
            elapsed = time.time() - start_time if 'start_time' in locals() else 0
            hours = int(elapsed // 3600)
            minutes = int((elapsed % 3600) // 60)
            seconds = int(elapsed % 60)
            print(f"\nユーザーによって中断されました")
            print(f"送信時間: {hours:02d}:{minutes:02d}:{seconds:02d}")
            print(f"総送信フレーム数: {sent_frames if 'sent_frames' in locals() else 0}")
        except Exception as e:
            print(f"エラーが発生しました: {e}")
        finally:
            self.cleanup()

        return True

    def cleanup(self):
        """リソースのクリーンアップ"""
        print("ステレオ送信クリーンアップ中...")

        if self.left_sendonly:
            self.left_sendonly.disconnect()
        if self.right_sendonly:
            self.right_sendonly.disconnect()

        self.running = False
        if hasattr(self, 'capture_thread'):
            self.capture_thread.join(timeout=5)

        print("ステレオ送信クリーンアップ完了")


class CustomMessaging(Messaging):
    """WebRTC → Shared Memory writer"""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.time_send = 0
        self.delay = 0
        self.sm = None
        self.pose = None
        self.vr_time_offset = 0

    def _on_message(self, label: str, data: bytes):
        """Called automatically whenever WebRTC receives data."""
        try:
            message = json.loads(data.decode('utf-8'))

            # timestamp
            send_ts = message.get("timestamp", None)
            self.time_send = send_ts
            if send_ts is not None:
                recv_ts = int(time.time() * 1000)
                self.delay = recv_ts - (send_ts + self.vr_time_offset)

            # joint (continuous write to shared memory)
            joint = message.get("joint", None)
            if joint is not None and self.pose is not None:
                # Write joint into shared memory
                # Example: place in position 8:14 (6 DOF)
                self.pose[8:14] = joint

        except Exception as e:
            print("JSON error:", e)

    def create_shared_memory(self, name_shared_memory="piper_pose"):
        """Create or attach to shared memory buffer."""
        try:
            self.sm = sm.SharedMemory(name=name_shared_memory, create=True, size=16 * 4)
            print("Shared memory created")
        except FileExistsError:
            self.sm = sm.SharedMemory(name=name_shared_memory)
            print("Shared memory attached")

        # Create numpy view
        self.pose = np.ndarray((16,), dtype=np.float32, buffer=self.sm.buf)
        self.pose[:] = 0

    def set_vr_time_offset(self, timestamp):
        self.vr_time_offset = timestamp