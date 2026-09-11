# Build Your MQTT Broker

This repository uses **Mosquitto** as the MQTT broker. Both Windows and Ubuntu can install the mosquitto.

## Installation and Setup on Windows

1. Download and install [Mosquitto](https://mosquitto.org/download/) for Windows.

2. Open the configuration file `mosquitto.conf` in the installation folder and add the following:

    ```conf
    listener 1883
    allow_anonymous true

    listener 9001
    protocol websockets
    ```

    > Port `1883` is used for standard MQTT (TCP) and port `9001` for MQTT over WebSockets.
    > The port numbers can be changed as needed.

3. Start the broker:

    ```bash
    cd "C:\Program Files\mosquitto"
    mosquitto -v
    ```

4. To stop the broker:

    ```bash
    taskkill /f /im mosquitto.exe
    ```

5. To restart the broker with the config file explicitly:

    ```bash
    .\mosquitto.exe -c mosquitto.conf -v
    ```

📄 [Reference config file (Windows)](/Robot_Communication/Setting/Windows/mosquitto.conf)

## Installation and Setup on Ubuntu

1. Install Mosquitto:

    ```bash
    sudo apt update
    sudo apt install mosquitto mosquitto-clients -y
    ```

2. Open the configuration file. The main config lives at `/etc/mosquitto/mosquitto.conf`, and it's usually cleaner to add your own listener settings as a separate file under `/etc/mosquitto/conf.d/` (any `.conf` file placed there is automatically included).
    Open the main config file directly:
    ```bash
    sudo nano /etc/mosquitto/mosquitto.conf
    ```
 
    Add the same listener settings as above:
 
    ```conf
    listener 1883
    allow_anonymous true
 
    listener 9001
    protocol websockets
    ```

3. Restart the service to apply changes:

    ```bash
    sudo systemctl restart mosquitto
    ```

4. To run manually in the foreground for debugging:

    ```bash
    mosquitto -c /etc/mosquitto/mosquitto.conf -v
    ```

📄 [Reference config file (Ubuntu)](/Robot_Communication/Setting/Ubuntu/mosquitto.conf)

## Notes

- `allow_anonymous true` disables authentication — suitable for local/lab networks only. For production or externally reachable brokers, configure username/password auth or TLS instead.
- Both platforms expose the same two listeners (`1883` for raw MQTT, `9001` for MQTT over WebSockets), so clients — regardless of OS — can connect using either transport.
