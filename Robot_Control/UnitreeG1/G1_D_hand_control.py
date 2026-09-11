import threading
import time
import numpy as np
from enum import IntEnum
from multiprocessing import shared_memory
from unitree_sdk2py.core.channel import ChannelPublisher, ChannelSubscriber, ChannelFactoryInitialize
from unitree_sdk2py.idl.unitree_go.msg.dds_ import MotorCmds_, MotorStates_
from unitree_sdk2py.idl.default import unitree_go_msg_dds__MotorCmd_
from unitree_sdk2py.utils.thread import RecurrentThread


class SimpleLogger:
    def info(self, msg): print(f"[INFO] {msg}")

    def warning(self, msg): print(f"[WARN] {msg}")


logger_mp = SimpleLogger()

class Gripper_JointIndex(IntEnum):
    kGripper = 0

kTopicGripperLeftCommand = "rt/dex1/left/cmd"
kTopicGripperLeftState = "rt/dex1/left/state"
kTopicGripperRightCommand = "rt/dex1/right/cmd"
kTopicGripperRightState = "rt/dex1/right/state"


class Dex1IntegratedManager:
    def __init__(self, shm_name_l='Left_Hand', shm_name_r='Right_Hand', simulation_mode=False):
        logger_mp.info("Initialize Dex1IntegratedManager...")

        self.control_dt = 0.02  # 50Hz 
        self.writer_dt = 0.002  # 500Hz 
        self.simulation_mode = simulation_mode
        self.gripper_sub_ready = False

        self.LEFT_MAPPED_MIN, self.LEFT_MAPPED_MAX = 0.0, 5.40
        self.RIGHT_MAPPED_MIN, self.RIGHT_MAPPED_MAX = 0.0, 5.40
        self.dex3_thumb_rad_range = [0.0, np.deg2rad(30.0)]

        self.interp_steps = int(self.control_dt / self.writer_dt)  # = 10
        self.sigmoid_k = 8.0
        self.sigmoid_lut = self._precompute_sigmoid_lut()

        self._lock = threading.Lock()
        self._seg_q0_l = 0.0  # 左夹爪当前插值段起点
        self._seg_q1_l = 0.0  # 左夹爪当前插值段终点
        self._seg_q0_r = 0.0  # 右夹爪当前插值段起点
        self._seg_q1_r = 0.0  # 右夹爪当前插值段终点
        self._interp_frame = 0  # 当前插值步数进度计数器

        self.shm_l = shared_memory.SharedMemory(name=shm_name_l)
        self.shm_r = shared_memory.SharedMemory(name=shm_name_r)
        self.shm_data_l = np.ndarray((16,), dtype=np.float32, buffer=self.shm_l.buf)
        self.shm_data_r = np.ndarray((16,), dtype=np.float32, buffer=self.shm_r.buf)

        self._state_lock = threading.Lock()
        self.left_gripper_real_q = 0.0
        self.right_gripper_real_q = 0.0

        self.LeftGripperCmb_publisher = ChannelPublisher(kTopicGripperLeftCommand, MotorCmds_)
        self.RightGripperCmb_publisher = ChannelPublisher(kTopicGripperRightCommand, MotorCmds_)
        self.LeftGripperCmb_publisher.Init()
        self.RightGripperCmb_publisher.Init()

        self.LeftGripperState_subscriber = ChannelSubscriber(kTopicGripperLeftState, MotorStates_)
        self.RightGripperState_subscriber = ChannelSubscriber(kTopicGripperRightState, MotorStates_)

        self.LeftGripperState_subscriber.Init(lambda msg: self._on_gripper_state(msg, "left"), 10)
        self.RightGripperState_subscriber.Init(lambda msg: self._on_gripper_state(msg, "right"), 10)

        while not self.gripper_sub_ready:
            time.sleep(0.01)
            logger_mp.warning("Waiting to subscribe gripper dds state...")
        logger_mp.info("Subscribe gripper dds ok.")

        self.left_gripper_msg = MotorCmds_()
        self.left_gripper_msg.cmds = [unitree_go_msg_dds__MotorCmd_()]
        self.right_gripper_msg = MotorCmds_()
        self.right_gripper_msg.cmds = [unitree_go_msg_dds__MotorCmd_()]

        for msg in [self.left_gripper_msg, self.right_gripper_msg]:
            msg.cmds[0].dq = 0.0
            msg.cmds[0].tau = 0.0
            msg.cmds[0].kp = 3.0  
            msg.cmds[0].kd = 0.1  
            # msg.cmds[0].kp = 0.75 
            # msg.cmds[0].kd = 0.25  

    def _precompute_sigmoid_lut(self):
        lut = []
        for step in range(1, self.interp_steps + 1):
            x = step / self.interp_steps
            val = 1.0 / (1.0 + np.exp(-self.sigmoid_k * (x - 0.5)))
            v0 = 1.0 / (1.0 + np.exp(-self.sigmoid_k * (0.0 - 0.5)))
            v1 = 1.0 / (1.0 + np.exp(-self.sigmoid_k * (1.0 - 0.5)))
            lut.append((val - v0) / (v1 - v0))
        return lut

    def _on_gripper_state(self, msg: MotorStates_, side: str):
        if msg is not None and len(msg.states) > 0:
            with self._state_lock:
                if side == "left":
                    self.left_gripper_real_q = msg.states[0].q
                else:
                    self.right_gripper_real_q = msg.states[0].q
            self.gripper_sub_ready = True

    def _control_loop(self):
        left_thumb_rad = float(self.shm_data_l[1])
        right_thumb_rad = abs(float(self.shm_data_r[1]))

        new_target_l = np.interp(left_thumb_rad, self.dex3_thumb_rad_range,
                                 [self.LEFT_MAPPED_MIN, self.LEFT_MAPPED_MAX])
        new_target_r = np.interp(right_thumb_rad, self.dex3_thumb_rad_range,
                                 [self.RIGHT_MAPPED_MIN, self.RIGHT_MAPPED_MAX])

        with self._lock:
            self._seg_q0_l = self._seg_q1_l
            self._seg_q0_r = self._seg_q1_r
            self._seg_q1_l = new_target_l
            self._seg_q1_r = new_target_r
            self._interp_frame = 0 

    def _write_cmd_loop(self):
        if self._interp_frame < self.interp_steps:
            self._interp_frame += 1

        idx = min(self._interp_frame - 1, self.interp_steps - 1)
        ratio = self.sigmoid_lut[idx]

        with self._lock:
            q0_l, q1_l = self._seg_q0_l, self._seg_q1_l
            q0_r, q1_r = self._seg_q0_r, self._seg_q1_r

        ql_cmd = self.LEFT_MAPPED_MAX - q0_l + ratio * (q1_l - q0_l)
        qr_cmd = self.RIGHT_MAPPED_MAX - q0_r + ratio * (q1_r - q0_r)

        self.left_gripper_msg.cmds[0].q = float(ql_cmd)
        self.right_gripper_msg.cmds[0].q = float(qr_cmd)

        self.LeftGripperCmb_publisher.Write(self.left_gripper_msg)
        self.RightGripperCmb_publisher.Write(self.right_gripper_msg)

    def start(self):
        with self._state_lock:
            init_q_l = self.left_gripper_real_q
            init_q_r = self.right_gripper_real_q

        self._seg_q0_l = init_q_l
        self._seg_q1_l = init_q_l
        self._seg_q0_r = init_q_r
        self._seg_q1_r = init_q_r

        self.controlThread = RecurrentThread(
            interval=self.control_dt, target=self._control_loop, name="gripper_ctrl"
        )
        self.writerThread = RecurrentThread(
            interval=self.writer_dt, target=self._write_cmd_loop, name="gripper_write"
        )
        self.controlThread.Start()
        self.writerThread.Start()
        print("Dex1 Integrated Gripper System Started smoothly (50Hz Ctrl / 500Hz Write).")

    def stop(self):
        if hasattr(self, 'writerThread'):  self.writerThread.Wait(1.0)
        if hasattr(self, 'controlThread'): self.controlThread.Wait(1.0)
        self.shm_l.close()
        self.shm_r.close()
        logger_mp.info("Dex1IntegratedManager has been safely closed.")


if __name__ == "__main__":
    ChannelFactoryInitialize(0)

    manager = Dex1IntegratedManager()
    manager.start()

    try:
        while True:
            time.sleep(1.0)
    except KeyboardInterrupt:
        print("\nShutdown Request Received...")
    finally:
        manager.stop()
