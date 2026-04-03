# G1 Low-Level Control Manual

## Connect G1 with Wifi6

```bash
ssh unitree@192.168.123.164
```

password: `123`

## Execution on G1

The codes are in the folder `liust`
```bash
cd ./liust
```

Run `MQTT_Client.py` for control signal receive.

```Python
python MQTT_Client.py
```

Run arm low-level controller

```Python
python robot_arm_cmd.py
```

Note: Wait for 5 seconds for the zero-pose setting

Run hand controller 

```Python
python robot_hand_cmd.py
```

## Camera Stream with WebRTC

```bash
cd ./sora_related/momo-2023.1.0_ubuntu_20.04_armv8_jetson_xavier
./doit_sora2.sh
```

Note: To start the Sora WebRTC on the local server PC
```bash
cd ./sora/sora-2024.1.3
bin/sora foreground
```

## References
The arm's low-level control is based on https://github.com/unitreerobotics/unitree_sdk2_python/blob/master/example/g1/low_level/g1_low_level_example.py

The hand's control is based on https://github.com/unitreerobotics/xr_teleoperate/blob/main/teleop/robot_control/robot_hand_unitree.py

