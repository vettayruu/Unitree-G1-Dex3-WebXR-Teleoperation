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
    kRightHandMiddle0 = 3
    kRightHandMiddle1 = 4
    kRightHandIndex0 = 5
    kRightHandIndex1 = 6


LEFT_HAND_OFFSET = {
    0: -0.051821254, 1: 0.020018041, 2: 0.017435133,
    3: -0.070589177, 4: -0.030280081,
    5: -0.062465608, 6: -0.025254435
}

LEFT_HAND_KP = {
    0: 1.0, 1: 1.0, 2: 1.2,
    3: 0.85, 4: 1.2,
    5: 1.0, 6: 1.2
}

LEFT_HAND_KD = {
    0: 0.15, 1: 0.2, 2: 0.2,
    3: 0.15, 4: 0.2,
    5: 0.15, 6: 0.2
}

RIGHT_HAND_OFFSET = {
    0: -0.25989729166030884, 1: -0.024336032569408417, 2: -0.08899030834436417,
    3: 0.0743151307106018, 4: 0.01779387705028057,
    5: 0.0906544178724289, 6: 0.016621936112642288
}

RIGHT_HAND_KP = {
    0: 1.0, 1: 1.0, 2: 1.2,
    3: 0.85, 4: 1.2,
    5: 1.0, 6: 1.2
}

RIGHT_HAND_KD = {
    0: 0.15, 1: 0.2, 2: 0.2,
    3: 0.15, 4: 0.2,
    5: 0.15, 6: 0.2
}

class Dex3Control:
    def __init__(self):
        # Publisher and Subscriber
        self.left_publisher = ChannelPublisher("rt/dex3/left/cmd", HandCmd_)
        self.left_publisher.Init()
        self.right_publisher = ChannelPublisher("rt/dex3/right/cmd", HandCmd_)
        self.right_publisher.Init()

        self.left_subscriber = ChannelSubscriber("rt/dex3/left/state", HandState_)
        self.left_subscriber.Init()
        self.right_subscriber = ChannelSubscriber("rt/dex3/right/state", HandState_)
        self.right_subscriber.Init()

        self.left_offset = LEFT_HAND_OFFSET
        self.right_offset = RIGHT_HAND_OFFSET

        # 2. Command Message
        self.left_msg = unitree_hg_msg_dds__HandCmd_()
        self.right_msg = unitree_hg_msg_dds__HandCmd_()

        # 3. Control Parameter Initialize
        self._init_hand_msg(self.left_msg, Dex3_1_Left_JointIndex, LEFT_HAND_KP, LEFT_HAND_KD)
        self._init_hand_msg(self.right_msg, Dex3_1_Right_JointIndex, RIGHT_HAND_KP, RIGHT_HAND_KD)

    def _init_hand_msg(self, msg, joint_indices, kp_dict, kd_dict):
        for logical_idx, joint_enum in enumerate(joint_indices):
            j_id = joint_enum.value

            # Get number from dictionary，default Kp=1.0, Kd=0.2
            # Note: Kp should not be set too high, as it may cause the finger motor to lose power.
            kp = kp_dict.get(logical_idx, 1.0)
            kd = kd_dict.get(logical_idx, 0.2)

            # Mode：status=0x01 (Position Control)
            msg.motor_cmd[j_id].mode = (j_id & 0x0F) | (0x01 << 4)
            msg.motor_cmd[j_id].q = 0.0
            msg.motor_cmd[j_id].kp = kp
            msg.motor_cmd[j_id].kd = kd

            # print(f"Joint {j_id} initialized with KP: {kp}, KD: {kd}")

    # Execute without offset
    def execute_left(self, q):
        for idx, joint_id in enumerate(Dex3_1_Left_JointIndex):
            self.left_msg.motor_cmd[joint_id].q = float(q[idx])
        self.left_publisher.Write(self.left_msg)

    def execute_right(self, q):
        for idx, joint_id in enumerate(Dex3_1_Right_JointIndex):
            self.right_msg.motor_cmd[joint_id].q = float(q[idx])
        self.right_publisher.Write(self.right_msg)

    # Execute with calibration offset
    def execute_left_offset(self, q):
        for idx, joint_id in enumerate(Dex3_1_Left_JointIndex):
            # control signal = target + offset
            offset = self.left_offset.get(idx, 0.0)
            self.left_msg.motor_cmd[joint_id].q = float(q[idx]) + offset
        self.left_publisher.Write(self.left_msg)

    def execute_right_offset(self, q):
        for idx, joint_id in enumerate(Dex3_1_Right_JointIndex):
            offset = self.right_offset.get(idx, 0.0)
            self.right_msg.motor_cmd[joint_id].q = float(q[idx]) + offset
            self.right_msg.motor_cmd[joint_id].kp = RIGHT_HAND_KP[joint_id]
        self.right_publisher.Write(self.right_msg)

    def execute_dual(self, left_q, right_q):
        self.execute_left_offset(left_q)
        self.execute_right_offset(right_q)

    def get_states_left(self):
        msg = self.left_subscriber.Read()
        if msg is None:
            return None

        q_list = [msg.motor_state[j.value].q for j in Dex3_1_Left_JointIndex]
        return np.array(q_list)

    def get_states_right(self):
        msg = self.right_subscriber.Read()
        if msg is None:
            return None

        q_list = [msg.motor_state[j.value].q for j in Dex3_1_Right_JointIndex]
        return np.array(q_list)

