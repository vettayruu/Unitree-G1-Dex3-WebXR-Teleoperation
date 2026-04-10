# G1 Low-Level Control Manual

This manual describes the sequence to initiate the Sora WebRTC stream and execute low-level control for the Unitree G1 robot arms and hands.

---

## 1. Environment Initialization

### 1.1 Start Sora WebRTC (Local Server PC)
First, ensure your local signaling server is active.

```bash
cd ./sora/sora-2024.1.3
bin/sora foreground
```

🚨 **Important**
Boot Order: Ensure the Wi-Fi 6 device is fully powered on before booting the Server PC to ensure stable network interface discovery.

### 1.2 Access G1 via SSH

Connect to the G1 onboard computer over the local network:
```bash
ssh unitree@192.168.123.164
```

password: `123`

---

## 2. Execution on G1 (Robot Side)

Navigate to the workspace:
```bash
cd ./liust
```

### Step 1. Communication Bridge

```Python
python MQTT_Client.py
```

### Step 2. Arm Low-Level Controller

Choose the appropriate script based on your requirements.

**Option A: Linear Filter**

```Python
python robot_arm_cmd.py
```
Simple implementation, original G1 design. Low complexity but higher latency. Best for initial debugging of G1.

**Option B: Sigmoid Interpolation**

Sigmoid interpolation:
```Python
python robot_arm_cmd_2.py
```
Smooth, continuous acceleration. Lower latency but requires precise parameter tuning. Best for real-time teleoperation.

🚨 **Caution:**
After starting the script, wait for 5 seconds to allow the zero-pose setting to finalize before sending motion commands.

### Step 3. Hand Low-Level Controller

Linear filter:
```Python
python robot_hand_cmd.py
```

Sigmoid interpolation:
```Python
python robot_hand_cmd_2.py
```

---

## 3.Vision System (Camera Stream)
Start the WebRTC stream using the Jetson Xavier onboard hardware encoder:
```bash
cd ./sora_related/momo-2023.1.0_ubuntu_20.04_armv8_jetson_xavier
./doit_sora2.sh
```

## 4. References
- Arm Low-Level Control: [unitree_sdk2_python/g1_low_level_example.py](https://github.com/unitreerobotics/unitree_sdk2_python/blob/master/example/g1/low_level/g1_low_level_example.py)

- Hand Low-Level Control: [xr_teleoperate/robot_hand_unitree.py](https://github.com/unitreerobotics/xr_teleoperate/blob/main/teleop/robot_control/robot_hand_unitree.py)

