import sys
import time
from multiprocessing import shared_memory
import numpy as np
from UnitreeG1.robot_arm import G1ArmControl
from unitree_sdk2py.core.channel import ChannelFactoryInitialize

if __name__ == "__main__":
    ChannelFactoryInitialize(0)  # 0 for real robot, 1 for simulation
    arm = G1ArmControl(motion_mode=True)

    try:
        shm_left_arm = shared_memory.SharedMemory(name='Left_Arm')
        shm_right_arm = shared_memory.SharedMemory(name='Right_Arm')

        left_arm_data = np.ndarray((16,), dtype=np.float32, buffer=shm_left_arm.buf)
        right_arm_data = np.ndarray((16,), dtype=np.float32, buffer=shm_right_arm.buf)

        curr_left_arm_joint = arm.get_states_left()
        curr_right_arm_joint = arm.get_states_right()

        curr_left_arm_vel = np.zeros_like(curr_left_arm_joint)
        curr_right_arm_vel = np.zeros_like(curr_right_arm_joint)

        omega = 36.0
        dt = 0.005  # Control FPS: 200Hz, 5ms

        print("Robot Arm Running...")

        while True:
            # Get joint control message from shared memory
            left_target = left_arm_data[1:8].copy() # joint 0 is waist joint, and it is not used
            right_target = right_arm_data[1:8].copy()

            # Execute with filter
            for _ in range(10):
                accel_left = (omega ** 2) * (left_target - curr_left_arm_joint) - (2 * omega) * curr_left_arm_vel
                curr_left_arm_vel += accel_left * dt
                curr_left_arm_joint += curr_left_arm_vel * dt

                accel_right = (omega ** 2) * (right_target - curr_right_arm_joint) - (2 * omega) * curr_right_arm_vel
                curr_right_arm_vel += accel_right * dt
                curr_right_arm_joint += curr_right_arm_vel * dt

                arm.execute_dual(curr_left_arm_joint, curr_right_arm_joint)

                time.sleep(dt)

            # Update robot state
            left_arm_data[9:16] = arm.get_states_left()
            right_arm_data[9:16] = arm.get_states_right()

    except KeyboardInterrupt:
        print("Robot Arm Stopped.")

