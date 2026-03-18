import sys
import time
from multiprocessing import shared_memory
import numpy as np
from UnitreeG1.robot_hand_unitree import Dex3Control
from unitree_sdk2py.core.channel import ChannelFactoryInitialize

if __name__ == "__main__":
    ChannelFactoryInitialize(0)  # 0 for real robot, 1 for simulation
    hand = Dex3Control()

    shm_left_hand = shared_memory.SharedMemory(name='Left_Hand')
    shm_right_hand = shared_memory.SharedMemory(name='Right_Hand')

    left_hand_data = np.ndarray((16,), dtype=np.float32, buffer=shm_left_hand.buf)
    right_hand_data = np.ndarray((16,), dtype=np.float32, buffer=shm_right_hand.buf)

    alpha_hand = 0.7  # range 0-1, the larget the faster
    dt = 0.005  # 200Hz

    curr_left_hand_cmd = hand.get_states_left()
    curr_right_hand_cmd = hand.get_states_right()

    print("Robot Hand Running with 1st-order Filter...")

    try:
        while True:
            # 1. Get target from shared memory
            left_target = left_hand_data[0:7].copy()
            right_target = right_hand_data[0:7].copy()

            # 2. Filter
            # new_cmd = (1 - alpha) * last_cmd + alpha * target
            curr_left_hand_cmd = (1.0 - alpha_hand) * curr_left_hand_cmd + alpha_hand * left_target
            curr_right_hand_cmd = (1.0 - alpha_hand) * curr_right_hand_cmd + alpha_hand * right_target

            # 3. Execute command
            hand.execute_dual(curr_left_hand_cmd, curr_right_hand_cmd)

            # 4. Update robot hand state
            left_hand_data[8:15] = hand.get_states_left()
            right_hand_data[8:15] = hand.get_states_right()

            time.sleep(dt)

    except KeyboardInterrupt:
        shm_left_hand.close()
        shm_right_hand.close()
        print("Robot Hand Stopped.")
