from __future__ import annotations

import csv
import json
import logging
import os
import ssl
import threading
import time
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Optional

import requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

import paho.mqtt.client as mqtt
from flask import Flask, Response, jsonify, request
from flask_socketio import SocketIO, emit


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("SAP")

@dataclass
class Config:
    mqtt_host: str = "localhost"
    mqtt_port: int = 443
    flask_host: str = "0.0.0.0"
    flask_port: int = 8080
    active_devices_path: str = "active_devices.json"
    log_dir: str = "logs"
    result_upload_url: str = "https://133.6.254.50/upload"

# ===========================================================================
# DataLogger
# ===========================================================================
class RecordState(Enum):
    IDLE      = auto()
    WAITING   = auto()
    RECORDING = auto()


@dataclass
class _Session:
    user_id:       str
    state:         RecordState  = RecordState.WAITING
    header:        dict         = field(default_factory=dict)
    task_id:       str          = ""
    buffer:        list[dict]   = field(default_factory=list)
    columns:       list[str]    = field(default_factory=list)
    start_time_ms: int          = 0
    start_dt:      str          = ""


class DataLogger:
    def __init__(self, mqtt_client: mqtt.Client, log_dir: str, upload_url: str = "") -> None:
        self._client  = mqtt_client
        self._log_dir = log_dir
        self._upload_url = upload_url
        self._lock    = threading.Lock()
        self._sessions: dict[str, _Session] = {}   # user_id -> _Session
        os.makedirs(log_dir, exist_ok=True)

    # ------------------------------------------------------------------
    # DeviceManager / Flask
    # ------------------------------------------------------------------
    def on_user_online(self, user_id: str) -> None:
        with self._lock:
            if user_id in self._sessions:
                logger.info("[LOGGER] User '%s' already has a session; keeping it.", user_id)
                return
            self._sessions[user_id] = _Session(user_id=user_id)
        self._client.subscribe(f"data/{user_id}", qos=1)
        logger.info("[LOGGER] User '%s' online; watching data/%s", user_id, user_id)

    def on_user_disconnected(self, user_id: str) -> None:
        with self._lock:
            if user_id in self._sessions:
                sess = self._sessions[user_id]
                if sess.state == RecordState.RECORDING:
                    logger.warning("[LOGGER] User '%s' disconnected during recording; saving partial data.", user_id)
                    self._save_csv(sess)
                else:
                    self._cleanup(user_id)

    # ------------------------------------------------------------------
    # MQTT Message
    # ------------------------------------------------------------------
    def handle_data_message(self, user_id: str, data: dict) -> None:
        record_cmd = str(data.get("record", "")).strip().lower()

        with self._lock:
            sess = self._sessions.get(user_id)
            if sess is None:
                logger.debug("[LOGGER] Ignored data msg for unregistered user '%s'", user_id)
                return

            if record_cmd == "on":
                header = data.get("header", {})
                self._start_recording(sess, header)
            elif record_cmd == "off":
                header = data.get("header", {})
                self._stop_recording(sess, header)
            elif record_cmd == "reset":
                self._reset_recording(sess)
            else:
                logger.debug("[LOGGER] Ignored data msg for '%s': %s", user_id, data)

    def handle_control_message(self, user_id: str, data: dict) -> None:
        with self._lock:
            sess = self._sessions.get(user_id)
            if sess is None or sess.state != RecordState.RECORDING:
                return

            row: dict = {"timestamp_recv": int(time.time() * 1000)}
            row.update(data)

            if not sess.columns:
                sess.columns = list(row.keys())
                logger.info("[LOGGER] CSV columns fixed for task '%s': %s", sess.task_id, sess.columns)

            sess.buffer.append(row)

    def _start_recording(self, sess: _Session, header: dict) -> None:
        if sess.state != RecordState.WAITING:
            logger.warning("[LOGGER] record:on received but state=%s for user '%s'", sess.state, sess.user_id)
            return

        now_ms = int(time.time() * 1000)

        sess.header        = header
        sess.task_id       = str(header.get("WarehouseTask") or header.get("task") or now_ms)
        sess.state         = RecordState.RECORDING
        sess.buffer        = []
        sess.columns       = []
        sess.start_time_ms = now_ms
        sess.start_dt      = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(now_ms / 1000))

        self._client.subscribe(f"control/{sess.user_id}", qos=0)
        logger.info(
            "[LOGGER] ▶ Recording started | task=%s | user=%s | started_at=%s",
            sess.task_id, sess.user_id, sess.start_dt,
        )

    def _stop_recording(self, sess: _Session, header: dict) -> None:
        if sess.state != RecordState.RECORDING:
            logger.warning("[LOGGER] record:off received but state=%s for user '%s'", sess.state, sess.user_id)
            return

        if header:
            sess.header.update(header)
            logger.info("[LOGGER] Header updated from record:off | task=%s", sess.task_id)

        self._save_csv(sess)
        sess.state = RecordState.WAITING

    def _reset_recording(self, sess: _Session) -> None:
        if sess.state == RecordState.IDLE:
            logger.warning("[LOGGER] record:reset ignored: session already idle for user '%s'", sess.user_id)
            return

        if sess.state == RecordState.RECORDING:
            self._client.unsubscribe(f"control/{sess.user_id}")
            logger.info(
                "[LOGGER] ↺ Reset: discarded %d frames for task '%s'",
                len(sess.buffer), sess.task_id,
            )

        sess.state         = RecordState.WAITING
        sess.header        = {}
        sess.task_id       = ""
        sess.buffer        = []
        sess.columns       = []
        sess.start_time_ms = 0
        sess.start_dt      = ""
        logger.info("[LOGGER] ↺ Recording reset | user='%s' | ready for next record:on", sess.user_id)

    def _save_csv(self, sess: _Session) -> None:
        csv_path = os.path.join(self._log_dir, f"{sess.task_id}.csv")

        if not sess.buffer:
            logger.warning("[LOGGER] No data recorded for task '%s'; skipping CSV write.", sess.task_id)
            sess.state = RecordState.WAITING
            return

        all_keys: list[str] = list(dict.fromkeys(
            k for row in sess.buffer for k in row
        ))
        if "timestamp_recv" in all_keys:
            all_keys.remove("timestamp_recv")
        columns = ["timestamp_recv"] + all_keys

        try:
            with open(csv_path, "w", newline="", encoding="utf-8") as f:
                for k, v in sess.header.items():
                    f.write(f"# {k}: {v}\n")
                writer = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
                writer.writeheader()
                writer.writerows(sess.buffer)
            logger.info(
                "[LOGGER] ■ CSV saved: %d rows → %s",
                len(sess.buffer), os.path.abspath(csv_path),
            )
        except OSError as exc:
            logger.error("[LOGGER] Failed to write CSV: %s", exc)
            return

        t_first = sess.buffer[0].get("timestamp_recv")
        t_last  = sess.buffer[-1].get("timestamp_recv")
        if t_first is not None and t_last is not None:
            task_time_ms = int(t_last) - int(t_first)
        else:
            task_time_ms = int(time.time() * 1000) - sess.start_time_ms
            logger.warning("[LOGGER] 'timestamp_recv' missing; falling back to record-on/off duration.")

        self._append_task_log(
            start_dt=sess.start_dt,
            task_id=sess.task_id,
            task_time_ms=task_time_ms,
            header=sess.header,
        )

    def get_task_log(self) -> list:
        log_path = os.path.join(self._log_dir, "task_log.json")
        if not os.path.exists(log_path):
            return []
        try:
            with open(log_path, "r", encoding="utf-8") as f:
                records = json.load(f)
            return records if isinstance(records, list) else []
        except (OSError, json.JSONDecodeError) as exc:
            logger.error("[LOGGER] Failed to read task_log.json: %s", exc)
            return []

    def _append_task_log(
        self,
        start_dt: str,
        task_id: str,
        task_time_ms: int,
        header: dict,
    ) -> None:
        log_path = os.path.join(self._log_dir, "task_log.json")

        entry = {
            "timeStart":    start_dt,
            "taskTime(s)": round(task_time_ms / 1000, 1),
            **header,          # 展开 header：userID/robot/warehouse/WarehouseTask/Product 等
        }

        records: list[dict] = []
        if os.path.exists(log_path):
            try:
                with open(log_path, "r", encoding="utf-8") as f:
                    records = json.load(f)
                if not isinstance(records, list):
                    records = []
            except (OSError, json.JSONDecodeError) as exc:
                logger.warning("[LOGGER] task_log.json unreadable, starting fresh: %s", exc)
                records = []

        records.append(entry)

        try:
            with open(log_path, "w", encoding="utf-8") as f:
                json.dump(records, f, ensure_ascii=False, indent=2)
            logger.info(
                "[LOGGER] ■ task_log updated: task=%s taskTime=%.1fs",
                task_id, task_time_ms / 1000,
            )
        except OSError as exc:
            logger.error("[LOGGER] Failed to write task_log.json: %s", exc)

        # ── 异步上传到远端服务器 ──────────────────────────────────────────
        if self._upload_url:
            threading.Thread(
                target=self._upload_result,
                args=(entry,),
                daemon=True,
            ).start()

    def _upload_result(self, entry: dict) -> None:
        try:
            resp = requests.post(
                self._upload_url,
                json=entry,
                timeout=10,
                verify=False,
            )
            resp.raise_for_status()
            logger.info(
                "[LOGGER] ↑ Uploaded result to %s | status=%d",
                self._upload_url, resp.status_code,
            )
        except requests.exceptions.RequestException as exc:
            logger.error("[LOGGER] Failed to upload result: %s", exc)

    def _cleanup(self, user_id: str) -> None:
        """取消订阅并移除会话"""
        sess = self._sessions.pop(user_id, None)
        if sess is None:
            return
        self._client.unsubscribe(f"data/{user_id}")
        self._client.unsubscribe(f"control/{user_id}")
        logger.info("[LOGGER] Session cleaned up for user '%s'", user_id)


