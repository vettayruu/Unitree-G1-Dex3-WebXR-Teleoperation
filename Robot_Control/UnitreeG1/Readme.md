# Control on G1

Access to the robot

```bash
ssh unitree@192.168.123.164
```

Sometimes the robot IP could be rewrite by the router, check the device info on the router if you can not access the robot.

Start [MQTT Client](/Robot_Communication/MQTT/MQTT_Client/py)

```bash
python MQTT_Client.py
```

Start robot arm
```bash
python G1_arm_control.py
```
Start robot hand
```bash
python G1_hand_control
```
In this study, the lowerlimb is not inculded in the low-level controller.

Stream the camera




