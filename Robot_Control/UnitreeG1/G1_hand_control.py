import threading
import time
import numpy as np
from enum import IntEnum
from multiprocessing import shared_memory
from unitree_sdk2py.core.channel import ChannelPublisher, ChannelSubscriber, ChannelFactoryInitialize
from unitree_sdk2py.idl.unitree_hg.msg.dds_ import HandState_, HandCmd_
from unitree_sdk2py.idl.default import unitree_hg_msg_dds__HandCmd_
from unitree_sdk2py.utils.thread import RecurrentThread


class Dex3_1_Left_JointIndex(IntEnum):
    kLeftHandThumb0  = 0; kLeftHandThumb1  = 1; kLeftHandThumb2  = 2
    kLeftHandMiddle0 = 3; kLeftHandMiddle1 = 4
    kLeftHandIndex0  = 5; kLeftHandIndex1  = 6

class Dex3_1_Right_JointIndex(IntEnum):
    kRightHandThumb0  = 0; kRightHandThumb1  = 1; kRightHandThumb2  = 2
    kRightHandMiddle0 = 3; kRightHandMiddle1 = 4
    kRightHandIndex0  = 5; kRightHandIndex1  = 6


class Dex3IntegratedManager:
    def __init__(self, shm_name_l='Left_Hand', shm_name_r='Right_Hand'):
        self.control_dt = 0.02   # 50Hz
        self.writer_dt  = 0.002  # 500Hz

        # 压力 → 增益映射参数
        self.P_MIN, self.P_MAX   = 10.5, 22.5
        self.SIG_CENTER          = 13.5
        self.SIG_STEEPNESS       = 0.65

        self.KP_STIFF   = np.ones(7)
        self.KD_STIFF   = np.full(7, 0.12)
        self.KP_DAMPING = np.array([1.0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])
        self.KD_DAMPING = np.array([2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0])
        self.JOINT_TO_SENSOR = {1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5}

        # ---- 插值 LUT ----
        self.interp_steps = int(self.control_dt / self.writer_dt)  # = 10
        self.sigmoid_k    = 8.0
        self.sigmoid_lut  = self._precompute_sigmoid_lut()

        # ---- 插值状态（Lock 保护） ----
        self._lock       = threading.Lock()
        # 用当前帧时间替代帧计数，更准确
        self._seg_q0_l   = np.zeros(7)   # 本段起点
        self._seg_q1_l   = np.zeros(7)   # 本段终点
        self._seg_q0_r   = np.zeros(7)
        self._seg_q1_r   = np.zeros(7)
        self._interp_frame = 0           # Writer 专用，无需 Lock（单线程递增）

        # ---- 增益（Lock 保护） ----
        self._kp_l = self.KP_STIFF.copy()
        self._kd_l = self.KD_STIFF.copy()
        self._kp_r = self.KP_STIFF.copy()
        self._kd_r = self.KD_STIFF.copy()
        self._gain_lock = threading.Lock()

        # ---- 共享内存 ----
        self.shm_l      = shared_memory.SharedMemory(name=shm_name_l)
        self.shm_r      = shared_memory.SharedMemory(name=shm_name_r)
        self.shm_data_l = np.ndarray((16,), dtype=np.float32, buffer=self.shm_l.buf)
        self.shm_data_r = np.ndarray((16,), dtype=np.float32, buffer=self.shm_r.buf)

        # ---- DDS ----
        self.pub_l = ChannelPublisher("rt/dex3/left/cmd",       HandCmd_)
        self.pub_r = ChannelPublisher("rt/dex3/right/cmd",      HandCmd_)
        self.sub_l = ChannelSubscriber("rt/lf/dex3/left/state", HandState_)
        self.sub_r = ChannelSubscriber("rt/lf/dex3/right/state",HandState_)
        self.pub_l.Init(); self.pub_r.Init()

        # ★ 用回调替代阻塞 Read()，传感器数据到了就处理
        self.sub_l.Init(lambda msg: self._on_hand_state(msg, "left"),  10)
        self.sub_r.Init(lambda msg: self._on_hand_state(msg, "right"), 10)

        self.msg_l = unitree_hg_msg_dds__HandCmd_()
        self.msg_r = unitree_hg_msg_dds__HandCmd_()
        for i in range(7):
            self.msg_l.motor_cmd[i].mode = (i & 0x0F) | (0x01 << 4)
            self.msg_r.motor_cmd[i].mode = (i & 0x0F) | (0x01 << 4)

    # ------------------------------------------------------------------ #
    #  LUT                                                                 #
    # ------------------------------------------------------------------ #
    def _precompute_sigmoid_lut(self):
        lut = []
        for step in range(1, self.interp_steps + 1):
            x   = step / self.interp_steps
            val = 1.0 / (1.0 + np.exp(-self.sigmoid_k * (x - 0.5)))
            v0  = 1.0 / (1.0 + np.exp(-self.sigmoid_k * (0.0 - 0.5)))
            v1  = 1.0 / (1.0 + np.exp(-self.sigmoid_k * (1.0 - 0.5)))
            lut.append((val - v0) / (v1 - v0))
        return lut

    # ------------------------------------------------------------------ #
    #  传感器回调（替代阻塞 Read 线程）                                      #
    # ------------------------------------------------------------------ #
    def _get_alpha_sigmoid(self, p):
        if p <= self.P_MIN: return 0.0
        if p >= self.P_MAX: return 1.0
        return 1.0 / (1.0 + np.exp(-self.SIG_STEEPNESS * (p - self.SIG_CENTER)))

    def _on_hand_state(self, msg: HandState_, side: str):
        """DDS 回调，在收到新状态时立即更新增益和 SHM 反馈"""
        # 1. 解析压力
        pressures = []
        for i in range(6):
            data = np.array(msg.press_sensor_state[i].pressure) / 10000.0
            ref  = np.max(data[[0, 2, 9, 11]]) if i % 2 == 0 else np.max(data[[3, 6, 8]])
            pressures.append(ref)

        # 2. 计算自适应增益
        kp_new = np.empty(7); kd_new = np.empty(7)
        for j in range(7):
            s = self.JOINT_TO_SENSOR.get(j)
            if s is not None:
                a = self._get_alpha_sigmoid(pressures[s])
                kp_new[j] = self.KP_STIFF[j] + a * (self.KP_DAMPING[j] - self.KP_STIFF[j])
                kd_new[j] = self.KD_STIFF[j] + a * (self.KD_DAMPING[j] - self.KD_STIFF[j])
            else:
                kp_new[j] = self.KP_STIFF[j]
                kd_new[j] = self.KD_STIFF[j]

        # 3. 原子写入增益
        with self._gain_lock:
            if side == "left":
                self._kp_l, self._kd_l = kp_new, kd_new
            else:
                self._kp_r, self._kd_r = kp_new, kd_new

        # 4. 回写关节角到 SHM（供 WebXR 端读取）
        q_states = np.array([msg.motor_state[i].q for i in range(7)], dtype=np.float32)
        if side == "left":
            self.shm_data_l[8:15] = q_states
        else:
            self.shm_data_r[8:15] = q_states

    # ------------------------------------------------------------------ #
    #  Thread 1: 50Hz 控制循环                                             #
    # ------------------------------------------------------------------ #
    def _control_loop(self):
        # 从 SHM 读新目标
        new_l = self.shm_data_l[0:7].copy().astype(np.float64)
        new_r = self.shm_data_r[0:7].copy().astype(np.float64)

        with self._lock:
            # 段起点 = 上一段终点（连续，无跳变）
            self._seg_q0_l = self._seg_q1_l.copy()
            self._seg_q0_r = self._seg_q1_r.copy()
            self._seg_q1_l = new_l
            self._seg_q1_r = new_r
            self._interp_frame = 0   # 重置插值进度

    # ------------------------------------------------------------------ #
    #  Thread 2: 500Hz 写入循环                                            #
    # ------------------------------------------------------------------ #
    def _write_cmd_loop(self):
        # 推进插值帧
        if self._interp_frame < self.interp_steps:
            self._interp_frame += 1
        idx   = min(self._interp_frame - 1, self.interp_steps - 1)
        ratio = self.sigmoid_lut[idx]

        # 读取插值端点（最小 Lock 范围）
        with self._lock:
            q0_l = self._seg_q0_l; q1_l = self._seg_q1_l
            q0_r = self._seg_q0_r; q1_r = self._seg_q1_r

        ql = q0_l + ratio * (q1_l - q0_l)
        qr = q0_r + ratio * (q1_r - q0_r)

        # 读取增益
        with self._gain_lock:
            kp_l, kd_l = self._kp_l.copy(), self._kd_l.copy()
            kp_r, kd_r = self._kp_r.copy(), self._kd_r.copy()

        self._send_cmd(self.msg_l, self.pub_l, ql, kp_l, kd_l)
        self._send_cmd(self.msg_r, self.pub_r, qr, kp_r, kd_r)

    def _send_cmd(self, msg, pub, q_cmd, kp, kd):
        for i in range(7):
            msg.motor_cmd[i].q  = float(q_cmd[i])
            msg.motor_cmd[i].kp = float(kp[i])
            msg.motor_cmd[i].kd = float(kd[i])
        pub.Write(msg)

    # ------------------------------------------------------------------ #
    #  启动 / 停止                                                          #
    # ------------------------------------------------------------------ #
    def start(self):
        # ★ 用当前 SHM 反馈值初始化插值段，防止冷启动跳变
        time.sleep(0.1)   # 等回调触发一次，SHM[8:15] 有真实值
        q_now_l = self.shm_data_l[8:15].copy().astype(np.float64)
        q_now_r = self.shm_data_r[8:15].copy().astype(np.float64)
        self._seg_q0_l = q_now_l; self._seg_q1_l = q_now_l
        self._seg_q0_r = q_now_r; self._seg_q1_r = q_now_r

        # RecurrentThread 计时更精准
        self.controlThread = RecurrentThread(
            interval=self.control_dt, target=self._control_loop, name="hand_ctrl"
        )
        self.writerThread = RecurrentThread(
            interval=self.writer_dt, target=self._write_cmd_loop, name="hand_write"
        )
        self.controlThread.Start()
        self.writerThread.Start()
        print("Hand system started.")

    def stop(self):
        if hasattr(self, 'writerThread'):  self.writerThread.Wait(1.0)
        if hasattr(self, 'controlThread'): self.controlThread.Wait(1.0)
        self.shm_l.close()
        self.shm_r.close()
        print("Hand system stopped.")


if __name__ == "__main__":
    ChannelFactoryInitialize(0)
    manager = Dex3IntegratedManager()
    manager.start()
    try:
        while True:
            time.sleep(1.0)
    except KeyboardInterrupt:
        print("\nShutdown...")
    finally:
        manager.stop()