# ===========================================================================
# DeviceManager
# ===========================================================================
class DeviceManager:
    TOPICS = [
        "sap/register",
        "sap/unregister",
        "sap/request",
        "sap/unrequest",
        "sap/time/ping/+",
    ]

    def __init__(
        self,
        config: Config,
        socketio_instance: SocketIO,
        sid_mapping: dict,
    ) -> None:
        self.config      = config
        self.socketio    = socketio_instance
        self.sid_mapping = sid_mapping

        self.devices:      dict = {}
        self.match_results: dict = {}
        self._lock = threading.RLock()

        self._client = self._build_mqtt_client()

        self.data_logger = DataLogger(self._client, config.log_dir, config.result_upload_url)

    def _build_mqtt_client(self) -> mqtt.Client:
        client = mqtt.Client(transport="websockets")
        client.tls_set(cert_reqs=ssl.CERT_NONE)
        client.ws_set_options(path="/mqtt")
        client.on_connect = self._on_connect
        client.on_message = self._on_message
        return client

    def start(self) -> None:
        try:
            logger.info("Connecting to %s:%d via WSS…", self.config.mqtt_host, self.config.mqtt_port)
            self._client.connect(self.config.mqtt_host, self.config.mqtt_port, 60)
            self._client.loop_start()
            logger.info("Device Manager started.")
        except Exception as exc:
            logger.error("MQTT connection failed: %s", exc)

    def stop(self) -> None:
        self._client.loop_stop()
        self._client.disconnect()
        logger.info("Device Manager stopped.")

    def _on_connect(self, client, userdata, flags, rc) -> None:
        if rc != 0:
            logger.error("MQTT connect failed, rc=%d", rc)
            return
        logger.info("MQTT connected to %s", self.config.mqtt_host)
        for topic in self.TOPICS:
            client.subscribe(topic)

    def _on_message(self, client, userdata, msg) -> None:
        topic: str = msg.topic
        data = self._parse_payload(topic, msg.payload)
        if data is None:
            return

        # Time Sync
        if topic.startswith("sap/time/ping/"):
            self._handle_time_ping(topic, data)
            return

        # ── DataLogger：data/<user_id>
        if topic.startswith("data/"):
            user_id = topic.split("/", 1)[1]
            self.data_logger.handle_data_message(user_id, data)
            return

        # ── DataLogger：control/<user_id>
        if topic.startswith("control/"):
            user_id = topic.split("/", 1)[1]
            self.data_logger.handle_control_message(user_id, data)
            return

        handlers = {
            "sap/register":   self._handle_register,
            "sap/unregister": self._handle_unregister,
            "sap/request":    self._handle_request,
            "sap/unrequest":  self._handle_unrequest,
        }
        handler = handlers.get(topic)
        if handler:
            handler(data)

    # ------------------------------------------------------------------
    # Json Decode
    # ------------------------------------------------------------------
    @staticmethod
    def _parse_payload(topic: str, raw: bytes) -> Optional[dict]:
        try:
            parsed = json.loads(raw.decode())
        except Exception:
            logger.warning("Non-JSON payload on %s", topic)
            return None
        if isinstance(parsed, list):
            return parsed[0] if parsed else None
        return parsed if isinstance(parsed, dict) else None

    # ------------------------------------------------------------------
    # Device Manage
    # ------------------------------------------------------------------
    def _handle_register(self, data: dict) -> None:
        dev_id    = data.get("devId", "unknown")
        dev_type  = data.get("devType", "unknown")
        dev_model = data.get("type", "unknown")
        with self._lock:
            current_status = self.devices.get(dev_id, {}).get("devStatus", "available")
            self.devices[dev_id] = {
                "time":      time.strftime("%Y-%m-%d %H:%M:%S"),
                "devType":   dev_type,
                "devModel":  dev_model,
                "devStatus": current_status,
            }
        logger.info("[REGISTER] %s '%s' online, status=%s", dev_type.upper(), dev_id, current_status)
        self._dump_devices()

    def _handle_unregister(self, data: dict) -> None:
        dev_id = data.get("devId", "unknown")
        with self._lock:
            device = self.devices.get(dev_id)
            if device is None:
                return
            dev_type = device.get("devType")
            if dev_type == "browser":
                robot_id = self.match_results.pop(dev_id, None)
                if robot_id and robot_id in self.devices:
                    self.devices[robot_id]["devStatus"] = "available"
                # 通知 DataLogger 用户离线
                self.data_logger.on_user_disconnected(dev_id)
            elif dev_type == "robot":
                user_id = next(
                    (uid for uid, rid in self.match_results.items() if rid == dev_id), None
                )
                if user_id:
                    self.match_results.pop(user_id, None)
                    if user_id in self.devices:
                        self.devices[user_id]["devStatus"] = "available"
            self.devices.pop(dev_id, None)
        logger.info("[UNREGISTER] '%s' offline.", dev_id)
        self._dump_devices()

    def _handle_request(self, data: dict) -> None:
        user_id   = data.get("devId")
        dev_model = data.get("type")
        with self._lock:
            if user_id not in self.devices:
                return
            if user_id in self.match_results:
                return
            robot_id = self._find_available_robot(dev_model)
            if robot_id is None:
                self._emit_to_user(user_id, "match_failed", {"reason": "No available robot", "model": dev_model})
                return
            self.match_results[user_id]         = robot_id
            self.devices[user_id]["devStatus"]  = "busy"
            self.devices[robot_id]["devStatus"] = "busy"
        logger.info("[MATCH] User '%s' <-> Robot '%s'", user_id, robot_id)
        self._client.publish(
            f"sap/dev/{user_id}",
            json.dumps({"type": self.devices[robot_id]["devModel"], "devId": robot_id}),
        )
        self._dump_devices()

    def _handle_unrequest(self, data: dict) -> None:
        user_id = data.get("devId")
        with self._lock:
            robot_id = self.match_results.pop(user_id, None)
            if robot_id is None:
                return
            if user_id in self.devices:
                self.devices[user_id]["devStatus"] = "available"
            if robot_id in self.devices:
                self.devices[robot_id]["devStatus"] = "available"
        logger.info("[RELEASE] User '%s' released robot '%s'.", user_id, robot_id)
        self._emit_to_user(user_id, "robot_released", {"robotId": robot_id})
        self._client.publish(f"robot/{robot_id}/release", json.dumps({"userId": user_id}))
        self._dump_devices()

    def _handle_time_ping(self, topic: str, data: dict) -> None:
        try:
            robot_uuid = topic.split("/")[-1]
            robot_t0   = data.get("robot_t0")
            if robot_t0 is None:
                return
            self._client.publish(
                f"sap/time/pong/{robot_uuid}",
                json.dumps({"robot_t0": robot_t0, "server_time": int(time.time() * 1000)}),
                qos=1,
            )
        except Exception as exc:
            logger.error("[TIME PING] %s", exc)


    def _find_available_robot(self, model: str) -> Optional[str]:
        for r_id, info in self.devices.items():
            if (
                info.get("devType")   == "robot"
                and info.get("devModel")  == model
                and info.get("devStatus") == "available"
            ):
                return r_id
        return None

    def _emit_to_user(self, user_id: str, event: str, payload: dict) -> None:
        sid = self.sid_mapping.get(user_id)
        if sid:
            self.socketio.emit(event, payload, namespace="/ws", to=sid)

    def get_device_list(self) -> list:
        with self._lock:
            return [
                {"time": i["time"], "id": d, "type": i["devType"],
                 "model": i["devModel"], "status": i["devStatus"]}
                for d, i in self.devices.items()
            ]

    def _dump_devices(self) -> None:
        device_list = self.get_device_list()
        logger.info("=== Active Devices (%d) ===", len(device_list))
        for d in device_list:
            logger.info("  %-45s | %-12s | %-25s | %s", d["id"], d["type"], d["model"], d["status"])
        try:
            with open(self.config.active_devices_path, "w", encoding="utf-8") as f:
                json.dump(device_list, f, ensure_ascii=False, indent=2)
        except OSError as exc:
            logger.error("Failed to write devices file: %s", exc)


