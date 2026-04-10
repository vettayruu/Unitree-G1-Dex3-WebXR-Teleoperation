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

# Kp = [
#     100, 0.5, 0.5, 0.5, 0.1, 0.1,  # leg left
#     100, 0.5, 0.5, 0.5, 0.1, 0.1,  # leg right
#     80, 0.5, 0.5,  # waist
#     88, 88, 80, 85, 30, 35, 35,  # arm left
#     88, 88, 80, 85, 30, 35, 35,  # arm right
# ]
#
# Kd = [
#     3.5, 0.1, 0.1, 0.1, 0.01, 0.01,  # leg left
#     3.5, 0.1, 0.1, 0.1, 0.01, 0.01,  # leg right
#     3.5, 1, 1,  # waist
#     2.5, 2.3, 2.0, 2.2, 0.50, 0.60, 0.60,  # arm left
#     2.5, 2.3, 2.0, 2.2, 0.50, 0.60, 0.60,  # arm right
# ]

# Trusco demo 2026/04/02
# Kp = [
#     80, 0.5, 0.5, 0.5, 0.1, 0.1,  # leg left
#     80, 0.5, 0.5, 0.5, 0.1, 0.1,  # leg right
#     80, 0.5, 0.5,  # waist
#     80, 80, 80, 80, 35, 35, 35,  # arm left
#     80, 80, 80, 80, 35, 35, 35,  # arm right
# ]
#
# Kd = [
#     3.5, 0.1, 0.1, 0.1, 0.01, 0.01,  # leg left
#     3.5, 0.1, 0.1, 0.1, 0.01, 0.01,  # leg right
#     3.5, 1, 1,  # waist
#     2.0, 2.0, 1.5, 1.5, 0.50, 0.50, 0.50,  # arm left
#     2.0, 2.0, 1.5, 1.5, 0.50, 0.50, 0.50,  # arm right
# ]

Kp = [
    80, 0.5, 0.5, 0.5, 0.1, 0.1,  # leg left
    80, 0.5, 0.5, 0.5, 0.1, 0.1,  # leg right
    85, 0.5, 0.5,  # waist
    70, 65, 60, 50, 30, 30, 30,  # arm left
    70, 65, 60, 50, 30, 30, 30,  # arm right
]

Kd = [
    10.0, 0.1, 0.1, 0.1, 0.01, 0.01,  # leg left
    10.0, 0.1, 0.1, 0.1, 0.01, 0.01,  # leg right
    12.0, 1, 1,  # waist
    8.5, 7.5, 6.5, 6.0, 3.5, 3.5, 3.0,  # arm left
    8.5, 7.5, 6.5, 6.0, 3.5, 3.5, 3.0,  # arm right
]
#
# Kp = [
#     80, 0.5, 10.0, 0.5, 0.1, 0.1,  # leg left
#     80, 0.5, 10.0, 0.5, 0.1, 0.1,  # leg right
#     100, 0.5, 0.5,  # waist
#     65, 50, 35, 40, 10.0, 18, 15,  # arm left
#     65, 50, 35, 40, 10.0, 18, 15,  # arm right
# ]
#
# Kd = [
#     3.5, 0.1, 0.1, 0.1, 0.01, 0.01,  # leg left
#     3.5, 0.1, 0.1, 0.1, 0.01, 0.01,  # leg right
#     5.0, 1, 1,  # waist
#     3.0, 1.50, 0.40, 0.25, 0.30, 0.40, 0.30,  # arm left
#     3.0, 1.50, 0.40, 0.25, 0.30, 0.40, 0.30,  # arm right
# ]

G1_NUM_MOTOR = 29

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


class Mode:
    PR = 0  # Series Control for Pitch/Roll Joints
    AB = 1  # Parallel Control for A/B Joints

