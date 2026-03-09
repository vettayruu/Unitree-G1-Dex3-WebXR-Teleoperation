import time
import threading
import numpy as np
from enum import IntEnum
from unitree_sdk2py.core.channel import ChannelPublisher, ChannelSubscriber
from unitree_sdk2py.idl.unitree_hg.msg.dds_ import LowCmd_ as hg_LowCmd, LowState_ as hg_LowState
from unitree_sdk2py.idl.default import unitree_hg_msg_dds__LowCmd_
from unitree_sdk2py.utils.crc import CRC

class G1_29_JointArmIndex(IntEnum):
    # Left arm
    kLeftShoulderPitch = 15
    kLeftShoulderRoll = 16
    kLeftShoulderYaw = 17
    kLeftElbow = 18
    kLeftWristRoll = 19
    kLeftWristPitch = 20
    kLeftWristyaw = 21

    # Right arm
    kRightShoulderPitch = 22
    kRightShoulderRoll = 23
    kRightShoulderYaw = 24
    kRightElbow = 25
    kRightWristRoll = 26
    kRightWristPitch = 27
    kRightWristYaw = 28

class G1ArmControl:
    def __init__(self, motion_mode=False):
        topic = "rt/arm_sdk" if motion_mode else "rt/lowcmd"
        self.publisher = ChannelPublisher(topic, hg_LowCmd)
        self.publisher.Init()
        self.subscriber = ChannelSubscriber("rt/lowstate", hg_LowState)
        self.subscriber.Init()

        self.msg = unitree_hg_msg_dds__LowCmd_()
        self.crc = CRC()

        # 等待获取当前状态以锁定非控制关节
        print("Waiting for DDS state...")
        initial_state = None
        while initial_state is None:
            initial_state = self.subscriber.Read()
            time.sleep(0.1)

        # 初始化所有 35 个电机的默认参数
        for i in range(35):
            self.msg.motor_cmd[i].mode = 1
            self.msg.motor_cmd[i].q = initial_state.motor_state[i].q
            self.msg.motor_cmd[i].dq = 0
            self.msg.motor_cmd[i].tau = 0

            # 刚度分配逻辑 (15-28 为手臂范围)
            if 15 <= i <= 28:
                if i in [19, 20, 21, 26, 27, 28]:  # 手腕
                    self.msg.motor_cmd[i].kp, self.msg.motor_cmd[i].kd = 40.0, 1.5
                else:  # 手臂大关节
                    self.msg.motor_cmd[i].kp, self.msg.motor_cmd[i].kd = 80.0, 3.0
            else:  # 身体锁定
                self.msg.motor_cmd[i].kp, self.msg.motor_cmd[i].kd = 200.0, 5.0

    def _publish(self):
        """内部调用：计算 CRC 并发布"""
        self.msg.crc = self.crc.Crc(self.msg)
        self.publisher.Write(self.msg)

    def execute_left(self, q, tau=None):
        """单独控制左臂 (7个关节)"""
        for i in range(7):
            idx = 15 + i
            self.msg.motor_cmd[idx].q = float(q[i])
            if tau is not None:
                self.msg.motor_cmd[idx].tau = float(tau[i])
        self._publish()

    def execute_right(self, q, tau=None):
        """单独控制右臂 (7个关节)"""
        for i in range(7):
            idx = 22 + i
            self.msg.motor_cmd[idx].q = float(q[i])
            if tau is not None:
                self.msg.motor_cmd[idx].tau = float(tau[i])
        self._publish()

    def execute_dual(self, left_q, right_q, left_tau=None, right_tau=None):
        """同时控制双臂"""
        # 填充左臂
        for i in range(7):
            idx = 15 + i
            self.msg.motor_cmd[idx].q = float(left_q[i])
            if left_tau is not None:
                self.msg.motor_cmd[idx].tau = float(left_tau[i])
        # 填充右臂
        for i in range(7):
            idx = 22 + i
            self.msg.motor_cmd[idx].q = float(right_q[i])
            if right_tau is not None:
                self.msg.motor_cmd[idx].tau = float(right_tau[i])
        self._publish()

    def get_states_dual(self):
        """获取当前手臂的真实位置反馈"""
        state = self.subscriber.Read()
        if state:
            l_q = [state.motor_state[i].q for i in range(15, 22)]
            r_q = [state.motor_state[i].q for i in range(22, 29)]
            return np.array(l_q), np.array(r_q)
        return None, None

    def get_states_left(self):
        """获取当前手臂的真实位置反馈"""
        state = self.subscriber.Read()
        if state:
            l_q = [state.motor_state[i].q for i in range(15, 22)]
            return np.array(l_q)
        return None

    def get_states_right(self):
        """获取当前手臂的真实位置反馈"""
        state = self.subscriber.Read()
        if state:
            r_q = [state.motor_state[i].q for i in range(22, 29)]
            return np.array(r_q)
        return None, None