# ===========================================================================
# Flask APP
# ===========================================================================
def create_app(config: Config):
    app      = Flask(__name__)
    socketio = SocketIO(app, cors_allowed_origins="*", async_mode="gevent")
    sid_mapping: dict = {}
    task_cache: dict = {}
    manager  = DeviceManager(config, socketio, sid_mapping)

    @app.route("/offer", methods=["POST"])
    def handle_offer():
        data = request.json
        if not data:
            return jsonify({"status": "error", "message": "No JSON payload"}), 400

        target_id = data.get("userID")
        # task_id   = data.get("task")
        warehouse = data.get("warehouse")
        if not target_id:
            return jsonify({"status": "error", "message": "Missing 'userID'"}), 400

        sid = sid_mapping.get(target_id)
        if not sid:
            return jsonify({"status": "failed", "message": f"User {target_id} not connected"}), 404

        socketio.emit("btp_action", data, to=sid, namespace="/ws")
        logger.info("[OFFER] Dispatched '%s' tasks to user '%s'", warehouse, target_id)

        task_cache[target_id] = [data]
        logger.info("[CACHE] Updated cache with '%s' tasks for user '%s'",
                    warehouse, target_id)

        return jsonify({"status": "dispatched", "msg": f"Sent to {target_id}"}), 200

    @app.route("/device", methods=["GET"])
    def handle_device():
        return Response(
            json.dumps(manager.get_device_list(), ensure_ascii=False, indent=2),
            mimetype="application/json",
        )

    @app.route("/result", methods=["GET"])
    def handle_task_result():
        records = manager.data_logger.get_task_log()
        return Response(
            json.dumps(records, ensure_ascii=False, indent=2),
            mimetype="application/json",
        )

    @app.route("/time", methods=["GET"])
    def get_server_time():
        return jsonify({"status": "success", "server_time": int(time.time() * 1000)}), 200

    # ---- WebSocket Event ---------------------------------------------------

    @socketio.on("connect", namespace="/ws")
    def on_ws_connect():
        logger.info("[WS] Client connected, sid=%s", request.sid)
        emit("response", {"data": "Connected"})

    @socketio.on("register_user", namespace="/ws")
    def on_register_user(data):
        user_id = data.get("userId") or data.get("devId")
        if user_id:
            sid_mapping[user_id] = request.sid
            logger.info("[WS] Bound user '%s' -> sid '%s'", user_id, request.sid)
            emit("response", {"status": "registered", "userId": user_id})
            manager.data_logger.on_user_online(user_id)

    @socketio.on("disconnect", namespace="/ws")
    def on_ws_disconnect():
        dead_users = [uid for uid, s in sid_mapping.items() if s == request.sid]
        for uid in dead_users:
            sid_mapping.pop(uid, None)
            manager.data_logger.on_user_disconnected(uid)
            logger.info("[WS] User '%s' disconnected.", uid)

    @socketio.on("sync_time_ping", namespace="/ws")
    def on_sync_time(data):
        return {
            "client_t0": data.get("client_t0"),
            "server_time": int(time.time() * 1000),
        }

    @socketio.on("task_cache", namespace="/ws")
    def handle_get_cache(data):
        user_id = data.get("userId")
        if not user_id:
            return

        msg_cache = task_cache.get(user_id, [])
        emit("get_cache", {
            "cache": msg_cache
        })

    return app, socketio, sid_mapping, manager


# ===========================================================================
if __name__ == "__main__":
    cfg = Config()
    app, socketio, _, manager = create_app(cfg)

    manager.start()
    try:
        logger.info("Starting Flask-SocketIO on %s:%d", cfg.flask_host, cfg.flask_port)
        socketio.run(app, host=cfg.flask_host, port=cfg.flask_port)
    except KeyboardInterrupt:
        logger.info("Shutting down…")
    finally:
        manager.stop()