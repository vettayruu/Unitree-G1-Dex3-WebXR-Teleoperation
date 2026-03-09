import sys
import time
from multiprocessing import shared_memory
import numpy as np
from UnitreeG1.robot_hand_unitree import Dex3Control
from unitree_sdk2py.core.channel import ChannelFactoryInitialize

if __name__ == "__main__":
    ChannelFactoryInitialize(0)  # 0 for real robot, 1 for simulation
    hand = Dex3Control()

    try:
        shm_left_hand = shared_memory.SharedMemory(name='Left_Hand')
        shm_right_hand = shared_memory.SharedMemory(name='Right_Hand')

        left_hand_data = np.ndarray((16,), dtype=np.float32, buffer=shm_left_hand.buf)
        right_hand_data = np.ndarray((16,), dtype=np.float32, buffer=shm_right_hand.buf)

        omega = 65
        dt = 0.005 # Control FPS: 200Hz, 5ms

        curr_left_hand_joint = hand.get_states_left()
        curr_left_hand_vel = np.zeros_like(curr_left_hand_joint)

        curr_right_hand_joint = hand.get_states_right()
        curr_right_hand_vel = np.zeros_like(curr_right_hand_joint)

        print("Robot Hand Running...")

        while True:
            left_target = left_hand_data[0:7].copy()
            right_target = right_hand_data[0:7].copy()

            for _ in range(10):
                accel_left = (omega ** 2) * (left_target - curr_left_hand_joint) - (2 * omega) * curr_left_hand_vel
                curr_left_hand_vel += accel_left * dt
                curr_left_hand_joint += curr_left_hand_vel * dt

                accel_right = (omega ** 2) * (right_target - curr_right_hand_joint) - (2 * omega) * curr_right_hand_vel
                curr_right_hand_vel += accel_right * dt
                curr_right_hand_joint += curr_right_hand_vel * dt

                hand.execute_dual(curr_left_hand_joint, curr_right_hand_joint)

                time.sleep(dt)

            left_hand_data[8:15] = hand.get_states_left()
            right_hand_data[8:15] = hand.get_states_right()

    except KeyboardInterrupt:
        print("Robot Hand Stopped.")
