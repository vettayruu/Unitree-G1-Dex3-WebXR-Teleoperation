import sys
import time
from UnitreeG1.robot_arm_cmd import Custom
from unitree_sdk2py.core.channel import ChannelFactoryInitialize

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
