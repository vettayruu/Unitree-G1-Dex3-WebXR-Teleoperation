import React from 'react';
import Assets from './Assets';
import { Select_Robot } from './Model';
import WebInterface from './web_interface.js';
import {idtopic, publishMQTT, MQTT_ROBOT_DATA_TOPIC } from '../lib/MetaworkMQTT';

export default function RobotScene(props) {
  const {
    time_offset,
    robot_assets, 
    robotProps, 
    
    // VR
    rendered, 
    interfacePropos, 
    view_cam_pose,

    // Right Arm
    state_codes, 
    position_ee, 
    euler_ee, 
    rightArmPosition,
    joint_limits_right,

    // Left Arm
    state_codes_left,
    position_ee_left, 
    euler_ee_left, 
    leftArmPosition,
    joint_limits_left,

    // Cam Arm
    state_codes_cam,
    position_ee_cam,
    euler_ee_cam,

    // Others
    showMenu,
    showVideo,
    showModel,

    // SAP BTP
    apiData,
    scanData,

  } = props;

  const getStateCodeColor = (code) => {
    const colorMap = {
      0x00: "yellow",    // NORMAL
      0x01: "red",       // IK_FAILED  
      0x02: "orange",    // VELOCITY_LIMIT
      0x03: "purple",    // JOINT_LIMIT
      0x04: "pink",      // SINGULARITY
      0x05: "gray",      // VR_INPUT_INVALID
      0x06: "blue",      // JACOBIAN_ERROR
      0x07: "cyan",      // TARGET_UNREACHABLE
    };
    return colorMap[code] || "white";
  };

  const stateCodeColor = getStateCodeColor(state_codes);
  const stateCodeColorLeft = getStateCodeColor(state_codes_left);
  const stateCodeColorCam = getStateCodeColor(state_codes_cam);

  const rad2deg = rad => rad * 180 / Math.PI;
  const euler_ee_deg = euler_ee.map(rad2deg);
  const euler_ee_deg_left = euler_ee_left.map(rad2deg);
  const euler_ee_deg_cam = euler_ee_cam.map(rad2deg);

  const botton_width = "0.40";
  const font_path = "/fonts/Roboto-msdf.json"; 

  const [activeTaskId, setActiveTaskId] = React.useState(null);
  const [activeProductId, setActiveProduct] = React.useState(null);
  const [taskMsg, setTaskMsg] = React.useState("");
  
  const [timenow, now] = React.useState(Date.now());
  // Webcam Stream
  React.useEffect(() => {
    if (props.webcamStream1 && props.showVideo) {
      const videoEl = document.getElementById('stereoVideo');
      if (videoEl && videoEl.srcObject !== props.webcamStream1) {
        videoEl.srcObject = props.webcamStream1;
        // videoEl.play();
        videoEl.play().catch(error => {
          console.warn("Video play interrupted, likely due to component unmount:", error);
        });
      }
    }
  }, [props.webcamStream1, props.showVideo, timenow]);

  // React.useEffect(() => {
  //   if (props.webcamStream2) {
  //     const videoEl = document.getElementById('rightVideo');
  //     if (videoEl && videoEl.srcObject !== props.webcamStream2) {
  //       videoEl.srcObject = props.webcamStream2;
  //       videoEl.play();
  //     }
  //   }
  // }, [props.webcamStream2]);

  // React.useEffect(() => {
  //   if (props.webcamStream3) {
  //     const videoEl = document.getElementById('subVideo');
  //     if (videoEl && videoEl.srcObject !== props.webcamStream3) {
  //       videoEl.srcObject = props.webcamStream3;
  //       videoEl.play();
  //     }
  //   }
  // }, [props.webcamStream3]);

  const [vrcam_position, setVrcamPosition] = React.useState('0 0 0');
  const [vrcam_rotation, setVrcamRotation] = React.useState('0 0 0');
  React.useEffect(() => {
    if (showVideo) {
      setVrcamPosition("0 -0.035 -0.0")
      setVrcamRotation("42.5 0 0")
    } else {
      setVrcamPosition("0 -0.15 -0.3")
      setVrcamRotation("0 0 0")
    }
  }, [showVideo]);

  const statusColors = {
    ok: '#00FF00',
    warn: '#FFCC00',
    error: '#FF0000',
    text: '#FFFFFF',
    null: '#888888' 
  };

  const [isRecording, setIsRecording] = React.useState(false);
  const [completedTaskIds, setCompletedTaskIds] = React.useState([]);
  const [hasRecordedCurrentTask, setHasRecordedCurrentTask] = React.useState(false);

  const [WTProduct, setWTProduct] = React.useState(null);
  const [WTDestination, setWTDestination] = React.useState(null);
  const [scanHistory, setScanHistory] = React.useState({
    product: null,
    destination: null,
  });
  const isProductMatch = React.useMemo(() => {
    if (!scanHistory.product || !activeProductId) return false;
    return String(scanHistory.product).trim().toLowerCase() === String(activeProductId).trim().toLowerCase();
  }, [scanHistory.product, activeProductId]);

  const handleActivateTask = (taskItem) => {
    setActiveTaskId(taskItem.warehouseTask);
    setActiveProduct(taskItem.product);
    setHasRecordedCurrentTask(false);
    setWTProduct(null);                              
    setWTDestination(null);                          
    setScanHistory({ product: null, destination: null }); 
    setTaskMsg(`Task ${taskItem.warehouseTask} activated.`);
  };

  const handleRecordControl = React.useCallback(async (action) => {
        if (action === "start") {
          publishMQTT(MQTT_ROBOT_DATA_TOPIC + idtopic, JSON.stringify({
            header: {
              "userID": apiData?.userID || "unknown_user",
              "robot": apiData?.robot || "unknown_robot",
              "warehouse": apiData?.warehouse || "unknown_warehouse",
              "warehouseTask":activeTaskId || "N/A",
              "product":activeProductId || "N/A",
            },
            time: Date.now() + time_offset, 
            record: "on" 
          }), 1);
          setIsRecording(true);
          setTaskMsg(`Task ${activeTaskId || "N/A"} started.`);
        } 
        
        else if (action === "stop") {
          publishMQTT(MQTT_ROBOT_DATA_TOPIC + idtopic, JSON.stringify({ 
            header: {
              "userID": apiData?.userID || "unknown_user",
              "robot": apiData?.robot || "unknown_robot",
              "warehouse": apiData?.warehouse || "unknown_warehouse",
              "warehouseTask":activeTaskId || "N/A",
              "product":activeProductId || "N/A",
            },
            time: Date.now() + time_offset,
            record: "off" 
          }), 1);

          if (isRecording) {
            setHasRecordedCurrentTask(true); 
          }
          setIsRecording(false);
          setTaskMsg(`Task ${activeTaskId || "N/A"} finished.`);
        } 
        
    }, [activeTaskId, isRecording]);

  const handleCompleteCurrentTask = () => {
    if (!activeTaskId) {
      setTaskMsg("[Error] No active task to complete.");
      return;
    }

    setCompletedTaskIds((prev) => [...prev, activeTaskId]);

    setActiveTaskId(null);
    setActiveProduct(null);
    setHasRecordedCurrentTask(false);
    setWTProduct(null);           
  };

  React.useEffect(() => {
    if (!scanData?.value) return;

    try {
      const json = typeof scanData.value === "string"
        ? JSON.parse(scanData.value)
        : scanData.value;

      if (json?.type && json?.id) {
        if (json.type === "product") {
          setWTProduct(json.id);
          setScanHistory(prev => ({ ...prev, product: json.id }));
        } else if (json.type === "destination") {
          setWTDestination(json.id);
          setScanHistory(prev => ({ ...prev, destination: json.id }));
        }
      }
    } catch (e) {
      console.warn("Illegal JSON:", scanData.value);
    }
  }, [scanData]); 

  /*---------------------- UI -----------------------*/
  const [dropdownOpen, setDropdownOpen] = React.useState(true); 
  const [taskPage, setTaskPage] = React.useState(0);

  const [showRobotSetting, setShowRobotSetting] = React.useState(false);
  
  const taskTimes = React.useRef({}); 

  const totalTasks = apiData?.task?.length || 0;
  const doneTasks = completedTaskIds.length;
  const progress = totalTasks > 0 ? doneTasks / totalTasks : 0;
  const canComplete = doneTasks === totalTasks && totalTasks > 0;
  React.useEffect(() => {
    if (canComplete) {
      setTaskMsg("All tasks completed! \n Task confirmation has been sent to the EWM.");
      // setTaskMsg("All tasks completed and the confirmation has sent to EWM. Totally use " + Object.values(taskTimes.current).reduce((sum, t) => sum + (t.timecost || 0), 0).toFixed(1) + "s with " + (Object.values(taskTimes.current).reduce((sum, t) => sum + (t.timecost || 0), 0) / totalTasks).toFixed(1) + "s per task.");
      // Add logical here to send a confirmation message to the EWM system if needed.
    }
  }, [canComplete, rendered]);

  /*---------------------- Scene Render -----------------------*/
  if (!rendered) {
    return (
      <a-scene xr-mode-ui="XRMode: xr">
        <Assets robot_assets={robot_assets} viewer={props.viewer}/>
      </a-scene>
    );
  }
  return (
    <>
      <a-scene 
        scene 
        xr-mode-ui="XRMode: xr"
      >
        {/* Robot Model*/}
        <Assets robot_assets={robot_assets} viewer={props.viewer} monitor={props.monitor}/>

        {/* Remote Cam*/}
        <a-assets>
          <video id="stereoVideo" autoPlay playsInline crossOrigin="anonymous" muted></video>
        </a-assets>
        {showModel && (
          <a-entity position={vrcam_position} rotation={vrcam_rotation}>
            <Select_Robot 
              {...robotProps} 
              // modelOpacity={props.modelOpacity}
              position_left={leftArmPosition}
              position_right={rightArmPosition}
              joint_limits_right={joint_limits_right}
              joint_limits_left={joint_limits_left}
              indicator_visibility={props.indicator}
            />

            <a-sphere 
              position={`${position_ee[0]} ${position_ee[1]} ${position_ee[2]}`} 
              scale="0.012 0.012 0.012" 
              color={stateCodeColor}
              visible={true}></a-sphere>
            <a-entity
              position={`${position_ee[0]} ${position_ee[1]} ${position_ee[2]}`}
              // ZYX
              rotation={`${euler_ee_deg[0]} ${-euler_ee_deg[2]} ${-euler_ee_deg[1]} `}
            >
              <a-cylinder position="0      0     -0.015" rotation="90 0  0 " height="0.0700" radius="0.0015" color="red" /> 
              <a-cylinder position="-0.015      0     0" rotation="0  0  90" height="0.0500" radius="0.0015" color="green" />
              <a-cylinder position="0      0.025      0" rotation="0  90 0 " height="0.0500" radius="0.0015" color="blue" />
            </a-entity>

            <a-sphere 
              position={`${position_ee_left[0]} ${position_ee_left[1]} ${position_ee_left[2]}`} 
              scale="0.012 0.012 0.012" 
              color={stateCodeColorLeft}
              visible={true}></a-sphere>
            <a-entity
              position={`${position_ee_left[0]} ${position_ee_left[1]} ${position_ee_left[2]}`}
              // ZYX
              rotation={`${euler_ee_deg_left[0]} ${-euler_ee_deg_left[2]} ${-euler_ee_deg_left[1]} `}
              >
              <a-cylinder position="0      0     -0.015" rotation="90 0  0 " height="0.0700" radius="0.0015" color="red" /> 
              <a-cylinder position="-0.015      0     0" rotation="0  0  90" height="0.0500" radius="0.0015" color="green" />
              <a-cylinder position="0      0.025      0" rotation="0  90 0 " height="0.0500" radius="0.0015" color="blue" />
            </a-entity>

            <a-sphere 
              position={`${position_ee_cam[0]} ${position_ee_cam[1]} ${position_ee_cam[2]}`} 
              scale="0.012 0.012 0.012" 
              color={stateCodeColorCam}
              visible={true}></a-sphere>
            <a-entity
              position={`${position_ee_cam[0]} ${position_ee_cam[1]} ${position_ee_cam[2]}`}
              // ZYX
              rotation={`${euler_ee_deg_cam[0]} ${-euler_ee_deg_cam[2]} ${-euler_ee_deg_cam[1]} `}
            >
              <a-cylinder position="0      0     -0.015" rotation="90 0  0 " height="0.0500" radius="0.0015" color="red" /> 
              <a-cylinder position="-0.015      0     0" rotation="0  0  90" height="0.0500" radius="0.0015" color="green" />
              <a-cylinder position="0      0.025      0" rotation="0  90 0 " height="0.0700" radius="0.0015" color="blue" />
            </a-entity>

          </a-entity>
        )}

        {/* Light */}
        <a-entity light="type: directional; color: #FFF; intensity: 0.5" position="1 1 1"></a-entity>
        <a-entity light="type: directional; color: #FFF; intensity: 0.5" position="-1 1 1"></a-entity>
        <a-entity light="type: directional; color: #EEE; intensity: 0.5" position="-1 1 -1"></a-entity>
        <a-entity light="type: directional; color: #FFF; intensity: 0.5" position="1 1 -1"></a-entity>
        <a-entity light="type: directional; color: #EFE; intensity: 0.5" position="0 -1 0"></a-entity>

        <a-entity id="rig" position={`${view_cam_pose[0]} ${view_cam_pose[1]} ${view_cam_pose[2]}`} rotation={`${view_cam_pose[3]} ${view_cam_pose[4]} ${view_cam_pose[5]}`}>

          {/* Add component move with camera here */}
          <a-camera id="camera" cursor="rayOrigin: mouse;" position="0 0 0">

            <a-entity 
            position="-0.55 -0.30 -1.20" 
            rotation="-10 45 -8" 
            scale="0.6 0.6 0.6"
            >

            <a-entity
                geometry="primitive: rounded-rect; width: 0.72; height: 0.43; radius: 0.03"
                material="color: #111111; opacity: 0.5; shader: flat"
                position="-0.055 0.08 0"
            ></a-entity>

            <a-text 
                value="Task Monitor" 
                align="center" 
                color="#4CC3D9" 
                width="1.3" 
                position="-0.05 0.24 0.01" 
                font={font_path}
            ></a-text>

            {[
                { name: "Task", value: activeTaskId || "---" },
                { name: "Product", value: activeProductId || "---" },
                { name: "Progress", value: `${completedTaskIds.length}/${apiData?.task?.length || 0}` },
            ].map((item, index) => (
                <a-entity key={item.name} position={`0 ${0.15 - index * 0.1} 0.01`}>

                <a-entity
                    geometry="primitive: rounded-rect; width: 0.65; height: 0.09; radius: 0.015"
                    material={`color: #333333; opacity: 0.6; shader: flat`}
                    position="-0.06 0 -0.001"
                ></a-entity>

                <a-text value={item.name} position="-0.36 0 0.01" width="1.0" font={font_path}></a-text>

                <a-text 
                    value={item.value} 
                    position="-0.13 0 0.01" 
                    width="1.0" 
                    color={item.name === "Progress" ? "#ffffff" : statusColors.text}
                    font={font_path}
                ></a-text>

                </a-entity>
            ))}
            </a-entity>

          </a-camera>
        </a-entity>
        
        {/* Robot Setting */}
        {showRobotSetting && showMenu && (
        <a-entity id="setting" position="-0.8 0.2 -1.0" rotation="0 37 0" highlight button-action>
          <a-entity
            geometry="primitive: rounded-rect; width: 0.95; height: 0.80; radius: 0.065"
            rounded-rect-border={`width: 0.95; height: 0.80; radius: 0.065; color: #b8b8b8`}
            material="color: #222222; opacity: 1.0; shader: flat"
            position="-0.035 0.23 0"
          ></a-entity>

          <a-entity id="close-button" position="0.358 0.55 0.01" onClick={() => setShowRobotSetting(false)} class="raycastable">
            <a-circle
              radius="0.053"
              material="opacity: 0.9; transparent: true; shader: flat"
              class="raycastable"
              position="0 0 -0.001"
            ></a-circle>

            <a-circle
              radius="0.056"
              src={"/close.png"}
              material="transparent: true; shader: flat"
              position="0 0 0"
            ></a-circle>
          </a-entity>

          <a-entity id="robot-setting-content" position="-0.0 -0.035 0.01">

            <a-text value="Robot Setting" align="center" color="#fff" width="1.5" position="-0.025 0.56 0.01" font={font_path}></a-text>

            {/* Button 1 */}
            <a-entity id="button1" position="-0.25 0.4 0.01" class="raycastable menu-button"
              geometry={`primitive: rounded-rect; width: ${botton_width}; height: 0.18; radius: 0.04`}
              material="color: white; opacity: 0.95"
            ><a-text value="HMD Control \n Off" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>
            
            {/* Button 2 */}
            <a-entity id="button2" position="0.18 0.4 0.01" class="raycastable menu-button"
              geometry={`primitive: rounded-rect; width: ${botton_width}; height: 0.18; radius: 0.04`}
              material="color: white; opacity: 0.95"
            ><a-text value="HMD Control \n On" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>
            
            {/* Button 3 */}
            <a-entity id="button3" position="-0.25 0.2 0.01" class="raycastable menu-button"
              geometry={`primitive: rounded-rect; width: ${botton_width}; height: 0.18; radius: 0.04`}
              material="color: white; opacity: 0.95"
            ><a-text value="Show Video \n Off" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>

            {/* Button 4 */}
            <a-entity id="button4" position="0.18 0.2 0.01" class="raycastable menu-button"
              geometry={`primitive: rounded-rect; width: ${botton_width}; height: 0.18; radius: 0.04`}
              material="color: white; opacity: 0.95"
            ><a-text value="Show Video \n On" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>

            {/* Button 5 */}
            <a-entity id="button5" position="-0.25 0.0 0.01" class="raycastable menu-button"
              geometry={`primitive: rounded-rect; width: ${botton_width}; height: 0.18; radius: 0.04`}
              material="color: white; opacity: 0.95"
            ><a-text value="Show Model \n On" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>

            {/* Button 6 */}
            <a-entity id="button6" position="0.18 0.0 0.01" class="raycastable menu-button"
              geometry={`primitive: rounded-rect; width: ${botton_width}; height: 0.18; radius: 0.04`}
              material="color: white; opacity: 0.95"
            ><a-text value="Show Model \n Off" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>

            {/* Button 7,8 Visual Assist */}
            {/* <a-entity id="button7" position="-0.3 -0.2 0.01" class="raycastable menu-button"
              geometry={`primitive: rounded-rect; width: ${botton_width}; height: 0.18; radius: 0.04`}
              material="color: white; opacity: 0.95"
            ><a-text value="Visual Assist \n On" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>

            <a-entity id="button8" position="0.3 -0.2 0.01" class="raycastable menu-button"
              geometry={`primitive: rounded-rect; width: ${botton_width}; height: 0.18; radius: 0.04`}
              material="color: white; opacity: 0.95"
            ><a-text value="Visual Assist \n Off" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity> */}

            {/* Button 9,10 Whole Body Control */}
            {/* <a-entity id="button9" position="-0.3 -0.4 0.01" class="raycastable menu-button"
              geometry={`primitive: rounded-rect; width: ${botton_width}; height: 0.18; radius: 0.04`}
              material="color: white; opacity: 0.95"
            ><a-text value="Whole Body Control \n On" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>

            <a-entity id="button10" position="0.3 -0.4 0.01" class="raycastable menu-button"
              geometry={`primitive: rounded-rect; width: ${botton_width}; height: 0.18; radius: 0.04`}
              material="color: white; opacity: 0.95"
            ><a-text value="Whole Body Control \n Off" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity> */}
          </a-entity>
        </a-entity>
        )}
        
        {/* Task Menu */}
        {showMenu && (
          <a-entity id="task" position="-1.0 0.9 -1.2" rotation="0 37 0">

            <a-entity
            geometry="primitive: rounded-rect; width: 1.45; height: 1.55; radius: 0.08"
            material="color: #222; opacity: 1.0; shader: flat"
            position="-0.02 -0.39 -0"
            ></a-entity>

            {/* USER INFO */}
            <a-entity position="-0.025 0.065 0">
                <a-entity position="-0.47 0.135 0.01">
                <a-circle
                    radius="0.10"
                    src={"/robot.png"}
                    material="shader: flat"
                    position="0 0.01 0"
                    class="raycastable"
                    onClick={() => setShowRobotSetting(true)} 
                ></a-circle>
                <a-ring
                    radius-inner="0.10"
                    radius-outer="0.108"
                    color="#8eb1be"
                    material="shader: flat"
                    position="0 0 0.001"
                ></a-ring>
                </a-entity>

                <a-entity position="-0.30 0.13 0.01">
                    <a-text
                    value={`${idtopic || "---"}`}
                    position="0 0.075 0"
                    width="1.1"
                    font={font_path}
                    color="#ffffff"
                    ></a-text>

                    <a-text
                    value={`Robot: ${apiData?.robot || "---"}`}
                    position="0 0.0 0"
                    width="0.9"
                    font={font_path}
                    color="#bbbbbb"
                    ></a-text>

                    <a-text
                    value={`Warehouse: ${apiData?.warehouse || "---"}`}
                    position="0 -0.065 0"
                    width="0.9"
                    font={font_path}
                    color="#bbbbbb"
                    ></a-text>
                </a-entity>
            </a-entity>

            <a-entity id="data-section" position="-0.05 -0.12 0.02">
              <a-entity
                  position="0.010 -0.05 0"
                  class="raycastable"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                  <a-plane width="1.20" height="0.08" color="#444a54" opacity="0.9"></a-plane>
                  <a-text value="Task"    position="-0.54 0 0.01" width="1" font={font_path} color="#00c8ff"></a-text>
                  <a-text value="Product" position="-0.23 0 0.01" width="1" font={font_path} color="#00c8ff"></a-text>
                  <a-text value="Action"  position="0.18 0 0.01"  width="1" font={font_path} color="#00c8ff"></a-text>
                  <a-text value="Time(s)"  position="0.42 0 0.01"  width="1" font={font_path} color="#00c8ff"></a-text>

              </a-entity>

              {dropdownOpen && Array.isArray(apiData?.task) && (() => {
                  const allTasks = apiData.task;
                  const pageSize = 5;
                  const totalPages = Math.ceil(allTasks.length / pageSize);
                  const pageTasks = allTasks.slice(taskPage * pageSize, taskPage * pageSize + pageSize);

                  return (
                  <>
                      {pageTasks.map((taskItem, index) => {
                      const taskYPos = -0.14 - index * 0.085;
                      const isActive = activeTaskId === taskItem.warehouseTask;
                      const isCompleted = completedTaskIds.includes(taskItem.warehouseTask);

                      return (
                          <a-entity key={taskItem.warehouseTask || index} position={`0.015 ${taskYPos} 0`}>

                          <a-plane
                              width="1.20"
                              height="0.08"
                              color={isActive ? "#1b365d" : (index % 2 === 0 ? "#333" : "#2a2a2a")}
                              opacity="0.8"
                          ></a-plane>

                          <a-text
                              value={taskItem.warehouseTask || "---"}
                              position="-0.56 0 0.01"
                              width="1"
                              font={font_path}
                              color={isCompleted ? "#555" : (isActive ? "#00e6ff" : "#fff")}
                          ></a-text>

                          <a-text
                              value={taskItem.product || "---"}
                              position="-0.25 0 0.01"
                              width="1"
                              color={isCompleted ? "#555" : (isActive ? "#00e6ff" : "#fff")}
                              font={font_path}
                          ></a-text>

                          <a-text
                            value={
                              isCompleted && taskTimes.current[taskItem.warehouseTask]?.timecost != null
                                ? taskTimes.current[taskItem.warehouseTask].timecost.toFixed(1)
                                : "---"
                            }
                            position="0.45 0 0.01"
                            width="1"
                            color={isCompleted ? "#555" : (isActive ? "#00e6ff" : "#fff")}
                            font={font_path}
                          ></a-text>

                          <a-entity position="0.25 0 0.01">
                              <a-plane
                              class={isCompleted ? "" : "raycastable"}
                              width="0.18"
                              height="0.065"
                              color={isCompleted ? "#222" : (isActive ? "#4CAF50" : "#777")}
                              material="shader: flat"
                              onClick={() => {
                                  if (isCompleted) return;
                                  handleActivateTask(taskItem);

                                  const startTime = Date.now() + time_offset;
                                  taskTimes.current[taskItem.warehouseTask] = {
                                    ...taskTimes.current[taskItem.warehouseTask],
                                    start: startTime
                                  };

                                  publishMQTT(MQTT_ROBOT_DATA_TOPIC + idtopic, JSON.stringify({
                                    header: {
                                      "userID": apiData?.userID || "unknown_user",
                                      "robot": apiData?.robot || "unknown_robot",
                                      "warehouse": apiData?.warehouse || "unknown_warehouse",
                                      "warehouseTask":taskItem.warehouseTask || "N/A",
                                      "product":taskItem.product || "N/A",
                                    },
                                    time: startTime, 
                                    record: "on" 
                                  }), 1);
                                  setIsRecording(true);
                                  setTaskMsg(`Task ${taskItem.warehouseTask || "N/A"} started.`);

                              }}
                              ></a-plane>

                              <a-text
                              value={isCompleted ? "DONE" : (isActive ? "ACTIVE" : "ACTIVATE")}
                              align="center"
                              position="0 0 0.005"
                              width="0.8"
                              font={font_path}
                              color={isCompleted ? "#555" : "#fff"}
                              ></a-text>
                          </a-entity>

                          </a-entity>
                      );
                      })}

                      {totalPages > 1 && (
                      <a-entity position={`0 ${-0.14 - pageSize * 0.085} 0`}>

                          <a-entity
                          position="-0.25 -0.01 0.01">
                          <a-plane
                              width="0.18" height="0.08"
                              color={taskPage > 0 ? "#555" : "#2a2a2a"}
                              material="shader: flat"
                              class={taskPage > 0 ? "raycastable" : ""}
                              onClick={() => taskPage > 0 && setTaskPage(taskPage - 1)}
                          ></a-plane>
                          <a-text
                              value="Prev"
                              align="center"
                              position="0 0.0 0.005"
                              width="0.9"
                              font={font_path}
                              color={taskPage > 0 ? "#fff" : "#555"}
                          ></a-text>
                          </a-entity>

                          <a-text
                          value={`${taskPage + 1} / ${totalPages}`}
                          align="center"
                          position="0 -0.01 0.01"
                          width="0.9"
                          font={font_path}
                          color="#aaaaaa"
                          ></a-text>

                          <a-entity position="0.25 -0.01 0.01">
                          <a-plane
                              class={taskPage < totalPages - 1 ? "raycastable" : ""}
                              width="0.18" height="0.09"
                              material="opacity: 0.8; shader: flat"  
                              color={taskPage < totalPages - 1 ? "#555" : "#2a2a2a"}
                              onClick={() => taskPage < totalPages - 1 && setTaskPage(taskPage + 1)}
                          ></a-plane>
                          <a-text
                              value="Next" align="center" position="0 0 0.006"
                              width="0.9" font={font_path}
                              color={taskPage < totalPages - 1 ? "#fff" : "#555"}
                          ></a-text>
                          </a-entity>

                      </a-entity>
                      )}
                  </>
                  );
              })()}

            </a-entity>
            
            {/* ----- Progress Bar ----- */}
            {(() => {

                const barWidth = 1.2;
                const barHeight = 0.035;
                const barRadius = barHeight / 2; 

                const fillWidth = Math.max(barWidth * progress, barHeight);
                const fillRadius = Math.min(barRadius, fillWidth / 2);

                const handleX = -barWidth / 2 + fillWidth;

                return (
                    <a-entity position="-0.025 -0.85 0.02">
                      <a-text
                          value={`Progress ${doneTasks}/${totalTasks}`}
                          position={`${-barWidth / 2} 0.06 0.01`}
                          width="1.0"
                          font={font_path}
                          color="#ffffff"
                          align="left"
                      ></a-text>

                      <a-entity
                          geometry={`primitive: rounded-rect; width: ${barWidth}; height: ${barHeight}; radius: ${barRadius}`}
                          material="color: #333333; opacity: 0.9; shader: flat"
                          position="0 0 0"
                      ></a-entity>

                      <a-entity
                          geometry={`primitive: rounded-rect; width: ${fillWidth}; height: ${barHeight}; radius: ${fillRadius}`}
                          material="color: #4CAF50; opacity: 1.0; shader: flat"
                          position={`${-barWidth / 2 + fillWidth / 2} 0 0.001`}
                      ></a-entity>

                      <a-entity position={`${handleX} 0 0.002`}>
                          <a-circle
                          radius={barHeight * 0.6}
                          color="#ffffff"
                          material="shader: flat"
                          ></a-circle>
                          <a-ring
                          radius-inner={barHeight * 0.6}
                          radius-outer={barHeight * 0.65}
                          color="#4CAF50"
                          material="shader: flat"
                          position="0 0 0.001"
                          ></a-ring>
                      </a-entity>
                    </a-entity>
                );
            })()}
            
            {/* ----- Data Record Controls ----- */}
            <a-entity position="0.0 -0.20 0.0" >
              <a-entity
                id="sap-data-start"
                position="-0.43 0.18 0.01"
                className="raycastable menu-button"
                geometry={`primitive: rounded-rect; width: 0.38; height: 0.135; radius: 0.02`}
                rounded-rect-border={`width: 0.38; height: 0.135; radius: 0.02; color: ${isRecording ? '#25b22c' : '#ffffff'}`}
                material={`color: ${isRecording ? '#25b22c' : '#222222'}; opacity: 0.95; shader: flat`}
                onClick={() => {
                    if (!activeTaskId) {
                    setTaskMsg("Please select an active task before starting recording.");
                    return;
                    }
                    handleRecordControl("start");
                }}
                >
                <a-text
                    value="Start"
                    align="center"
                    color="#ffffff"
                    width="1.0"
                    position="0 0 0.01"
                    font={font_path}
                ></a-text>
                </a-entity>

                <a-entity 
                  id="sap-data-finish" 
                  position="-0.020 0.18 0.01" 
                  className="raycastable menu-button"
                  geometry={`primitive: rounded-rect; width: 0.38; height: 0.135; radius: 0.02`}
                  rounded-rect-border={`width: 0.38; height: 0.135; radius: 0.02; color: ${!isRecording ? '#f23333' : '#ffffff'}`}
                  material={`color: ${!isRecording ? '#d91d1d' : '#313131'}; opacity: 0.95; shader: flat`}
                  onClick={() => {
                      if (!activeTaskId) {
                      setTaskMsg("Please select an active task before stopping recording.");
                      return;
                      }
                      // handleRecordControl("stop");
                      const finishTime = Date.now() + time_offset;
                      if (activeTaskId) {
                        const startTime = taskTimes.current[activeTaskId]?.start;
                        const timecost = startTime ? (finishTime - startTime) / 1000 : null;

                        taskTimes.current[activeTaskId] = {
                          ...taskTimes.current[activeTaskId],
                          finish: finishTime,
                          timecost: timecost,
                        };
                      }
                      publishMQTT(MQTT_ROBOT_DATA_TOPIC + idtopic, JSON.stringify({ 
                        header: {
                          "userID": apiData?.userID || "unknown_user",
                          "robot": apiData?.robot || "unknown_robot",
                          "warehouse": apiData?.warehouse || "unknown_warehouse",
                          "warehouseTask":activeTaskId || "N/A",
                          "product":activeProductId || "N/A",
                        },
                        time: finishTime,
                        record: "off" 
                      }), 1);

                      if (isRecording) {
                        setHasRecordedCurrentTask(true); 
                      }
                      setIsRecording(false);
                      setTaskMsg(`Task ${activeTaskId || "N/A"} finished in ${taskTimes.current[activeTaskId]?.timecost?.toFixed(1) || "---"}s.`);

                      handleCompleteCurrentTask();

                  }}
                  > 
                  <a-text 
                      value="Finish" 
                      align="center" 
                      width="1.0" 
                      position="0 0 0.01" 
                      font={font_path}
                  ></a-text>
                </a-entity>

                <a-entity
                  id="sap-data-complete"
                  position="0.39 0.18 0.01"
                  class="menu-button"
                  geometry={`primitive: rounded-rect; width: 0.38; height: 0.135; radius: 0.02`}
                  rounded-rect-border={`width: 0.38; height: 0.135; radius: 0.02; color: ${canComplete ? '#ffa600' : '#3e3e3e'}`}
                  material={`color: ${canComplete ? '#d7983a' : '#1a1a1a'}; opacity: 0.95; shader: flat`}
                >
                  <a-text
                    value={canComplete ? "Completed" : "Completed"}
                    align="center"
                    color={canComplete ? '#ffffff' : '#555'}
                    width="1.0"
                    position="0 0 0.01"
                    font={font_path}
                  ></a-text>
              </a-entity>

            </a-entity>

            {/* Message */}
            <a-entity id="btp_message" position="-0.015 -1.0 0.01" 
              geometry={`primitive: rounded-rect; width: 1.25; height: 0.18; radius: 0.01`}
              material="color:rgb(93, 173, 253); opacity: 0.95"
              ><a-text value={taskMsg || "No Message"} align="center" color="#fff" width="1.25" position="0 0 0.01" font={font_path}></a-text>
            </a-entity>

          </a-entity>
        )}


        {/* -------------- VR Controller -------------*/}
        {/* <a-entity oculus-touch-controls="hand: right" vr-controller-right visible="true"></a-entity> */}
        {/* <a-entity oculus-touch-controls="hand: left" vr-controller-left visible="true"></a-entity> */}

        <a-entity id="hand-offset-left" position="0.00 -0.685 0.31">
          <a-entity 
            hand-tracking-controls="hand: left; modelStyle: mesh" 
            vr-hand-as-controller={`hand: left; showMenu: ${showMenu}`}
          ></a-entity>
        </a-entity>

        <a-entity id="hand-offset-right" position="-0.005 -0.685 0.301">
          <a-entity 
            hand-tracking-controls="hand: right; modelStyle: mesh" 
            vr-hand-as-controller={`hand: right; showMenu: ${showMenu}`}
          ></a-entity>
        </a-entity>

        <a-entity vr-controller-hmd></a-entity>
        
        {/* Show Controller Laser Pointer for Right Hand Only (for menu interaction) */}
        {showMenu && (
          <a-entity 
            oculus-touch-controls="hand: right"
            laser-controls="hand: right" 
            raycaster="objects: .raycastable"
          ></a-entity>
        )}
        
        {showVideo && (
        <a-entity
          stereo-split="
            eye: left; 
            videoId: stereoVideo;
            geometryType: sphere;
            radius: 100;
            segmentsWidth: 64;
            segmentsHeight: 64;
            phiStart: 9.3;
            phiLength: 160;
            thetaStart: 30;
            thetaLength: 130;
          "
          position="-0.30 10.0 10.0"
          scale="-1 1 1"
          rotation="0 180 0"
        ></a-entity>)}

        {showVideo && (
        <a-entity
          stereo-split="
            eye: right; 
            videoId: stereoVideo;
            geometryType: sphere;
            radius: 100;
            segmentsWidth: 64;
            segmentsHeight: 64;
            phiStart: 10.7; 
            phiLength: 160;
            thetaStart: 30;
            thetaLength: 130;
          "
          position="0.30 10.0 10.0"
          scale="-1 1 1"
          rotation="0 180 0"
        ></a-entity>)}

      </a-scene>

      <WebInterface {...interfacePropos}/>

    </>
  );
}