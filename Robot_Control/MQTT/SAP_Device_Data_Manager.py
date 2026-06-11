"""
SAP Device Manager + DataLogger — 完整版
=========================================
DataLogger 新增功能说明
-----------------------
触发链路（完全由 MQTT 驱动，无需改动前端）：

  1. /offer  POST  → BTP 下发 taskID，转发 btp_action 给对应 user WebSocket
             同时 DataLogger.on_task_assigned(user_id, task_id)
             → 订阅 data/<user_id>

  2. MQTT  data/<user_id>  payload: {"record": "on"}
             → DataLogger 进入 RECORDING 状态
             → 订阅 control/<user_id>
             → 开始缓存控制消息（带服务器时间戳）

  3. MQTT  control/<user_id>  payload: 任意 JSON
             → 追加一行到内存缓冲区（timestamp_recv + 所有字段展开）

  4. MQTT  data/<user_id>  payload: {"record": "off"}
             → 停止录制，取消订阅 control/<user_id>
             → 把缓冲区写入 logs/<task_id>.csv
             → 清理本次会话状态

状态机：
  IDLE ──on_task_assigned──► WAITING
  WAITING ──record:on──► RECORDING
  RECORDING ──record:off──► IDLE  (同时写 CSV)
"""

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

import paho.mqtt.client as mqtt
from flask import Flask, Response, jsonify, request
from flask_socketio import SocketIO, emit

# ---------------------------------------------------------------------------
# 日志配置
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("SAP")


# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------
@dataclass
class Config:
    mqtt_host: str = "127.0.0.1"
    mqtt_port: int = 443
    flask_host: str = "0.0.0.0"
    flask_port: int = 8080
    active_devices_path: str = "active_devices.json"
    log_dir: str = "logs"           # CSV 保存目录


# ===========================================================================
# DataLogger
# ===========================================================================
class RecordState(Enum):
    IDLE      = auto()   # 无任务
    WAITING   = auto()   # 已知 taskID，等待 record:on
    RECORDING = auto()   # 正在录制 control 消息


@dataclass
class _Session:
    """单个用户的录制会话（内部用）"""
    user_id:       str
    task_id:       str
    state:         RecordState  = RecordState.WAITING
    buffer:        list[dict]   = field(default_factory=list)
    columns:       list[str]    = field(default_factory=list)   # CSV 列顺序（按首包确定）
    start_time_ms: int          = 0                             # record:on 时刻（毫秒时间戳）
    start_dt:      str          = ""                            # 同上，人类可读 datetime 字符串


