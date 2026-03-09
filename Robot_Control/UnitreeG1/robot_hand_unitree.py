import time
import numpy as np
from enum import IntEnum
from unitree_sdk2py.core.channel import ChannelPublisher, ChannelSubscriber
from unitree_sdk2py.idl.unitree_hg.msg.dds_ import HandCmd_, HandState_
from unitree_sdk2py.idl.default import unitree_hg_msg_dds__HandCmd_


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
    kRightHandIndex0 = 3
    kRightHandIndex1 = 4
    kRightHandMiddle0 = 5
    kRightHandMiddle1 = 6

class Dex3Control:
    def __init__(self, kp=1.5, kd=0.2):
        # 1. 初始化发布者 (左右手 Topic 不同)
        self.left_publisher = ChannelPublisher("rt/dex3/left/cmd", HandCmd_)
        self.left_publisher.Init()
        self.right_publisher = ChannelPublisher("rt/dex3/right/cmd", HandCmd_)
        self.right_publisher.Init()

        # --- 新增：初始化订阅者 (读取状态) ---
        # 话题名称通常为 rt/dex3/left/state 和 rt/dex3/right/state
        self.left_subscriber = ChannelSubscriber("rt/dex3/left/state", HandState_)
        self.left_subscriber.Init()
        self.right_subscriber = ChannelSubscriber("rt/dex3/right/state", HandState_)
        self.right_subscriber.Init()

        # 2. 预初始化消息体
        self.left_msg = unitree_hg_msg_dds__HandCmd_()
        self.right_msg = unitree_hg_msg_dds__HandCmd_()

        # 配置默认 KP, KD 和 模式
        self._init_hand_msg(self.left_msg, Dex3_1_Left_JointIndex, kp, kd)
        self._init_hand_msg(self.right_msg, Dex3_1_Right_JointIndex, kp, kd)

    def _init_hand_msg(self, msg, joint_indices, kp, kd):
        """初始化电机为伺服位置模式 (0x01)"""
        for j in joint_indices:
            # 模式打包：status=0x01 (位置控制)
            msg.motor_cmd[j].mode = (j & 0x0F) | (0x01 << 4)
            msg.motor_cmd[j].q = 0.0
            msg.motor_cmd[j].kp = kp
            msg.motor_cmd[j].kd = kd

    def execute_left(self, q):
        """单独执行左手控制 (7位关节角)"""
        for idx, joint_id in enumerate(Dex3_1_Left_JointIndex):
            self.left_msg.motor_cmd[joint_id].q = float(q[idx])
        self.left_publisher.Write(self.left_msg)

    def execute_right(self, q):
        """单独执行右手控制 (7位关节角)"""
        for idx, joint_id in enumerate(Dex3_1_Right_JointIndex):
            self.right_msg.motor_cmd[joint_id].q = float(q[idx])
        self.right_publisher.Write(self.right_msg)

    def execute_dual(self, left_q, right_q):
        """同时执行双手控制"""
        self.execute_left(left_q)
        self.execute_right(right_q)

    def get_states_left(self):
        """获取左手当前 7 个关节的真实角度"""
        msg = self.left_subscriber.Read()
        if msg is None:
            return None

        # 根据定义的索引提取 q 值 (弧度)
        q_list = [msg.motor_state[j.value].q for j in Dex3_1_Left_JointIndex]
        return np.array(q_list)

    def get_states_right(self):
        """获取右手当前 7 个关节的真实角度"""
        msg = self.right_subscriber.Read()
        if msg is None:
            return None

        q_list = [msg.motor_state[j.value].q for j in Dex3_1_Right_JointIndex]
        return np.array(q_list)
