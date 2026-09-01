import json
import time
import csv
from datetime import datetime
from pathlib import Path
import numpy as np
from paho.mqtt import client as mqtt
import multiprocessing.shared_memory as sm

import argparse
import os
from dotenv import load_dotenv
import threading

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
ROBOT_TYPE = os.getenv("ROBOT_TYPE", "Unitree-G1-Dex3")
ROBOT_UUID = os.getenv("ROBOT_UUID", "2A5PE-YUSHU008-LATENCY")

MQTT_MANAGE_TOPIC = os.getenv("MQTT_MANAGE_TOPIC", "sap")
MQTT_DEVICE_TOPIC = os.getenv("MQTT_DEVICE_TOPIC", "sap/dev")

MQTT_CTRL_TOPIC = os.getenv("MQTT_CTRL_TOPIC", "control")
MQTT_ROBOT_STATE_TOPIC = os.getenv("MQTT_ROBOT_STATE_TOPIC", "robot")

Register_TOPIC = os.getenv("REGISTER_TOPIC", "sap/register")
UnRegister_TOPIC = os.getenv("UnREGISTER_TOPIC", "sap/unregister")

# MQTT_LOCAL_SERVER = "liust.local"
# MQTT_LOCAL_PORT = 9001

MQTT_LOCAL_SERVER = "192.168.123.235"
MQTT_LOCAL_PORT = 9001

MQTT_UCLAB_SERVER = "santolina"
MQTT_UCLAB_PORT = 2218

LOG_DIR = Path(os.path.dirname(os.path.abspath(__file__))) / "logs"
RECORDS_DIR = LOG_DIR / "latency_records"
SUMMARY_LOG_PATH = LOG_DIR / "latency_summary.jsonl"

LOG_DIR.mkdir(parents=True, exist_ok=True)
RECORDS_DIR.mkdir(parents=True, exist_ok=True)

TIME_SYNC_ROUNDS = int(os.getenv("TIME_SYNC_ROUNDS", "8"))
TIME_SYNC_INTERVAL_SEC = float(os.getenv("TIME_SYNC_INTERVAL_SEC", "0.15"))
TIME_SYNC_TIMEOUT_SEC = float(os.getenv("TIME_SYNC_TIMEOUT_SEC", "1.0"))
TIME_SYNC_KEEP_RATIO = float(os.getenv("TIME_SYNC_KEEP_RATIO", "0.5"))


class SessionStats:
    def __init__(self):
        self.latency_records = []
        self.start_time = None
        self.has_generated = False

    def start(self):
        self.latency_records = []
        self.start_time = time.time()
        self.has_generated = False

    def record(self, latency):
        self.latency_records.append(latency)

    def generate_report(self, user_uuid):
        if self.has_generated:
            return
        if not user_uuid:
            user_uuid = "unknown_user"
        if not self.latency_records:
            print("\n📊 [Session Stats] No teleoperation data, cannot generate report.\n")
            return

        total_packets = len(self.latency_records)
        duration = time.time() - (self.start_time if self.start_time else time.time() - 1)

        arr = np.array(self.latency_records)
        mean_lat = np.mean(arr)
        std_lat = np.std(arr)
        max_lat = np.max(arr)
        min_lat = np.min(arr)

        p50 = np.percentile(arr, 50)
        p95 = np.percentile(arr, 95)
        p99 = np.percentile(arr, 99)

        session_end_iso = datetime.now().isoformat()

        print(f"\n" + "=" * 50)
        print(f" [Teleoperation Latency Result]")
        print(f" User UUID : {user_uuid}")
        print(f" Duration Time : {duration:.1f} 秒")
        print(f" Package Number : {total_packets} ")
        print("-" * 50)
        print(f" Mean / STDDEV : {mean_lat:.1f} ms / {std_lat:.1f} ms")
        print(f" Min / Max : {min_lat} ms / {max_lat} ms")
        print(f" P50 / P95 / P99 : {p50:.1f} ms / {p95:.1f} ms / {p99:.1f} ")
        print("=" * 50 + "\n")

        summary_record = {
            "user_uuid": user_uuid,
            "robot_uuid": ROBOT_UUID,
            "session_end": session_end_iso,
            "duration_sec": round(duration, 2),
            "total_packets": total_packets,
            "avg_hz": round(total_packets / duration, 2) if duration > 0 else 0,
            "mean_ms": round(float(mean_lat), 2),
            "std_ms": round(float(std_lat), 2),
            "min_ms": float(min_lat),
            "max_ms": float(max_lat),
            "p50_ms": round(float(p50), 1),
            "p95_ms": round(float(p95), 1),
            "p99_ms": round(float(p99), 1),
        }
        self._append_summary(summary_record)
        self._save_raw_records(user_uuid, session_end_iso)
        self.has_generated = True

    def _append_summary(self, record):
        try:
            with open(SUMMARY_LOG_PATH, "a", encoding="utf-8") as f:
                f.write(json.dumps(record, ensure_ascii=False) + "\n")
            print(f" Latency Data added to: {SUMMARY_LOG_PATH}")
        except Exception as e:
            print(f" ❌ Write data failed: {e}")

    def _save_raw_records(self, user_uuid, session_end_iso):
        safe_time = session_end_iso.replace(":", "-")
        filename = f"{user_uuid}_{safe_time}.csv"
        filepath = RECORDS_DIR / filename
        try:
            with open(filepath, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["packet_index", "latency_ms"])
                for idx, lat in enumerate(self.latency_records):
                    writer.writerow([idx, lat])
            print(f" Data saved to: {filepath}")
        except Exception as e:
            print(f"❌ Failed to save: {e}")


