# Build Your MQTT Broker

This repository Mosquitto acts as an MQTT broker

## Installation and Setup on Windows
For Windows, download the required software:
- [Mosquitto](https://mosquitto.org/download/)

Open the configuration file `mosquitto.conf` in the installation folder and add the following:

```bash
listener 1883
allow_anonymous true

listener 9001
protocol websockets
```

> Port `1883` is used for standard MQTT (TCP) and port `9001` for MQTT over WebSockets.
> The port numbers can be changed as needed.

Then start 

```bash
cd "C:\Program Files\mosquitto"
mosquitto -v
```

to kill the process
```bash
taskkill /f /im mosquitto.exe
.\mosquitto.exe -c mosquitto.conf -v
```

[Reference config file on windows](.Robot_Communication/Setting/Windows/mosquitto.conf)

## Installation and Setup on Ubuntu