class Custom:
    def __init__(self):
        # FPS
        self.write_dt_ = 0.002  # 500Hz (command write fps)
        self.control_dt_ = 0.02  # 50Hz (control fps)

        # 用于插值的变量
        self.q_start = np.zeros(G1_NUM_MOTOR)  # 50Hz 周期开始时的位置
        self.q_target = np.zeros(G1_NUM_MOTOR)  # 50Hz 周期结束时的目标位置
        self.interp_steps = int(self.control_dt_ / self.write_dt_)
        self.current_interp_frame = 0  # 记录当前处于 10 帧中的第几帧

        self.sigmoid_k = 6.18
        self._precompute_sigmoid_lut()

        # Initialize
        self.time_ = 0.0
        self.init_duration = 3.0
        self.initial_pose_captured = False
        self.teleop_initialized = False
        self.q_init_start = np.zeros(G1_NUM_MOTOR)  # 开机瞬间的姿态
        self.q_init_target = np.zeros(G1_NUM_MOTOR)  # 预设的目标初始化姿态 (Zero Pose + Hip Offset)
        self.q_init_target[0] = np.deg2rad(5.0)
        self.q_init_target[6] = np.deg2rad(5.0)

        self.low_cmd = unitree_hg_msg_dds__LowCmd_()
        self.low_state = None
        self.update_mode_machine_ = False
        self.crc = CRC()

        # Shared Memory
        self.shm_left_arm = shared_memory.SharedMemory(name='Left_Arm')
        self.shm_right_arm = shared_memory.SharedMemory(name='Right_Arm')
        self.shm_waist = shared_memory.SharedMemory(name='Waist')

        self.left_arm_view = np.ndarray((16,), dtype=np.float32, buffer=self.shm_left_arm.buf)
        self.right_arm_view = np.ndarray((16,), dtype=np.float32, buffer=self.shm_right_arm.buf)
        self.waist_view = np.ndarray((16,), dtype=np.float32, buffer=self.shm_waist.buf)

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

    def _precompute_sigmoid_lut(self):
        """在初始化时调用一次"""
        lut = []
        for step in range(1, self.interp_steps + 1):
            ratio = self.get_sigmoid_ratio(step, self.interp_steps)
            lut.append(ratio)
        self.sigmoid_lut = lut

    def Start(self):
        # ... 等待 low_state ...
        # while self.low_state is None:
        #     time.sleep(1)
        #
        # # 核心：启动前将 q_target 初始化为当前真实位置，防止第一帧跳变
        # current_q = np.array([motor.q for motor in self.low_state.motor_state])
        # self.q_target = current_q
        # self.q_init_target = np.copy(current_q)
        # self.q_start = np.copy(current_q)
        # # 然后再修改你需要的偏移，比如髋关节
        # self.q_init_target[0] = np.deg2rad(5.0)
        # self.q_init_target[6] = np.deg2rad(5.0)

        # Thread 1: 500Hz (Command Writer)
        self.writerThread = RecurrentThread(
            interval=self.write_dt_, target=self.LowCmdWrite, name="writer"
        )

        # Thread 2: 50Hz (Control Loop)
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
        # 1. 基础 CRC 计算前的预准备
        # 使用局部变量减少类属性查找开销（Python 优化小技巧）
        msg = self.low_cmd

        # 2. 根据阶段执行不同的位置更新策略
        if self.time_ < self.init_duration:
            # 在初始化阶段（Stage 1 & 2），ControlLogic 已经算好了平滑位置
            # 这里直接发布，不做二次插值
            pass
        else:
            # 3. 阶段 3：Teleoperation 细分插值
            if self.current_interp_frame < self.interp_steps:
                self.current_interp_frame += 1

            # 使用预计算好的 Sigmoid 数组，避免每秒 500 次的 exp 计算
            idx = max(0, min(self.current_interp_frame - 1, self.interp_steps - 1))
            ratio = self.sigmoid_lut[idx]

            # 批量切片操作比循环更快（如果使用 numpy 的话）
            # 这里针对 12-28 号电机进行线性混合
            for i in range(12, 29):  # range(12, 29) 覆盖 12 到 28
                start_q = self.q_start[i]
                target_q = self.q_target[i]
                msg.motor_cmd[i].q = start_q + ratio * (target_q - start_q)

        # 4. 统一计算 CRC 并写入
        msg.crc = self.crc.Crc(msg)
        self.lowcmd_publisher_.Write(msg)

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

    # --- Thread 2: 50Hz Control Loop ---
    def ControlLogic(self):
        self.time_ += self.control_dt_

        # Initialize
        if self.time_ < self.init_duration:
            # 1. 仅在第一帧捕捉一次真实位置，防止起点漂移
            if not self.initial_pose_captured:
                for i in range(G1_NUM_MOTOR):
                    self.q_init_start[i] = self.low_state.motor_state[i].q
                self.initial_pose_captured = True
                print("Captured initial pose, starting sigmoid transition...")

            # 2. 计算全局 Sigmoid 比例 (注意：这里用的是 0~5s 的全局比例)
            # 将 step 映射到 0~1
            t = np.clip(self.time_ / self.init_duration, 0.0, 1.0)
            # 使用 sigmoid 函数计算 ratio
            ratio = self.get_sigmoid_ratio(t, 1.0)

            # 3. 逐步逼近目标值
            for i in range(G1_NUM_MOTOR):
                self.low_cmd.mode_machine = self.mode_machine_
                self.low_cmd.motor_cmd[i].mode = 1
                # 核心：在【开机真实位置】和【预设目标位置】之间平滑插值
                self.low_cmd.motor_cmd[i].q = self.q_init_start[i] + ratio * (
                            self.q_init_target[i] - self.q_init_start[i])
                self.low_cmd.motor_cmd[i].kp = Kp[i]
                self.low_cmd.motor_cmd[i].kd = Kd[i]

        # Teleoperation
        else:
            # if not hasattr(self, 'teleop_initialized'):
            #     self.q_target = np.copy(self.q_init_target)
            #     self.teleop_initialized = True
            #     print("Teleoperation start...")
            #
            # if self.teleop_initialized:
            self.q_start = np.copy(self.q_target)

            # 1. Attach shared memory
            left_arm_data = self.left_arm_view
            right_arm_data = self.right_arm_view
            waist_data = self.waist_view

            # 2. Update robot state (shared memory and q_start)
            self._update_shm_feedback(left_arm_data, right_arm_data, waist_data)

            # 3. Control signal
            self._update_target(left_arm_data, right_arm_data, waist_data)
            self.current_interp_frame = 0

    def _update_shm_feedback(self, left_data, right_data, waist_data):
        # Waist
        for i in range(3):
            # Update shared memory
            waist_data[8 + i] = self.low_state.motor_state[12 + i].q

        # Arm
        for i in range(7):
            # Update shared memory
            left_data[9 + i] = self.low_state.motor_state[15 + i].q # Arm Left
            right_data[9 + i] = self.low_state.motor_state[22 + i].q # Arm Right

    def _update_target(self, left_data, right_data, waist_data):
        # Waist
        for i in range(3):
            self.q_target[12 + i] = waist_data[0 + i]

        # Left Arm and Right Arm
        for i in range(7):
            self.q_target[15 + i] = left_data[1 + i]
            self.q_target[22 + i] = right_data[1 + i]

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