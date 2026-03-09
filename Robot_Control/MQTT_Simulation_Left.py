import sys
import time
from multiprocessing import shared_memory
import numpy as np
from Sim.CoppeliasimControl import CoppeliasimControl

if __name__ == '__main__':

    joint_list = ['/waist_yaw_joint',
                  '/waist_roll_joint/left_shoulder_pitch_joint',
                  '/waist_roll_joint/left_shoulder_roll_joint',
                  '/waist_roll_joint/left_shoulder_yaw_joint',
                  '/waist_roll_joint/left_elbow_joint',
                  '/waist_roll_joint/left_wrist_roll_joint',
                  '/waist_roll_joint/left_wrist_pitch_joint',
                  '/waist_roll_joint/left_wrist_yaw_joint',
                  ]
    tool_list = ['/waist_roll_joint/left_hand_palm_joint/left_hand_thumb_0_joint',
                 '/waist_roll_joint/left_hand_palm_joint/left_hand_thumb_0_joint/left_hand_thumb_1_joint',
                 '/waist_roll_joint/left_hand_palm_joint/left_hand_thumb_0_joint/left_hand_thumb_2_joint',
                 '/waist_roll_joint/left_hand_palm_joint/left_hand_middle_0_joint',
                 '/waist_roll_joint/left_hand_palm_joint/left_hand_middle_0_joint/left_hand_middle_1_joint',
                 '/waist_roll_joint/left_hand_palm_joint/left_hand_index_0_joint',
                 '/waist_roll_joint/left_hand_palm_joint/left_hand_index_0_joint/left_hand_index_1_joint',
                 ]
    sim = CoppeliasimControl(joint_list, tool_list)

    try:
        shm_left_arm = shared_memory.SharedMemory(name='Left_Arm')
        shm_left_hand = shared_memory.SharedMemory(name='Left_Hand')

        arm_data = np.ndarray((16,), dtype=np.float32, buffer=shm_left_arm.buf)
        hand_data = np.ndarray((16,), dtype=np.float32, buffer=shm_left_hand.buf)

        # --- 状态初始化 (在循环外，保持状态连续) ---
        curr_body_pos = np.array(sim.get_joint_position())
        curr_body_vel = np.zeros_like(curr_body_pos)

        curr_tool_pos = np.array(sim.get_tool_position())
        curr_tool_vel = np.zeros_like(curr_tool_pos)

        # --- 参数配置 ---
        omega_n_body = 36.0  # 响应频率：越大跟踪越快，越小越平滑（建议 10.0~20.0）
        omega_n_tool = 65.0
        dt = 0.005  # 必须与 sleep 时间一致 (5ms)

        print("Left Arm Simulation Running...")

        while True:
            # 1. 获取 MQTT 最新的目标值 (Target)
            thetaBody_Target = arm_data[0:8].copy()
            thetaTool_Target = hand_data[0:7].copy()

            # 2. 执行一小段时间的平滑演化
            # 注意：我们不再用 for i in range(N)，而是直接让系统跟随目标演化
            # 如果 MQTT 是 50ms 更新一次，这里运行 10 次计算比较合适
            for _ in range(10):
                # --- Body 关节二阶动力学计算 ---
                accel_body = (omega_n_body ** 2) * (thetaBody_Target - curr_body_pos) - (2 * omega_n_body) * curr_body_vel
                curr_body_vel += accel_body * dt
                curr_body_pos += curr_body_vel * dt

                # --- Tool 位姿二阶动力学计算 ---
                accel_tool = (omega_n_tool ** 2) * (thetaTool_Target - curr_tool_pos) - (2 * omega_n_tool) * curr_tool_vel
                curr_tool_vel += accel_tool * dt
                curr_tool_pos += curr_tool_vel * dt

                # 3. 发送平滑后的指令
                sim.send_joint_position(curr_body_pos)
                sim.send_tool_position(curr_tool_pos)

                # 严格控制时间步
                time.sleep(dt)

            arm_data[8:16] = sim.get_joint_position()
            hand_data[8:15] = sim.get_tool_position()

    except KeyboardInterrupt:
        print("Left Arm Simulation Stopped.")
        sys.exit(0)
    except Exception as e:
        print("Left Arm Simulation Error:", e)
        sys.exit(1)