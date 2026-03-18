# G1 Low-Level Control Manual

## Execution on G1

Run `MQTT_Client.py` for control signal receive.

```Python
python MQTT_Client.py
```

Run arm controller

```Python
python G1_arm_control.py
```

Note: Wait for 5 seconds for the zero-pose setting

Run hand controller 

```Python
python G1_hand_control.py
```

## References
The arm's low-level control is based on https://github.com/unitreerobotics/unitree_sdk2_python/blob/master/example/g1/low_level/g1_low_level_example.py

The hand's control is based on https://github.com/unitreerobotics/xr_teleoperate/blob/main/teleop/robot_control/robot_hand_unitree.py

