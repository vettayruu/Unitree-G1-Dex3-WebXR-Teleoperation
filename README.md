# Unitree-G1-Dex3 WebXR Teleoperation Operation Manual

## Quick Start
- [Step 1: Install and Run HTTPS Server](#step-1-install-and-run-https-server)
- [Step 2: Build MQTT Broker](#step-2-build-mqtt-broker)
- [Step 3: Simulator Setup](#step-3-simulator-setup)
- [Step 4: Operate the Robot in Simulator](#step-4-operate-the-robot-in-simulator)

---
## Step 1: Install and Run HTTPS Server

💡 **If this is your first time running the project, install the required Node.js modules:**
```bash
npm install
```

**The project is designed to run in VS Code. Download it here:**  
[https://code.visualstudio.com/](https://code.visualstudio.com/Download)

**If you do not have Node.js installed, download it here:**  
[https://nodejs.org/en/download](https://nodejs.org/en/download)

**On Windows, you may need to allow script execution before running the server:**
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

🚀 **To start the Next.js HTTPS server, run:**
```bash
npm run dev-https
```

After starting, you will see two URLs:
- Local:   [https://localhost:3000](https://localhost:3000)
- Network: https://192.168.197.**:****

⚠️ **The Network IP address may vary** depending on your network environment.

⚠️ **In VR, only HTTPS can enter VR/AR mode.**

**Open the browser in your VR device and enter `https://192.168.197.**:****` to access the web interface.**

---
## Step 2: Robot Communication Network Setting

This repository requires mosquitto and nginx for the robot communication. The mosquitto servers as a MQTT broker and nginx changes the http to the https for VR. VR only receive message as https.
`Robot_Control/MQTT` folder gives an example of settings on Windows and ubuntu.

Installation on Windows:
Download (mosquitto)[https://mosquitto.org/download/]
Download (nginx)[https://nginx.org/en/download.html]

Setup mosquitto:
Open the config file `mosquitto.conf` in the installed folder, add 

```bash
listener 1883

listener 9001
protocol websockets

allow_anonymous true
```

the port number can be changed by the user. 
In this example, port 1883 is http and 9001 is websocket.

Setup nginx:
Open the config file `conf/nginx.conf`

https server
```bash
listen 443 ssl default_server;
listen [::]:443 ssl default_server;
```

check your host name
server name should be same as the host.

```bash
        server_name [your_hostname_here];

        ssl_certificate     /home/liu_ucl/cert.pem;
        ssl_certificate_key /home/liu_ucl/key.pem;

        ssl_protocols TLSv1.2 TLSv1.3;

        ssl_session_cache    shared:SSL:10m;
        ssl_session_timeout  10m;
        ssl_ciphers  HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers  on;
```

MQTT
```bash
        location /mqtt {
          proxy_pass http://127.0.0.1:9001;

          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection "upgrade";

          proxy_set_header Host $host;

          proxy_read_timeout 86400s;
          proxy_send_timeout 86400s;
        }
```

Websocket
```bash
        location /socket.io {
          proxy_pass http://127.0.0.1:8080/socket.io;

          proxy_http_version 1.1;

          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection "upgrade";

          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;

          proxy_buffering off;

          proxy_read_timeout 86400s;
          proxy_send_timeout 86400s;
        }
```

Check if there is error in config file

```bash
nginx -t
```

Start nginx
```bash
nginx start
```

After change the settings restart the nginx
```bash
nginx restart
```

Confirm your nginx settings.
Input `https://localhost` or `https://[your_server_name]`, you should see welcome nginx.
Input `https://[your_server_name]/mqtt`, your should see 502.

Since it is the self certification, sometime you need to verify.

---
## Step 3: Simulator Setup

[CoppeliaSim](https://www.coppeliarobotics.com/) is used in this project.

1. **Download CoppeliaSim**

   Visit the official website to download the latest version: [https://www.coppeliarobotics.com/](https://www.coppeliarobotics.com/)

2. **Launch CoppeliaSim**

   - **On Ubuntu:** Navigate to your CoppeliaSim installation directory and run:
     ```bash
     ./coppeliaSim
     ```
   - **On Windows:** Run the application directly by double-clicking the executable.

3. **Load the simulation scene**

   In folder `Robot_Control/Sim` find the file `g1_scene.zip` and unzip it.
   In CoppeliaSim, `File/Open scene...` to load this scene file.

5. **Start the simulation**

   Click the "Play" button in CoppeliaSim to start the simulation.

<div align="center">
  <img src="./G1_Sim.png" alt="sim" width="1000"/>
  <p><em>Figure: G1 Simulation in Coppeliasim.</em></p>
</div>

---
## Step 4: Operate the Robot in Simulator

### 1. Run the MQTT Client
In folder `Robot_Control/MQTT`, run
```Python
MQTT_Client.py
```

Then, in folder `Robot_Control`, run
```Python
MQTT_Simulation_Left.py
MQTT_Simulation_Right.py
```

### 2. Request Robot
On the webpage, click `Request Robot` to build communication with the robot.
If robot request successfully, the `Robot ID` will show the connected robot ID.

<div align="center">
  <img src="./Readme_img/G1_request_robot.png" alt="sim" width="1000"/>
  <p><em>Figure: Request Robot.</em></p>
</div>

### 3. Operation
The operation is based on hand tracking. Gestures are desgined for robot control.

<div align="center">
  <img src="./Readme_img/G1_show_menu.jpg" alt="sim" width="480"/>
  <p><em>Figure: Gesture show menu.</em></p>
</div>

<div align="center">
  <img src="./Readme_img/G1_trigger_off.jpg" alt="sim" width="480"/>
  <p><em>Figure: Gesture trigger off.</em></p>
</div>

<div align="center">
  <img src="./Readme_img/G1_trigger_on.jpg" alt="sim" width="480"/>
  <p><em>Figure: Gesture trigger on.</em></p>
</div>

<div align="center">
  <img src="./Readme_img/G1_grip.jpg" alt="sim" width="480"/>
  <p><em>Figure: Gesture grip (thumb and index).</em></p>
</div>

<div align="center">
  <img src="./Readme_img/G1_middle_grip.jpg" alt="sim" width="480"/>
  <p><em>Figure: Gesture grip (middle).</em></p>
</div>