class LatencyMonitor:
    def __init__(self):
        self.last_packet_time = time.time()
        self.arrival_intervals = []

    def update(self):
        current_time = time.time()
        interval = (current_time - self.last_packet_time) * 1000  # 毫秒
        self.last_packet_time = current_time

        self.arrival_intervals.append(interval)
        if len(self.arrival_intervals) > 50:
            self.arrival_intervals.pop(0)

    def get_health_score(self):
        if not self.arrival_intervals:
            return "Control_Health: 100.0%"
        starved_packets = sum(1 for x in self.arrival_intervals if x > 150)
        health = (1.0 - (starved_packets / len(self.arrival_intervals))) * 100
        return f"Control_Health: {health:.1f}%"


def get_latency_bar(latency):
    max_expected = 200
    num_bars = int(min(max(0, latency), max_expected) / max_expected * 20)
    bar = "█" * num_bars + "░" * (20 - num_bars)

    if latency < 40:
        return f"\033[92m{int(latency):3d}ms {bar}\033[0m"  # 绿色
    elif latency < 100:
        return f"\033[93m{int(latency):3d}ms {bar}\033[0m"  # 黄色
    else:
        return f"\033[91m{int(latency):3d}ms {bar} [SPIKE!]\033[0m"  # 红色


class MQTT_Client():
    def __init__(self, MQTT_Mode):
        self.mode = MQTT_Mode

        self.client = None
        self.USER_UUID = None
        self.MQTT_CTRL_TOPIC = MQTT_CTRL_TOPIC
        self.MQTT_RECV_TOPIC = f"{MQTT_DEVICE_TOPIC}/{ROBOT_UUID}"

        self.MQTT_TIME_PING_TOPIC = f"{MQTT_MANAGE_TOPIC}/time/ping/{ROBOT_UUID}"
        self.MQTT_TIME_PONG_TOPIC = f"{MQTT_MANAGE_TOPIC}/time/pong/{ROBOT_UUID}"
        self.time_offset = 0
        self.latency = 0
        self.time_sync_success = False

        self._sync_round = 0
        self._sync_samples = []
        self._sync_pending_t0 = None
        self._sync_timer = None
        self._sync_lock = threading.Lock()

        self.monitor = LatencyMonitor()
        self.session_stats = SessionStats()

        self.left_arm_joints_ctrl = np.zeros(8)
        self.left_hand_joints_ctrl = np.zeros(8)
        self.right_arm_joints_ctrl = np.zeros(8)
        self.right_hand_joints_ctrl = np.zeros(8)
        self.waist_joints_ctrl = np.zeros(8)

        self.shm_handles = {}
        self.shm_arrays = {}
        self.shm_name_list = ['Left_Arm', 'Left_Hand', 'Right_Arm', 'Right_Hand', 'Waist']

    def _send_time_sync_ping(self):
        if self._sync_timer:
            self._sync_timer.cancel()
            self._sync_timer = None

        t0 = int(time.time() * 1000)
        with self._sync_lock:
            self._sync_pending_t0 = t0
        self.client.publish(self.MQTT_TIME_PING_TOPIC, json.dumps({"robot_t0": t0}), qos=1)
        # print(f"⏱️ [Round {self._sync_round + 1}/{TIME_SYNC_ROUNDS} ] Time Sync Request (t0={t0})...")

        self._sync_timer = threading.Timer(TIME_SYNC_TIMEOUT_SEC, self._on_sync_timeout)
        self._sync_timer.daemon = True
        self._sync_timer.start()

    def _on_sync_timeout(self):
        with self._sync_lock:
            still_pending = self._sync_pending_t0 is not None
        if still_pending:
            print(f"⚠️ [Round {self._sync_round + 1}/{TIME_SYNC_ROUNDS} ] Time Out...")
            self._send_time_sync_ping()

    def _finalize_time_sync(self):
        samples = sorted(self._sync_samples, key=lambda s: s[1])
        keep_n = max(1, int(len(samples) * TIME_SYNC_KEEP_RATIO))
        best_samples = samples[:keep_n]

        offsets = [s[0] for s in best_samples]
        rtts = [s[1] for s in best_samples]
        final_offset = sum(offsets) / len(offsets)

        self.time_offset = final_offset
        self.time_sync_success = True

        print(f"Mean RTT/2: {sum(rtts) / len(rtts) / 2:.1f}ms, Offset: {self.time_offset:.1f}ms "
              f"(RTT Range: {rtts[0]}ms ~ {rtts[-1]}ms)")

        print(f"Register Robot {ROBOT_UUID}")
        my_info = {
            "date": self.get_synced_datetime(),
            "devType": "robot",
            "type": ROBOT_TYPE,
            "version": "0.1.1",
            "devId": ROBOT_UUID,
            "optStr": "available",
        }
        self.client.publish(Register_TOPIC, json.dumps(my_info), qos=1)
        print("Robot Registered:", json.dumps(my_info))

    def on_connect(self, client, userdata, flags, reason_code, properties):
        if reason_code == 0:
            print("MQTT Connected successfully")

            self.client.subscribe(self.MQTT_TIME_PONG_TOPIC)
            with self._sync_lock:
                self._sync_round = 0
                self._sync_samples = []
                self._sync_pending_t0 = None
            self._send_time_sync_ping()

            self.client.subscribe(self.MQTT_RECV_TOPIC)
        else:
            print(f"Connect failed with code {reason_code}")

    def on_disconnect(self, client, userdata, flags, reason_code, properties):
        if reason_code == 0:
            print("✅ Disconnected successfully ")
        else:
            print(f"⚠️ Disconnected with code {reason_code}")

    def on_message(self, client, userdata, msg):
        if msg.topic == self.MQTT_TIME_PONG_TOPIC:
            try:
                t1 = int(time.time() * 1000)
                data = json.loads(msg.payload.decode())
                t0 = data.get("robot_t0")
                server_time = data.get("server_time")

                with self._sync_lock:
                    pending_t0 = self._sync_pending_t0

                if t0 is None or server_time is None or t0 != pending_t0:
                    return

                if self._sync_timer:
                    self._sync_timer.cancel()
                    self._sync_timer = None

                rtt = t1 - t0
                network_delay = rtt / 2
                calibrated_server_time = server_time + network_delay
                offset = calibrated_server_time - t1

                with self._sync_lock:
                    self._sync_samples.append((offset, rtt))
                    self._sync_pending_t0 = None
                    self._sync_round += 1
                    round_now = self._sync_round

                if round_now < TIME_SYNC_ROUNDS:
                    threading.Timer(TIME_SYNC_INTERVAL_SEC, self._send_time_sync_ping).start()
                else:
                    self._finalize_time_sync()

            except Exception as e:
                print(f"Time Sync Failed: {e}")
            return

        if msg.topic == self.MQTT_RECV_TOPIC:
            try:
                controller_msg = json.loads(msg.payload.decode())
                from_dev_id = controller_msg["devId"]

                if from_dev_id and from_dev_id != "unregister" and from_dev_id != self.USER_UUID:
                    print(f"\n------------------ {self.get_synced_datetime()} -------------------")
                    print(f"🎯 Capture New Control Request: {from_dev_id}")

                    if self.USER_UUID:
                        self.session_stats.generate_report(self.USER_UUID)
                        self.client.unsubscribe(self.MQTT_CTRL_TOPIC)

                    self.USER_UUID = from_dev_id
                    self.MQTT_CTRL_TOPIC = f"{MQTT_CTRL_TOPIC}/{self.USER_UUID}"

                    self.session_stats.start()

                    topics_to_sub = [self.MQTT_CTRL_TOPIC]
                    for t in topics_to_sub:
                        self.client.subscribe(t)
                        print(f"📡 Subscribe Control Topic: {t}")

                elif from_dev_id == "unregister":
                    if self.USER_UUID:
                        print(f"\n🔌 User {self.USER_UUID} requested UNREGISTER.")

                        self.session_stats.generate_report(self.USER_UUID)

                        self.client.unsubscribe(self.MQTT_CTRL_TOPIC)
                        self.USER_UUID = None
                        self.MQTT_CTRL_TOPIC = None

                        my_info = {
                            "date": self.get_synced_datetime(),
                            "devType": "robot",
                            "type": ROBOT_TYPE,
                            "version": "1.0.0",
                            "devId": ROBOT_UUID,
                            "optStr": "available",
                        }
                        self.client.publish(Register_TOPIC, json.dumps(my_info), qos=1)
                    return

            except Exception as e:
                print(f"❌ Subscribe {self.MQTT_RECV_TOPIC} failed: {e}")
            return

        try:
            if msg.topic == self.MQTT_CTRL_TOPIC:
                ctrl_msg = json.loads(msg.payload.decode())

                self.monitor.update()

                ctrl_header = ctrl_msg.get("header", {})
                if isinstance(ctrl_header, dict):
                    ctrl_timestamp = ctrl_header.get("time") or ctrl_header.get("timestamp")
                else:
                    ctrl_timestamp = ctrl_msg.get("time") or ctrl_msg.get("timestamp")

                if ctrl_timestamp:
                    if self.time_sync_success:
                        self.latency = self.get_synced_timestamp() - int(ctrl_timestamp)
                    else:
                        self.latency = int(time.time() * 1000) - int(ctrl_timestamp)

                    self.session_stats.record(self.latency)
                    bar_str = get_latency_bar(self.latency)
                    health_str = self.monitor.get_health_score()
                    print(f"\r📶 {bar_str} | {health_str}", end="", flush=True)

                self.left_arm_joints_ctrl[0:8] = ctrl_msg['left']['arm']
                self.left_hand_joints_ctrl[0:7] = ctrl_msg['left']['hand']
                self.right_arm_joints_ctrl[0:8] = ctrl_msg['right']['arm']
                self.right_hand_joints_ctrl[0:7] = ctrl_msg['right']['hand']
                self.waist_joints_ctrl[0:3] = ctrl_msg['waist']['joints']

                self.update_shm_ctrl("Left_Arm", self.left_arm_joints_ctrl)
                self.update_shm_ctrl("Left_Hand", self.left_hand_joints_ctrl)
                self.update_shm_ctrl("Right_Arm", self.right_arm_joints_ctrl)
                self.update_shm_ctrl("Right_Hand", self.right_hand_joints_ctrl)
                self.update_shm_ctrl("Waist", self.waist_joints_ctrl)

        except Exception as e:
            print(f"\n⚠️ Data Receive Error: {msg.topic}, {e}")

    def connect_mqtt(self):
        if self.mode == "local":
            self.client = mqtt.Client(
                callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
                transport="websockets"
            )
            self.client.on_connect = self.on_connect
            self.client.on_disconnect = self.on_disconnect
            self.client.on_message = self.on_message
            self.client.connect(MQTT_LOCAL_SERVER, MQTT_LOCAL_PORT, 60)
            self.client.loop_start()

        elif self.mode == "uclab":
            self.client = mqtt.Client(
                callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            )
            self.client.on_connect = self.on_connect
            self.client.on_disconnect = self.on_disconnect
            self.client.on_message = self.on_message
            self.client.connect(MQTT_UCLAB_SERVER, MQTT_UCLAB_PORT, 60)
            self.client.loop_start()

    def create_shared_memories(self):
        for name in self.shm_name_list:
            try:
                shm = sm.SharedMemory(name=name, create=True, size=16 * 4)
                print(f"✅ Shared memory '{name}' created.")
            except FileExistsError:
                shm = sm.SharedMemory(name=name)
                print(f"ℹ️ Shared memory '{name}' already exists, attached.")

            self.shm_handles[name] = shm
            self.shm_arrays[name] = np.ndarray((16,), dtype=np.float32, buffer=shm.buf)
            self.shm_arrays[name][:] = 0

    def update_shm_ctrl(self, name, target_data):
        if name in self.shm_arrays:
            target_array = np.array(target_data, dtype=np.float32).flatten()[:8]
            self.shm_arrays[name][0:8] = target_array
        else:
            print(f"❌ Error: Shared memory '{name}' not initialized.")

    def update_shm_robot(self, name, robot_data):
        if name in self.shm_arrays:
            feedback_array = np.array(robot_data, dtype=np.float32).flatten()[:8]
            self.shm_arrays[name][8:16] = feedback_array
        else:
            print(f"❌ Error: Shared memory '{name}' not initialized.")

    def close_all_shm(self):
        for name, shm in self.shm_handles.items():
            shm.close()
            shm.unlink()
        print("🧹 All Shared Memory handles closed.")

    def publish_robot_state(self):
        try:
            robot_msg = {
                "header": {
                    "timestamp": self.get_synced_timestamp(),
                    "devId": ROBOT_UUID
                },
                "left": {
                    "arm": self.shm_arrays['Left_Arm'][8:16].tolist(),
                    "hand": self.shm_arrays['Left_Hand'][8:15].tolist(),
                },
                "right": {
                    "arm": self.shm_arrays['Right_Arm'][8:16].tolist(),
                    "hand": self.shm_arrays['Right_Hand'][8:15].tolist(),
                },
                "waist": {
                    "joints": self.shm_arrays['Waist'][8:11].tolist(),
                },
            }

            self.client.publish(
                f"{MQTT_ROBOT_STATE_TOPIC}/{ROBOT_UUID}",
                json.dumps(robot_msg),
                qos=0
            )
        except KeyError as e:
            print(f"⚠️ SHM Key not found: {e}")

    def robot_unregister(self):
        unregister_msg = {
            "time": datetime.now().strftime('%c'),
            "devId": ROBOT_UUID,
        }

        info = self.client.publish(
            UnRegister_TOPIC,
            json.dumps(unregister_msg),
            qos=1,
        )

        try:
            info.wait_for_publish(timeout=1.0)
            print(f"Robot {ROBOT_UUID} Unregistered Successfully.")
        except RuntimeError:
            print("Unregister failed: Message not published (Timeout or Disconnected).")

    def get_synced_timestamp(self):
        local_now_ms = int(time.time() * 1000)
        return local_now_ms + self.time_offset

    def get_synced_datetime(self):
        local_now_ms = int(time.time() * 1000)
        server_time_secs = (local_now_ms + self.time_offset) / 1000
        server_datetime = datetime.fromtimestamp(server_time_secs)
        date_string = server_datetime.strftime('%c')
        return date_string


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Run MQTT Client in different modes.")
    parser.add_argument(
        '--mode',
        type=str,
        default='local',
        choices=['local', 'uclab'],
        help="Choose the running mode: 'local' or 'uclab' (default: local)"
    )

    args = parser.parse_args()
    mode = args.mode

    print(f"--- Starting in {mode.upper()} Mode ---")

    client = MQTT_Client(mode)
    client.create_shared_memories()
    client.connect_mqtt()

    try:
        while True:
            client.publish_robot_state()
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n⚠️ Exit (Ctrl+C)...")
    finally:
        if client.USER_UUID:
            print(f"\n⏳ Generating user [{client.USER_UUID}] Teleoperation Latency Report.")
            client.session_stats.generate_report(client.USER_UUID)

        client.robot_unregister()
        if client.client.is_connected():
            client.client.disconnect()
        client.client.loop_stop()
        client.close_all_shm()
        print("Client Closed Successfully.")