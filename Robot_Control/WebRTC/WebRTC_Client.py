import time
from WebRTC.media_sendonly import Sendonly


class StereoSender:
    def __init__(self, signaling_urls: list[str], left_channel: str, right_channel: str):
        self.configs = {
            "signaling_urls": signaling_urls,
            "video": True,
            "audio": False,
            "video_codec_type": "VP8",  # 如果 Quest 3 延迟高，建议尝试 H264
            "video_bit_rate": 5000,
        }

        self.left_sendonly = Sendonly(channel_id=left_channel, **self.configs)
        self.right_sendonly = Sendonly(channel_id=right_channel, **self.configs)
        self._is_connected = False

        self.left_channel = left_channel
        self.right_channel = right_channel

    def connect(self):
        try:
            print(f"Connecting to Sora: {self.left_channel} & {self.right_channel}")
            self.left_sendonly.connect()
            self.right_sendonly.connect()
            self._is_connected = True
            return True
        except Exception as e:
            print(f"Connection failed: {e}")
            return False

    def send_frames(self, left_frame, right_frame):
        try:
            if left_frame is not None and right_frame is not None:
                self.left_sendonly._video_source.on_captured(left_frame)
                self.right_sendonly._video_source.on_captured(right_frame)
                return True
        except Exception as e:
            print(f"Send frame error: {e}")
        return False

    def cleanup(self):
        print("Cleaning up WebRTC connections...")
        try:
            if self.left_sendonly:
                self.left_sendonly.disconnect()
            if self.right_sendonly:
                self.right_sendonly.disconnect()
        except Exception as e:
            print(f"Error during cleanup: {e}")
        finally:
            self._is_connected = False
            print("WebRTC Connections closed.")


import json
from WebRTC.messaging import Messaging
import multiprocessing.shared_memory as sm
import numpy as np

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