class DataLogger:
    """
    共享同一个 paho MQTT client（由 DeviceManager 传入），
    只负责订阅 / 取消订阅 / 记录 / 落盘，不持有独立连接。
    """

    def __init__(self, mqtt_client: mqtt.Client, log_dir: str) -> None:
        self._client  = mqtt_client
        self._log_dir = log_dir
        self._lock    = threading.Lock()
        self._sessions: dict[str, _Session] = {}   # user_id -> _Session
        os.makedirs(log_dir, exist_ok=True)

    # ------------------------------------------------------------------
    # 外部调用：DeviceManager / Flask 路由触发
    # ------------------------------------------------------------------
    def on_task_assigned(self, user_id: str, task_id: str) -> None:
        """
        /offer 转发成功后调用。
        若该用户已有进行中的会话则先强制结束（保护性处理）。
        """
        with self._lock:
            if user_id in self._sessions:
                logger.warning("[LOGGER] User '%s' had an unfinished session; force-closing it.", user_id)
                self._force_close(user_id)

            self._sessions[user_id] = _Session(user_id=user_id, task_id=task_id)

        # 订阅 data/<user_id> 以等待 record:on / off 指令
        data_topic = f"data/{user_id}"
        self._client.subscribe(data_topic, qos=1)
        logger.info("[LOGGER] Task '%s' assigned to user '%s'. Watching: %s", task_id, user_id, data_topic)

    def on_user_disconnected(self, user_id: str) -> None:
        """用户 WebSocket 断开时由 DeviceManager 通知，强制结束录制。"""
        with self._lock:
            if user_id in self._sessions:
                sess = self._sessions[user_id]
                if sess.state == RecordState.RECORDING:
                    logger.warning("[LOGGER] User '%s' disconnected during recording; saving partial data.", user_id)
                    self._save_csv(sess)
                self._cleanup(user_id)

    # ------------------------------------------------------------------
    # MQTT 消息入口（由 DeviceManager._on_message 路由进来）
    # ------------------------------------------------------------------
    def handle_data_message(self, user_id: str, data: dict) -> None:
        """处理 data/<user_id> 的消息（record 指令）"""
        record_cmd = data.get("record", "").strip().lower()

        with self._lock:
            sess = self._sessions.get(user_id)
            if sess is None:
                logger.warning("[LOGGER] Received data msg for unknown user '%s'", user_id)
                return

            if record_cmd == "on":
                self._start_recording(sess)
            elif record_cmd == "off":
                self._stop_recording(sess)
            elif record_cmd == "reset":
                self._reset_recording(sess)
            else:
                logger.debug("[LOGGER] Ignored data msg for '%s': %s", user_id, data)

    def handle_control_message(self, user_id: str, data: dict) -> None:
        """处理 control/<user_id> 的消息（控制帧录制）"""
        with self._lock:
            sess = self._sessions.get(user_id)
            if sess is None or sess.state != RecordState.RECORDING:
                return

            row: dict = {"timestamp_recv": int(time.time() * 1000)}
            row.update(data)

            # 第一帧确定列顺序
            if not sess.columns:
                sess.columns = list(row.keys())
                logger.info("[LOGGER] CSV columns fixed for task '%s': %s", sess.task_id, sess.columns)

            sess.buffer.append(row)

    # ------------------------------------------------------------------
    # 内部状态机操作（必须在 _lock 内调用）
    # ------------------------------------------------------------------
    def _start_recording(self, sess: _Session) -> None:
        if sess.state != RecordState.WAITING:
            logger.warning("[LOGGER] record:on received but state=%s for user '%s'", sess.state, sess.user_id)
            return

        now_ms             = int(time.time() * 1000)
        sess.state         = RecordState.RECORDING
        sess.buffer        = []
        sess.columns       = []
        sess.start_time_ms = now_ms
        sess.start_dt      = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(now_ms / 1000))

        ctrl_topic = f"control/{sess.user_id}"
        self._client.subscribe(ctrl_topic, qos=0)
        logger.info("[LOGGER] ▶ Recording started | task=%s | started_at=%s", sess.task_id, sess.start_dt)

    def _stop_recording(self, sess: _Session) -> None:
        if sess.state != RecordState.RECORDING:
            logger.warning("[LOGGER] record:off received but state=%s for user '%s'", sess.state, sess.user_id)
            return

        self._save_csv(sess)
        # self._cleanup(sess.user_id)

    def _reset_recording(self, sess: _Session) -> None:
        """
        清空当前录制数据，回到 WAITING 状态重新开始。
        · RECORDING 中：取消订阅 control，清空 buffer，等待下一次 record:on
        · WAITING 中：仅清空（本来就是空的），打 info 提示
        · IDLE：忽略（会话已结束）
        """
        if sess.state == RecordState.IDLE:
            logger.warning("[LOGGER] record:reset ignored: session already idle for user '%s'", sess.user_id)
            return

        if sess.state == RecordState.RECORDING:
            # self._client.unsubscribe(f"control/{sess.user_id}")
            logger.info(
                "[LOGGER] ↺ Reset: discarded %d frames for task '%s'",
                len(sess.buffer), sess.task_id,
            )

        # sess.state = RecordState.WAITING
        sess.buffer = []
        sess.columns = []
        sess.start_time_ms = 0
        # sess.start_dt = ""
        logger.info("[LOGGER] ↺ Recording reset | user='%s' | ready for next record:on", sess.user_id)

    def _save_csv(self, sess: _Session) -> None:
        """将缓冲区写入 logs/<task_id>.csv，并将本次任务摘要追加到 task_log.json。"""
        csv_path = os.path.join(self._log_dir, f"{sess.task_id}.csv")

        if not sess.buffer:
            logger.warning("[LOGGER] No data recorded for task '%s'; skipping CSV write.", sess.task_id)
            return

        # ── 写 CSV ───────────────────────────────────────────────────────
        all_keys: list[str] = list(dict.fromkeys(
            k for row in sess.buffer for k in row
        ))
        if "timestamp_recv" in all_keys:
            all_keys.remove("timestamp_recv")
        columns = ["timestamp_recv"] + all_keys

        try:
            with open(csv_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
                writer.writeheader()
                writer.writerows(sess.buffer)
            logger.info(
                "[LOGGER] ■ CSV saved: %d rows → %s",
                len(sess.buffer), os.path.abspath(csv_path),
            )
        except OSError as exc:
            logger.error("[LOGGER] Failed to write CSV: %s", exc)

        # ── 用首尾控制帧的 timestamp_recv 计算实际操作时长 ────────────────
        t_first = sess.buffer[0].get("timestamp_recv")
        t_last  = sess.buffer[-1].get("timestamp_recv")
        if t_first is not None and t_last is not None:
            task_time_ms = int(t_last) - int(t_first)
        else:
            # 降级：用 record:on → record:off 的时间差
            task_time_ms = int(time.time() * 1000) - sess.start_time_ms
            logger.warning(
                "[LOGGER] 'timestamp_recv' missing in buffer; falling back to record-on/off duration."
            )

        # ── 追加任务摘要到 task_log.json ─────────────────────────────────
        self._append_task_log(
            datetime=sess.start_dt,
            task_id=sess.task_id,
            user_id=sess.user_id,
            task_time_ms=task_time_ms,
        )

        self._cleanup(sess.user_id)

    def get_task_log(self) -> list:
        """读取 task_log.json 并返回记录列表；文件不存在或损坏则返回空列表。"""
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
        datetime: str,
        task_id: str,
        user_id: str,
        task_time_ms: int,
    ) -> None:
        """将 {datetime, taskId, userId, taskTime} 追加写入 logs/task_log.json。"""
        log_path = os.path.join(self._log_dir, "task_log.json")

        entry = {
            "datetime":  datetime,
            "taskId":    task_id,
            "userId":    user_id,
            "taskTime(s)":  round(task_time_ms / 1000, 1),   # 单位：秒，保留一位小数
        }

        # 读取现有记录（文件不存在则从空列表开始）
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
                "[LOGGER] ■ task_log updated: taskId=%s userId=%s taskTime=%.1fs",
                task_id, user_id, task_time_ms / 1000,
            )
        except OSError as exc:
            logger.error("[LOGGER] Failed to write task_log.json: %s", exc)

    def _cleanup(self, user_id: str) -> None:
        """取消订阅并移除会话（必须在 _lock 内调用）"""
        sess = self._sessions.pop(user_id, None)
        if sess is None:
            return
        self._client.unsubscribe(f"data/{user_id}")
        self._client.unsubscribe(f"control/{user_id}")
        logger.info("[LOGGER] Session cleaned up for user '%s'", user_id)

    def _force_close(self, user_id: str) -> None:
        """不保存，直接清理（必须在 _lock 内调用）"""
        self._cleanup(user_id)


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

        # DataLogger 共享同一个 MQTT client
        self.data_logger = DataLogger(self._client, config.log_dir)

    # ------------------------------------------------------------------
    # MQTT 初始化
    # ------------------------------------------------------------------
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

    # ------------------------------------------------------------------
    # MQTT 回调
    # ------------------------------------------------------------------
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

        # ── 时间同步（无需解析设备字段）
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

        # ── 标准设备管理消息
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
    # 消息解析
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
    # 设备管理业务
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

    # ------------------------------------------------------------------
    # 工具方法
    # ------------------------------------------------------------------
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
# Flask 应用工厂
# ===========================================================================
def create_app(config: Config):
    app      = Flask(__name__)
    socketio = SocketIO(app, cors_allowed_origins="*", async_mode="gevent")
    sid_mapping: dict = {}
    manager  = DeviceManager(config, socketio, sid_mapping)

    # ---- HTTP 路由 --------------------------------------------------------

    @app.route("/offer", methods=["POST"])
    def handle_offer():
        data = request.json
        if not data:
            return jsonify({"status": "error", "message": "No JSON payload"}), 400

        target_id = data.get("userID")
        task_id   = data.get("taskID")          # BTP 下发的任务 ID
        if not target_id:
            return jsonify({"status": "error", "message": "Missing 'userID'"}), 400

        sid = sid_mapping.get(target_id)
        if not sid:
            return jsonify({"status": "failed", "message": f"User {target_id} not connected"}), 404

        # 1. 转发给前端
        socketio.emit("btp_action", data, to=sid, namespace="/ws")
        logger.info("[OFFER] Dispatched taskID='%s' to user '%s'", task_id, target_id)

        # 2. 若携带 taskID，激活 DataLogger 会话
        if task_id:
            manager.data_logger.on_task_assigned(target_id, task_id)

        return jsonify({"status": "dispatched", "msg": f"Sent to {target_id}"}), 200

    @app.route("/device", methods=["GET"])
    def handle_device():
        return Response(
            json.dumps(manager.get_device_list(), ensure_ascii=False, indent=2),
            mimetype="application/json",
        )

    @app.route("/result", methods=["GET"])
    def handle_result():
        records = manager.data_logger.get_task_log()
        return Response(
            json.dumps(records, ensure_ascii=False, indent=2),
            mimetype="application/json",
        )

    @app.route("/time", methods=["GET"])
    def get_server_time():
        return jsonify({"status": "success", "server_time": int(time.time() * 1000)}), 200

    # ---- WebSocket 事件 ---------------------------------------------------

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

    @socketio.on("disconnect", namespace="/ws")
    def on_ws_disconnect():
        dead_users = [uid for uid, s in sid_mapping.items() if s == request.sid]
        for uid in dead_users:
            sid_mapping.pop(uid, None)
            manager.data_logger.on_user_disconnected(uid)
            logger.info("[WS] User '%s' disconnected.", uid)

    @socketio.on("sync_time_ping", namespace="/ws")
    def on_sync_time(data):
        emit("sync_time_pong", {
            "client_t0":   data.get("client_t0"),
            "server_time": int(time.time() * 1000),
        })

    return app, socketio, sid_mapping, manager


# ===========================================================================
# 入口
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