import time
import sys

from unitree_sdk2py.core.channel import ChannelPublisher, ChannelFactoryInitialize
from unitree_sdk2py.core.channel import ChannelSubscriber, ChannelFactoryInitialize
from unitree_sdk2py.idl.default import unitree_hg_msg_dds__LowCmd_
from unitree_sdk2py.idl.default import unitree_hg_msg_dds__LowState_
from unitree_sdk2py.idl.unitree_hg.msg.dds_ import LowCmd_
from unitree_sdk2py.idl.unitree_hg.msg.dds_ import LowState_
from unitree_sdk2py.utils.crc import CRC
from unitree_sdk2py.utils.thread import RecurrentThread
from unitree_sdk2py.comm.motion_switcher.motion_switcher_client import MotionSwitcherClient

import numpy as np
from multiprocessing import shared_memory

G1_NUM_MOTOR = 29

# 参考参数 dt = 0.010, omega = 15.0
# Kp = [
#     80, 0.5, 0.5, 0.5, 0.1, 0.1,  # leg left
#     80, 0.5, 0.5, 0.5, 0.1, 0.1,  # leg right
#     60, 0.5, 0.5,  # waist
#     55, 55, 45, 45, 12, 15, 15,  # arm left
#     55, 55, 45, 45, 12, 15, 15,  # arm right
# ]
#
# Kd = [
#     10.0, 0.1, 0.1, 0.1, 0.01, 0.01,  # leg left
#     10.0, 0.1, 0.1, 0.1, 0.01, 0.01,  # leg right
#     10.0, 1, 1,  # waist
#     5.0, 5.0, 4.0, 3.5, 1.5, 2.0, 2.0,  # arm left
#     5.0, 5.0, 4.0, 3.5, 1.5, 2.0, 2.0,  # arm right
# ]

Kp = [
    80, 0.5, 0.5, 0.5, 0.1, 0.1,  # leg left
    80, 0.5, 0.5, 0.5, 0.1, 0.1,  # leg right
    60, 0.5, 0.5,  # waist
    85, 95, 70, 75, 20, 30, 25,  # arm left
    85, 95, 70, 75, 20, 30, 25,  # arm right
]

Kd = [
    10.0, 0.1, 0.1, 0.1, 0.01, 0.01,  # leg left
    10.0, 0.1, 0.1, 0.1, 0.01, 0.01,  # leg right
    10.0, 1, 1,  # waist
    5.0, 4.5, 4.2, 4.2, 1.5, 2.0, 2.0,  # arm left
    5.0, 4.5, 4.2, 4.2, 1.5, 2.0, 2.0,  # arm right
]

class G1JointIndex:
    LeftHipPitch = 0
    LeftHipRoll = 1
    LeftHipYaw = 2
    LeftKnee = 3
    LeftAnklePitch = 4
    LeftAnkleB = 4
    LeftAnkleRoll = 5
    LeftAnkleA = 5
    RightHipPitch = 6
    RightHipRoll = 7
    RightHipYaw = 8
    RightKnee = 9
    RightAnklePitch = 10
    RightAnkleB = 10
    RightAnkleRoll = 11
    RightAnkleA = 11
    WaistYaw = 12
    WaistRoll = 13  # NOTE: INVALID for g1 23dof/29dof with waist locked
    # WaistA = 13  # NOTE: INVALID for g1 23dof/29dof with waist locked
    WaistPitch = 14  # NOTE: INVALID for g1 23dof/29dof with waist locked
    # WaistB = 14  # NOTE: INVALID for g1 23dof/29dof with waist locked
    LeftShoulderPitch = 15
    LeftShoulderRoll = 16
    LeftShoulderYaw = 17
    LeftElbow = 18
    LeftWristRoll = 19
    LeftWristPitch = 20  # NOTE: INVALID for g1 23dof
    LeftWristYaw = 21  # NOTE: INVALID for g1 23dof
    RightShoulderPitch = 22
    RightShoulderRoll = 23
    RightShoulderYaw = 24
    RightElbow = 25
    RightWristRoll = 26
    RightWristPitch = 27  # NOTE: INVALID for g1 23dof
    RightWristYaw = 28  # NOTE: INVALID for g1 23dof

