# Unitree G1 Dex3 WebXR Teleoperation Tutorial

Check the our tutorial video here ↓↓↓

[WebXR-based Robot Teleoperation Tutorial](https://www.youtube.com/shorts/WiOdoYFDfDA)

---

## Quick Start

1. **Install Node.js**, if you don't already have it: [https://nodejs.org/en/download](https://nodejs.org/en/download)

2. **Install the required Node.js modules** (first-time setup only):

    ```bash
    npm install
    ```

3. **On Windows**, you may need to allow script execution before running the server:

    ```powershell
    Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
    ```

4. **Build your teleoperation network** by following [Network Setting](./Robot_Communication/Readme.md).

5. **Start the server.**

    HTTP:

    ```bash
    npm run dev
    ```

    or HTTPS:

    ```bash
    npm run dev-https
    ```

    > Since Nginx already handles TLS termination for the reverse proxy, running the app itself over HTTPS is optional.

6. **[Start the robot](./Robot_Control/Readme.md).**

7. **Follow the [tutorial video](https://www.youtube.com/shorts/WiOdoYFDfDA)** to begin teleoperation.
