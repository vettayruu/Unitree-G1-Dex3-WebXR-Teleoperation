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

Kp = [
    0.5, 0.5, 0.5, 0.5, 0.1, 0.1,  # leg left
    0.5, 0.5, 0.5, 0.5, 0.1, 0.1,  # leg right
    100, 0.5, 0.5,  # waist
    88, 88, 80, 85, 30, 35, 35,  # arm left
    88, 88, 80, 85, 30, 35, 35,  # arm right
]

Kd = [
    0.1, 0.1, 0.1, 0.1, 0.01, 0.01,  # leg left
    0.1, 0.1, 0.1, 0.1, 0.01, 0.01,  # leg right
    3.5, 1, 1,  # waist
    2.3, 2.3, 2.0, 2.2, 0.50, 0.60, 0.60,  # arm left
    2.3, 2.3, 2.0, 2.2, 0.50, 0.60, 0.60,  # arm right
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
    WaistA = 13  # NOTE: INVALID for g1 23dof/29dof with waist locked
    WaistPitch = 14  # NOTE: INVALID for g1 23dof/29dof with waist locked
    WaistB = 14  # NOTE: INVALID for g1 23dof/29dof with waist locked
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
        self.control_dt_ = 0.005  # 200Hz (control fps)

        self.time_ = 0.0
        self.duration_ = 3.0
        self.low_cmd = unitree_hg_msg_dds__LowCmd_()
        self.low_state = None
        self.update_mode_machine_ = False
        self.crc = CRC()

        # Shared Memory
        self.shm_left_arm = shared_memory.SharedMemory(name='Left_Arm')
        self.shm_right_arm = shared_memory.SharedMemory(name='Right_Arm')

        # Control Parameter
        self.alpha = 0.042

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

    # --- Thread 2: 200Hz Control Loop ---
    def ControlLogic(self):
        self.time_ += self.control_dt_

        # [Stage 1]: Set Zero Pose and Initial Parameters
        if self.time_ < self.duration_:
            ratio = np.clip(self.time_ / self.duration_, 0.0, 1.0)
            for i in range(G1_NUM_MOTOR):
                self.low_cmd.mode_machine = self.mode_machine_
                self.low_cmd.motor_cmd[i].mode = 1
                self.low_cmd.motor_cmd[i].q = (1.0 - ratio) * self.low_state.motor_state[i].q
                self.low_cmd.motor_cmd[i].kp = Kp[i]
                self.low_cmd.motor_cmd[i].kd = Kd[i]

        # [Stage 2]: Set lower limb parameters
        elif self.time_ < self.duration_ * 1.5:
            self.low_cmd.motor_cmd[0].q = self.low_state.motor_state[0].q
            self.low_cmd.motor_cmd[6].q = self.low_state.motor_state[6].q
            self.low_cmd.motor_cmd[0].kp = 85
            self.low_cmd.motor_cmd[6].kp = 85

        # [Stage 3]: Teleoperation
        else:
            # 1. Attach shared memory
            left_arm_data = np.ndarray((16,), dtype=np.float32, buffer=self.shm_left_arm.buf)
            right_arm_data = np.ndarray((16,), dtype=np.float32, buffer=self.shm_right_arm.buf)

            # 2. Update robot state
            self._update_shm_feedback(left_arm_data, right_arm_data)

            # 3. Control signal
            self._apply_all_smooth_control(left_arm_data, right_arm_data)

    def _update_shm_feedback(self, left_data, right_data):
        for i in range(7):
            left_data[9 + i] = self.low_state.motor_state[15 + i].q
            right_data[9 + i] = self.low_state.motor_state[22 + i].q

    def _apply_all_smooth_control(self, left_data, right_data):
        def apply_smooth(joint_idx, target_q):
            prev_q = self.low_cmd.motor_cmd[joint_idx].q
            self.low_cmd.motor_cmd[joint_idx].q = (1.0 - self.alpha) * prev_q + self.alpha * target_q

        for i in range(7):
            apply_smooth(15 + i, left_data[1 + i])
            apply_smooth(22 + i, right_data[1 + i])

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