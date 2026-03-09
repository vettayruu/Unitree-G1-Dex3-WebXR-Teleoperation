import time
from math import radians

from pymycobot.mycobot280 import MyCobot280  # import mycobot library,if don't have, first 'pip install pymycobot'

zero_point =   [0, 0, 0, 0, 0, 0]
work_point_1 = [0, 45, -100, -10, 0, 0]
work_point_2 = [18.0, -22.5, -123, 128, -20, 5.5]
work_point_3 = [28.0, 35.0, -96.5, -13.0, -2.0, 27.5]

# use PC and M5 control
# mc = MyCobot280('COM5', 115200)  # WINDOWS use ，need check port number when you PC
mc = MyCobot280('/dev/ttyUSB0',115200)           # VM linux use, run "sudo chmod 666 /dev/ttyUSB0" at first
time.sleep(0.5)
print(mc)

# mc.power_off()
power = mc.is_power_on()
print(power)
#
angles = mc.get_angles()
print(angles)

# Set interpolation mode
mc.set_fresh_mode(1)
time.sleep(0.5)

mc.send_angles(work_point_3, 5)
time.sleep(0.5)