class Custom:
    def __init__(self):
        # FPS
        self.write_dt_ = 0.002  # 500Hz
        self.control_dt_ = 0.005  # 200Hz

        self.time_ = 0.0
        self.duration_ = 5.0
        self.low_cmd = unitree_hg_msg_dds__LowCmd_()
        self.low_state = None
        self.update_mode_machine_ = False
        self.crc = CRC()

        # Shared Memory
        self.shm_left_arm  = shared_memory.SharedMemory(name='Left_Arm')
        self.shm_right_arm = shared_memory.SharedMemory(name='Right_Arm')
        self.shm_waist     = shared_memory.SharedMemory(name='Waist')

        # --- 二阶阻尼核心参数 ---
        # Omega (ω) 决定响应速度。10.0-15.0 比较柔顺，20.0+ 响应快但对噪声敏感
        self.omega = 13.5

        # 必须存储每个关节的实时速度
        self.joint_velocities = np.zeros(G1_NUM_MOTOR)
        self.q_init_start = np.zeros(G1_NUM_MOTOR)
        self.initial_pose_captured = False

    def Init(self):
        self.msc = MotionSwitcherClient()
        self.msc.SetTimeout(5.0)
        self.msc.Init()

        status, result = self.msc.CheckMode()
        while result['name']:
            self.msc.ReleaseMode()
            status, result = self.msc.CheckMode()
            time.sleep(1)

        # create publisher #
        self.lowcmd_publisher_ = ChannelPublisher("rt/lowcmd", LowCmd_)
        self.lowcmd_publisher_.Init()

        # create subscriber #
        self.lowstate_subscriber = ChannelSubscriber("rt/lowstate", LowState_)
        self.lowstate_subscriber.Init(self.LowStateHandler, 10)

    def Start(self):
        # Thread 1: 500Hz (Command Writer)
        self.writerThread = RecurrentThread(
            interval=self.write_dt_, target=self.LowCmdWrite, name="writer"
        )

        # Thread 2: 200Hz (Control Loop)
        self.controlThread = RecurrentThread(
            interval=self.control_dt_, target=self.ControlLogic, name="control"
        )

        while self.low_state is None:
            print("Waiting for robot state...")
            time.sleep(1)

        self.writerThread.Start()
        self.controlThread.Start()

    # --- Thread 1: 500Hz Command Writer ---
    def LowCmdWrite(self):
        self.low_cmd.crc = self.crc.Crc(self.low_cmd)
        self.lowcmd_publisher_.Write(self.low_cmd)

    def ControlLogic(self):
        self.time_ += self.control_dt_

        # ★ 第一帧捕捉初始位置，同时设好所有轴的kp/kd
        if not self.initial_pose_captured:
            for i in range(G1_NUM_MOTOR):
                self.q_init_start[i] = self.low_state.motor_state[i].q
                # 初始化指令值 = 当前实际值，让二阶积分器有正确起点
                self.low_cmd.motor_cmd[i].q  = self.q_init_start[i]
                self.low_cmd.motor_cmd[i].kp = Kp[i]
                self.low_cmd.motor_cmd[i].kd = Kd[i]
                self.low_cmd.motor_cmd[i].mode = 1
            self.low_cmd.mode_machine = self.mode_machine_
            self.initial_pose_captured = True
            print("Initial pose captured.")

        # Stage 1: 归零（用二阶阻尼，目标是零位+髋关节偏置）
        if self.time_ < self.duration_:
            hip_target = np.deg2rad(28.0)

            # 用 quintic 包络让目标值本身缓慢移动
            t = np.clip(self.time_ / self.duration_, 0.0, 1.0)
            envelope = 10 * t ** 3 - 15 * t ** 4 + 6 * t ** 5  # 0→1，起止速度=0

            for i in range(G1_NUM_MOTOR):
                if i == 0 or i == 6:
                    # 从初始位置缓动到 hip_target
                    target = self.q_init_start[i] + envelope * (hip_target - self.q_init_start[i])
                else:
                    # 从初始位置缓动到 0
                    target = self.q_init_start[i] + envelope * (0.0 - self.q_init_start[i])

                self.apply_second_order_damped(i, target)

        # Stage 2: 遥操
        else:
            left_arm_data = np.ndarray((16,), dtype=np.float32, buffer=self.shm_left_arm.buf)
            right_arm_data = np.ndarray((16,), dtype=np.float32, buffer=self.shm_right_arm.buf)
            waist_data = np.ndarray((16,), dtype=np.float32, buffer=self.shm_waist.buf)

            self._update_shm_feedback(left_arm_data, right_arm_data, waist_data)
            self._apply_all_second_order_dq_control(left_arm_data, right_arm_data, waist_data)

    def _apply_all_second_order_dq_control(self, left_arm_q, right_arm_q, waist_data):
        # Left Arm (15-21)
        for i in range(7):
            self.apply_second_order_damped(15 + i, left_arm_q[1 + i])

        # Right Arm (22-28)
        for i in range(7):
            self.apply_second_order_damped(22 + i, right_arm_q[1 + i])

        # Waist (12-14)
        for i in range(3):
            self.apply_second_order_damped(12 + i, waist_data[i])

    def apply_second_order_damped(self, joint_idx, target_q):
        curr_q = self.low_cmd.motor_cmd[joint_idx].q
        curr_v = self.low_cmd.motor_cmd[joint_idx].dq
        dt = self.control_dt_

        error = target_q - curr_q
        error_v = 0 - curr_v

        accel = (self.omega ** 2) * error + (2.0 * self.omega) * error_v
        new_v = curr_v + accel * dt
        new_q = curr_q + new_v * dt

        self.low_cmd.motor_cmd[joint_idx].q = float(new_q)
        self.low_cmd.motor_cmd[joint_idx].dq = float(new_v)

    def _update_shm_feedback(self, left_data, right_data, waist_data):
        for i in range(7):
            left_data[9 + i] = self.low_state.motor_state[15 + i].q
            right_data[9 + i] = self.low_state.motor_state[22 + i].q

        for i in range(3):
            waist_data[8 + i] = self.low_state.motor_state[12 + i].q

    def LowStateHandler(self, msg: LowState_):
        self.low_state = msg
        if not self.update_mode_machine_:
            self.mode_machine_ = msg.mode_machine
            self.update_mode_machine_ = True

    def Close(self):
        # 1. Thread Stop
        if hasattr(self, 'writerThread'):
            print("Stopping writer thread...")
            self.writerThread.Wait(1.0)

        if hasattr(self, 'controlThread'):
            print("Stopping control thread...")
            self.controlThread.Wait(1.0)

        # 2. Shared Memory Disconnect
        try:
            self.shm_left_arm.close()
            self.shm_right_arm.close()
            self.shm_waist.close()
            print("Shared memory connections closed.")
        except Exception as e:
            print(f"Error during SHM closing: {e}")


if __name__ == '__main__':

    print("WARNING: Please ensure there are no obstacles around the robot while running this example.")
    input("Press Enter to continue...")

    if len(sys.argv) > 1:
        ChannelFactoryInitialize(0, sys.argv[1])
    else:
        ChannelFactoryInitialize(0)

    custom = Custom()
    custom.Init()
    custom.Start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping robot control...")
    finally:
        custom.Close()
        print("Resource cleanup complete. Exiting.")