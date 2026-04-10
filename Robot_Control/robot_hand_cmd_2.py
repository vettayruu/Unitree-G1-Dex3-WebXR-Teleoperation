import threading
import time
import numpy as np
from enum import IntEnum
from multiprocessing import shared_memory
from unitree_sdk2py.core.channel import ChannelPublisher, ChannelSubscriber
from unitree_sdk2py.idl.unitree_hg.msg.dds_ import HandState_, HandCmd_
from unitree_sdk2py.idl.default import unitree_hg_msg_dds__HandCmd_


# 假设枚举定义如下
class Dex3_1_Left_JointIndex(IntEnum):
    kLeftHandThumb0 = 0
    kLeftHandThumb1 = 1
    kLeftHandThumb2 = 2
    kLeftHandMiddle0 = 3
    kLeftHandMiddle1 = 4
    kLeftHandIndex0 = 5
    kLeftHandIndex1 = 6


class Dex3_1_Right_JointIndex(IntEnum):
    kRightHandThumb0 = 0
    kRightHandThumb1 = 1
    kRightHandThumb2 = 2
    kRightHandMiddle0 = 3
    kRightHandMiddle1 = 4
    kRightHandIndex0 = 5
    kRightHandIndex1 = 6


class Dex3IntegratedManager:
    def __init__(self, shm_name_l='Left_Hand', shm_name_r='Right_Hand', alpha=0.7):
        # 1. 物理与算法参数
        self.P_MIN, self.P_MAX = 10.5, 22.5
        self.SIG_CENTER, self.SIG_STEEPNESS = 13.5, 0.65
        self.alpha_hand = alpha
        self.control_dt = 0.02
        self.sensor_dt = 0.02
        self.writer_dt = 0.002

        # --- Sigmoid 插值相关参数 ---
        self.q_start_l = np.zeros(7)
        self.q_start_r = np.zeros(7)
        self.target_l = np.zeros(7)
        self.target_r = np.zeros(7)
        self.interp_steps = int(self.control_dt / self.writer_dt)
        self.current_interp_frame = 0  # 记录当前处于 10 帧中的第几帧

        self.sigmoid_k = 8.0
        self._precompute_sigmoid_lut()

        # 关节增益字典 (Stiff & Damping)
        self.KP_STIFF = {i: 1.0 for i in range(7)}
        self.KD_STIFF = {0: 0.12, 1: 0.12, 2: 0.12, 3: 0.12, 4: 0.12, 5: 0.12, 6: 0.12}

        self.KP_DAMPING = {0: 1.0, 1: 0.35, 2: 0.15, 3: 0.2, 4: 0.15, 5: 0.2, 6: 0.15}
        self.KD_DAMPING = {0: 0.1, 1: 0.40, 2: 0.30, 3: 0.3, 4: 0.25, 5: 0.3, 6: 0.25}

        self.JOINT_TO_SENSOR = {1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5}

        # 2. 状态与缓存
        self._current_kp_l = np.array([1.0] * 7)
        self._current_kd_l = np.array([0.1] * 7)
        self._current_kp_r = np.array([1.0] * 7)
        self._current_kd_r = np.array([0.1] * 7)
        self.curr_q_cmd_l = np.zeros(7)
        self.curr_q_cmd_r = np.zeros(7)

        # 3. 共享内存初始化
        try:
            self.shm_l = shared_memory.SharedMemory(name=shm_name_l)
            self.shm_r = shared_memory.SharedMemory(name=shm_name_r)
            self.shm_data_l = np.ndarray((16,), dtype=np.float32, buffer=self.shm_l.buf)
            self.shm_data_r = np.ndarray((16,), dtype=np.float32, buffer=self.shm_r.buf)
        except Exception as e:
            print(f"Error connecting to Shared Memory: {e}")
            raise

        # 4. DDS 通信
        self.pub_l = ChannelPublisher("rt/dex3/left/cmd", HandCmd_)
        self.pub_r = ChannelPublisher("rt/dex3/right/cmd", HandCmd_)
        self.sub_l = ChannelSubscriber("rt/lf/dex3/left/state", HandState_)
        self.sub_r = ChannelSubscriber("rt/lf/dex3/right/state", HandState_)
        self.pub_l.Init()
        self.pub_r.Init()
        self.sub_l.Init()
        self.sub_r.Init()

        self.msg_l = unitree_hg_msg_dds__HandCmd_()
        self.msg_r = unitree_hg_msg_dds__HandCmd_()
        self._init_msgs()

        # 5. 线程控制
        self._running = True
        self.sensor_thread = threading.Thread(target=self._sensor_loop, daemon=True) # 50Hz
        self.control_thread = threading.Thread(target=self._control_loop, daemon=True) # 50Hz
        self.write_thread = threading.Thread(target=self._write_cmd_loop, daemon=True) # 500Hz

    def _precompute_sigmoid_lut(self):
        """在初始化时调用一次"""
        lut = []
        for step in range(1, self.interp_steps + 1):
            ratio = self.get_sigmoid_ratio(step, self.interp_steps)
            lut.append(ratio)
        self.sigmoid_lut = lut

    def get_sigmoid_ratio(self, step, total_steps):
        """计算归一化的 Sigmoid 权重 (0.0 到 1.0)"""
        # 将进度映射到 -0.5 到 0.5
        x = step / total_steps

        # 标准 Sigmoid 公式映射
        # y = 1 / (1 + exp(-k * (x - 0.5)))
        val = 1.0 / (1.0 + np.exp(-self.sigmoid_k * (x - 0.5)))

        # 归一化偏移：确保 step=0 时结果严格为 0，step=total_steps 时严格为 1
        v0 = 1.0 / (1.0 + np.exp(-self.sigmoid_k * (0 - 0.5)))
        v1 = 1.0 / (1.0 + np.exp(-self.sigmoid_k * (1 - 0.5)))
        return (val - v0) / (v1 - v0)

    def _init_msgs(self):
        for i in range(7):
            self.msg_l.motor_cmd[i].mode = (i & 0x0F) | (0x01 << 4)
            self.msg_r.motor_cmd[i].mode = (i & 0x0F) | (0x01 << 4)

    def _get_alpha_sigmoid(self, p):
        if p < self.P_MIN: return 0.0
        if p > self.P_MAX: return 1.0
        return 1 / (1 + np.exp(-self.SIG_STEEPNESS * (p - self.SIG_CENTER)))

    def get_sensor_state(self, msg: HandState_):
        pressures = []
        if msg is None: return [self.P_MIN] * 6
        for i in range(6):
            data = np.array(msg.press_sensor_state[i].pressure) / 10000.0
            ref = np.max(data[[0, 2, 9, 11]]) if i % 2 == 0 else np.max(data[[3, 6, 8]])
            pressures.append(ref)
        return pressures

    def _sensor_loop(self):
        """后台更新 Kp/Kd 和回写当前状态"""
        while self._running:
            for side in ["left", "right"]:
                sub = self.sub_l if side == "left" else self.sub_r
                msg = sub.Read()
                if msg is None: continue

                # 更新自适应增益逻辑 (简化略，同之前逻辑)
                # ... 计算 kp_new, kd_new ...
                pressures = self.get_sensor_state(msg)
                kp_new, kd_new = [], []
                for j_id in range(7):
                    s_idx = self.JOINT_TO_SENSOR.get(j_id)
                    if s_idx is not None:
                        alpha = self._get_alpha_sigmoid(pressures[s_idx])
                        kp = self.KP_STIFF[j_id] + alpha * (self.KP_DAMPING[j_id] - self.KP_STIFF[j_id])
                        kd = self.KD_STIFF[j_id] + alpha * (self.KD_DAMPING[j_id] - self.KD_STIFF[j_id])
                    else:
                        kp, kd = self.KP_STIFF[j_id], self.KD_STIFF[j_id]
                    kp_new.append(kp)
                    kd_new.append(kd)

                if side == "left":
                    self._current_kp_l, self._current_kd_l = np.array(kp_new), np.array(kd_new)
                else:
                    self._current_kp_r, self._current_kd_r = np.array(kp_new), np.array(kd_new)

                # 回写到共享内存 (反馈给 WebXR 端)
                q_states = [msg.motor_state[i].q for i in range(7)]
                if side == "left":
                    self.shm_data_l[8:15] = q_states
                else:
                    self.shm_data_r[8:15] = q_states

            time.sleep(self.sensor_dt)

    def _control_loop(self):
        """核心控制循环：50Hz 更新目标"""
        while self._running:
            # 1. 从 SHM 读取最新目标
            new_target_l = self.shm_data_l[0:7].copy()
            new_target_r = self.shm_data_r[0:7].copy()

            # 2. 原子化更新插值起点和终点
            # 确保写入线程读取时，start 和 target 是匹配的对
            self.q_start_l = self.target_l
            self.q_start_r = self.target_r
            self.target_l = new_target_l
            self.target_r = new_target_r

            # 3. 重置帧计数
            self.current_interp_frame = 0

            time.sleep(self.control_dt)

    def _write_cmd_loop(self):
        """500Hz 高频写入"""
        while self._running:
            # 获取当前插值进度
            frame_idx = self.current_interp_frame
            if frame_idx < self.interp_steps:
                self.current_interp_frame += 1

            # 限制索引
            idx = max(0, min(frame_idx, self.interp_steps - 1))
            ratio = self.sigmoid_lut[idx]

            # 插值计算
            # 注意：如果 target 在 control_loop 更新了，这里会直接使用新值
            ql = self.q_start_l + ratio * (self.target_l - self.q_start_l)
            qr = self.q_start_r + ratio * (self.target_r - self.q_start_r)

            self._send_cmd("left", ql)
            self._send_cmd("right", qr)

            time.sleep(self.writer_dt)

    def _send_cmd(self, side, q_cmd):
        msg = self.msg_l if side == "left" else self.msg_r
        kp = self._current_kp_l if side == "left" else self._current_kp_r
        kd = self._current_kd_l if side == "left" else self._current_kd_r
        pub = self.pub_l if side == "left" else self.pub_r

        for i in range(7):
            msg.motor_cmd[i].q = float(q_cmd[i])
            msg.motor_cmd[i].kp = float(kp[i])
            msg.motor_cmd[i].kd = float(kd[i])
        pub.Write(msg)

    def start(self):
        # 初始化当前位置，防止启动跳变
        time.sleep(0.1)
        self.curr_q_cmd_l = self.shm_data_l[8:15].copy()
        self.curr_q_cmd_r = self.shm_data_r[8:15].copy()

        self.write_thread.start()
        self.sensor_thread.start()
        self.control_thread.start()

    def stop(self):
        self._running = False
        self.shm_l.close()
        self.shm_r.close()


import os
from unitree_sdk2py.core.channel import ChannelFactoryInitialize

if __name__ == "__main__":
    # 初始化环境
    ChannelFactoryInitialize(0)

    # 创建集成管理器 (会自动连接共享内存并开启双线程)
    manager = Dex3IntegratedManager()

    try:
        manager.start()
        print("Robot Hand System Integrated. Running...")
        while True:
            time.sleep(1.0)  # 主进程保持存活

    except KeyboardInterrupt:
        print("\nShutdown requested...")
    finally:
        manager.stop()
        # os._exit(0)  # 物理强制退出，避免报错
