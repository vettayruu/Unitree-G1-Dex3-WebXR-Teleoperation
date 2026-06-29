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

  const botton_width = "0.45";
  const font_path = "/fonts/Roboto-msdf.json"; 

  const [activeTaskId, setActiveTaskId] = React.useState(null);
  const [activeProductId, setActiveProduct] = React.useState(null);
  const [task_msg, setTaskMsg] = React.useState("");
  
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
  }, [props.webcamStream1, props.showVideo]);

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

  // 1. 录制状态：true 为正在录制，false 为停止
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

  const [canComplete, setCanComplete] = React.useState(false);

  React.useEffect(() => {
    setCanComplete(Boolean(
      activeTaskId &&
      !isRecording &&
      hasRecordedCurrentTask &&
      isProductMatch &&
      WTDestination
    ));
  }, [activeTaskId, isRecording, hasRecordedCurrentTask, isProductMatch, WTDestination]);

  const handleActivateTask = (taskItem) => {
    setActiveTaskId(taskItem.warehouseTask);
    setActiveProduct(taskItem.product);
    setHasRecordedCurrentTask(false);
    setWTProduct(null);                              // 👈 清空上个任务的 product
    setWTDestination(null);                          // 👈 清空上个任务的 destination
    setScanHistory({ product: null, destination: null }); // 👈 清空扫码历史
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
          setTaskMsg(`Start recording for task ${activeTaskId || "N/A"}.`);
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
          setTaskMsg(`Stop recording for task ${activeTaskId || "N/A"}.`);
        } 
        
    }, [activeTaskId, isRecording]);

  const handleCompleteCurrentTask = () => {
    if (!activeTaskId) {
      setTaskMsg("[Error] No active task to complete.");
      return;
    }

    if (isRecording) {
      setTaskMsg("[Error] Cannot complete task while recording! Please stop recording first.");
      return;
    }

    if (!hasRecordedCurrentTask) {
      setTaskMsg("[Error] You must start and stop recording at least once before completing the task.");
      return;
    }

    if (!isProductMatch) {
      setTaskMsg("[Error] Product does not match the active task. Please scan the correct product.");
      return;
    }

    if (!WTDestination) {
      setTaskMsg("[Error] Destination not scanned yet. Please scan the destination before completing.");
      return;
    }

    setCompletedTaskIds((prev) => [...prev, activeTaskId]);
    setTaskMsg(`Task ${activeTaskId} has been completed and locked.`);

    setActiveTaskId(null);
    setActiveProduct(null);
    setHasRecordedCurrentTask(false);
    setWTProduct(null);           
    setWTDestination(null);       
    setScanHistory({ product: null, destination: null }); 
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
      console.error("扫码数据格式非合法 JSON:", scanData.value);
    }
  }, [scanData]); 

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

          {/* Camera */}
          <a-camera id="camera" cursor="rayOrigin: mouse;" position="0 0 0">

            <a-entity 
              position="-0.52 -0.30 -1.20" 
              rotation="-10 30 -8" 
              scale="0.6 0.6 0.6"
              highlight 
              button-action
            >
              <a-plane
                width="1.0"
                height="0.45"
                color="#111"
                opacity="0.5" 
                position="0 0.1 0"
              ></a-plane>

              <a-text 
                value="Active Task Info" 
                align="center" 
                color="#4CC3D9" 
                width="1.8" 
                position="0 0.22 0.01" 
                font ={font_path}
              ></a-text>

              {[
                { name: "Task", value: activeTaskId || "---"},
                { name: "Product", value: activeProductId || "---"},
              ].map((item, index) => (
                <a-entity key={item.name} position={`0 ${0.08 - index * 0.1} 0.01`}>
                  
                  <a-plane 
                    width="0.95" 
                    height="0.09" 
                    opacity="0.3" 
                    color={index % 2 === 0 ? "#333" : "#222"} 
                  ></a-plane>

                  <a-text value={item.name} position="-0.42 0 0.01" width="1.2" font={font_path}></a-text>

                  {/* Value */}
                  <a-text 
                    value={item.value} 
                    position="0.0 0 0.01" 
                    width="1.2" 
                    color={statusColors.text}
                    font={font_path}
                  ></a-text>

                  {/* Status Indicator */}
                  {/* <a-entity 
                    geometry="primitive: circle; radius: 0.015" 
                    material={`color: ${statusColors[item.status]}; shader: flat`}
                    position="0.36 0 0.01"
                  ></a-entity> */}

                </a-entity>
              ))}
            </a-entity>
            
            {/* Scanner Info */}
            <a-entity 
              position="-0.525 -0.56 -1.13" 
              rotation="-10 30 -8" 
              scale="0.6 0.6 0.6"
              highlight 
              button-action
            >
              <a-plane
                width="1.0"
                height="0.35"
                color="#111"
                opacity="0.5" 
                position="0 0.13 0"
              ></a-plane>

              <a-text 
                value="Scanner Value" 
                align="center" 
                color="#4CC3D9" 
                width="1.8" 
                position="0 0.24 0.01" 
                font={font_path}
              ></a-text>

              {[
                { 
                  name: "Product", 
                  value: WTProduct || "---",
                  hasData: WTProduct !== "---",
                  isScanned: scanHistory.product !== null,
                  isMatch: isProductMatch,
                },
                { 
                  name: "Destination", 
                  value: WTDestination || "---",
                  hasData: WTDestination !== "---",
                },
              ].map((item, index) => {

                const rowBgColor = index % 2 === 0 ? "#333" : "#222";

                let textColor = "#888"; // 默认灰色（无数据）
                if (item.hasData) {
                  if (item.name === "Product") {
                    if (item.isScanned) {
                      textColor = item.isMatch ? "#00ff00" : "#ff3333"; // 扫过码才显示匹配色
                    } else {
                      textColor = "#fff"; // 有任务数据但未扫码，显示白色
                    }
                  } else {
                    textColor = "#fff"; // Destination 有数据显示白色
                  }
                }

                return (
                  <a-entity key={item.name} position={`0 ${0.14 - index * 0.1} 0.01`}>
                    
                    <a-plane 
                      width="0.95" 
                      height="0.09" 
                      color={rowBgColor}
                      opacity="0.5"
                      material="shader: flat"
                    ></a-plane>

                    <a-text 
                      value={item.name} 
                      position="-0.42 0 0.01" 
                      width="1.2" 
                      font={font_path}
                      color="#fff"
                    ></a-text>

                    <a-text 
                      value={item.value} 
                      position="0.0 0 0.01" 
                      width="1.2" 
                      color={textColor}
                      font={font_path}
                    ></a-text>
                    
                  </a-entity>
                );
              })}
            </a-entity>

          </a-camera>
        </a-entity>

        {showMenu && (<a-entity
          id="background"
          position="0 0 0"
          geometry="primitive: sphere; radius: 2.0"
          material="color: gray; side: back; shader: flat"
          scale="0.001 0.001 0.001"
          visible="true" class="raycastable">
        </a-entity>)}

        {showMenu && (
          <a-entity id="setting" position="1.0 0.45 -1.2" rotation="0 -37 0" highlight button-action>
            {/* Background Plane */}
            <a-plane
              width="1.2"
              height="1.0"
              color="#222"
              opacity="1.0"
              position="0 0.20 0"
              // class="raycastable"
            ></a-plane><a-text value="Robot Settings" align="center" color="#fff" width="2.0" position="0 0.60 0.01" font={font_path}></a-text>
            {/* Button 1 */}
            <a-entity id="button1" position="-0.3 0.4 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.18`}
              material="color: white; opacity: 0.95"
            ><a-text value="HMD Control \n Off" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>
            
            {/* Button 2 */}
            <a-entity id="button2" position="0.3 0.4 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.18`}
              material="color: white; opacity: 0.95"
            ><a-text value="HMD Control \n On" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>
            
            {/* Button 3 */}
            <a-entity id="button3" position="-0.3 0.2 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.18`}
              material="color: white; opacity: 0.95"
            ><a-text value="Show Video \n Off" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>

            {/* Button 4 */}
            <a-entity id="button4" position="0.3 0.2 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.18`}
              material="color: white; opacity: 0.95"
            ><a-text value="Show Video \n On" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>

            {/* Button 5 */}
            <a-entity id="button5" position="-0.3 0.0 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.18`}
              material="color: white; opacity: 0.95"
            ><a-text value="Show Model \n On" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>

            {/* Button 6 */}
            <a-entity id="button6" position="0.3 0.0 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.18`}
              material="color: white; opacity: 0.95"
            ><a-text value="Show Model \n Off" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>

            {/* Button 7,8 Visual Assist */}
            {/* <a-entity id="button7" position="-0.3 -0.2 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.18`}
              material="color: white; opacity: 0.95"
            ><a-text value="Visual Assist \n On" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>

            <a-entity id="button8" position="0.3 -0.2 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.18`}
              material="color: white; opacity: 0.95"
            ><a-text value="Visual Assist \n Off" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity> */}

            {/* Button 9,10 Whole Body Control */}
            {/* <a-entity id="button9" position="-0.3 -0.4 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.18`}
              material="color: white; opacity: 0.95"
            ><a-text value="Whole Body Control \n On" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>

            <a-entity id="button10" position="0.3 -0.4 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.18`}
              material="color: white; opacity: 0.95"
            ><a-text value="Whole Body Control \n Off" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity> */}

          </a-entity>
        )}

        {/* SAP Menu */}
        {showMenu && (
          <a-entity id="task" position="-1.0 0.8 -1.2" rotation="0 37 0" highlight button-action>
            {/* Background Plane */}
            <a-plane
              width="1.5"
              height="1.65"
              color="#222"
              opacity="1.0"
              position="0 -0.35 0"
              // class="raycastable"
            ></a-plane>
            <a-text value="SAP EWM Task Menu" align="center" color="#fff" width="2.0" position="0 0.35 0.01" font={font_path}></a-text>

            {/* ----- Data Record Controls ----- */}
            <a-text value="Data Recording" align="right" color="#fff" width="1.25" position="-0.30 0.22 0.01" font={font_path}></a-text>

            {/* Start Button */}
            <a-entity 
              id="sap-data-start" 
              position="-0.46 0.08 0.01" 
              className="raycastable menu-button" // 在 React 中建议使用 className
              geometry={`primitive: plane; width: ${botton_width}; height: 0.15`}
              material={`color: ${isRecording ? '#00ff00' : '#333333'}; opacity: 0.95; shader: flat`}
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
                color="#fff" 
                width="1.0" 
                position="0 0 0.01" 
                font={font_path}
              ></a-text>
            </a-entity>

            {/* Stop Button */}
            <a-entity 
              id="sap-data-stop" 
              position="0.010 0.08 0.01" 
              className="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.15`}
              material={`color: ${!isRecording ? '#ff0000' : '#333333'}; opacity: 0.95; shader: flat`}
              onClick={() => {
                if (!activeTaskId) {
                  setTaskMsg("Please select an active task before stopping recording.");
                  return;
                }
                handleRecordControl("stop");
              }}
            > 
              <a-text 
                value="Stop" 
                align="center" 
                color="#fff" 
                width="1.0" 
                position="0 0 0.01" 
                font={font_path}
              ></a-text>
            </a-entity>

            <a-plane
              key={`complete-btn-${canComplete}`}  // 👈 canComplete 变化时强制重建元素
              id="sap-data-complete" 
              position="0.48 0.08 0.01" 
              class={canComplete ? "raycastable menu-button" : "menu-button"}
              width={botton_width}
              height="0.15"
              material={`color: ${canComplete ? '#ff9800' : '#1a1a1a'}; opacity: 0.95; shader: flat`}
              onClick={canComplete ? handleCompleteCurrentTask : () => {
                setTaskMsg("Action Denied: Task requires at least one 'Start & Stop' record cycle.");
              }}
            >
              <a-text 
                value="Complete" 
                align="center" 
                color={canComplete ? '#fff' : '#555'} 
                width="1.0" 
                position="0 0 0.01" 
                font={font_path}
              ></a-text>
            </a-plane>

            {/* Message */}
            <a-entity id="btp_message" position="-0.0 -0.10 0.01" 
              geometry={`primitive: plane; width: 1.3; height: 0.12`}
              material="color:rgb(72, 158, 244); opacity: 0.95"
            ><a-text value={task_msg || "---"} align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>

            {/* TASK INFO */}
            <a-entity id="data-section" position="-0.18 -0.52 0.02">
              <a-text value="Task Info" align="right" color="#fff" width="1.25" position="-0.27 0.28 0.01" font={font_path}></a-text>

              {/* VR UI Dynamic Table Container */}
              <a-entity position="0.10 0 0">
                
                {[
                  { name: "User", value: apiData?.userID || "---" },
                  { name: "Robot", value: apiData?.robot || "---" },
                  { name: "Warehouse", value: apiData?.warehouse || "---" }
                ].map((item, index) => {
                  const yPos = 0.2 - index * 0.075; 
                  return (
                    <a-entity key={item.name} position={`0 ${yPos} 0`}>
                      <a-plane width="1.25" height="0.08" color="#1a1a1a" opacity="0.9"></a-plane>
                      <a-text value={item.name} position="-0.55 0 0.01" width="1.0" font={font_path} color="#aaa"></a-text>
                      <a-text value={item.value} position="-0.2 0 0.01" width="1.0" font={font_path} color="#fff"></a-text>
                    </a-entity>
                  );
                })}

                <a-entity position="0 -0.05 0">
                  <a-plane width="1.25" height="0.08" color="#444a54" opacity="0.9"></a-plane>
                  <a-text value="Task ID"  position="-0.55 0 0.01" width="1" font={font_path} color="#00c8ff"></a-text>
                  <a-text value="product"  position="-0.18 0 0.01" width="1" font={font_path} color="#00c8ff"></a-text>
                  {/* <a-text value="Status"   position="0.15 0 0.01"  width="1" font={font_path} color="#00c8ff"></a-text> */}
                  <a-text value="Action"   position="0.36 0 0.01"  width="1" font={font_path} color="#00c8ff"></a-text>
                </a-entity>

                {Array.isArray(apiData?.task) && apiData.task.map((taskItem, index) => {
                  const taskYPos = -0.14 - index * 0.085;                   
                  const isActive = activeTaskId === taskItem.warehouseTask;

                  const isCompleted = completedTaskIds.includes(taskItem.warehouseTask);

                  return (
                    <a-entity key={taskItem.warehouseTask || index} position={`0 ${taskYPos} 0`}>
                      
                      <a-plane 
                        width="1.25" 
                        height="0.08" 
                        color={isActive ? "#1b365d" : (index % 2 === 0 ? "#333" : "#2a2a2a")} 
                        opacity="0.8"
                      ></a-plane>

                      {/* 列1：Task ID */}
                      <a-text 
                        value={taskItem.warehouseTask || "---"} 
                        position="-0.55 0 0.01" 
                        width="1" 
                        font={font_path}
                        // color={isActive ? "#00e6ff" : "#fff"}
                        color={isCompleted ? "#555" : (isActive ? "#00e6ff" : "#fff")}
                      ></a-text>

                      {/* 列2：Product */}
                      <a-text 
                        value={taskItem.product || "---"} 
                        position="-0.18 0 0.01" 
                        width="1" 
                        // color={isActive ? "#00e6ff" : "#fff"}
                        color={isCompleted ? "#555" : (isActive ? "#00e6ff" : "#fff")}
                        font={font_path}
                      ></a-text>

                      {/* 列3：Status 指示灯 */}
                      {/* <a-entity 
                        geometry="primitive: circle; radius: 0.015" 
                        // material={`color: ${isActive ? "#00e6ff" : "#fff"}; shader: flat`}
                        material={`color: ${isCompleted ? "#555" : (isActive ? "#00e6ff" : "#fff")}; shader: flat`}
                        position="0.18 0 0.01"
                      ></a-entity> */}

                      {/* 列4：Action 交互激活按钮 */}
                      <a-entity position="0.43 0 0.01">
                        {/* 按钮可点击实体 */}
                        <a-plane
                          // class="raycastable"
                          class={isCompleted ? "" : "raycastable"}
                          width="0.18"
                          height="0.065"
                          // color={isActive ? "#4CAF50" : "#777"}
                          color={isCompleted ? "#222" : (isActive ? "#4CAF50" : "#777")}
                          material="shader: flat"
                          onClick={() => {
                            if (isCompleted) return;
                            handleActivateTask(taskItem);
                          }}
                        ></a-plane>
                        
                        {/* 按钮文字说明 */}
                        <a-text
                          // value={isActive ? "ACTIVE" : "ACTIVATE"}
                          value={isCompleted ? "DONE" : (isActive ? "ACTIVE" : "ACTIVATE")}
                          align="center"
                          position="0 0 0.005"
                          width="0.8"
                          font={font_path}
                          // color="#fff"
                          color={isCompleted ? "#555" : "#fff"}
                        ></a-text>
                      </a-entity>
                      
                    </a-entity>
                  );
                })}
              </a-entity>
            </a-entity>

          </a-entity>
        )}


        {/* -------------- VR Controller -------------*/}
        {/* <a-entity oculus-touch-controls="hand: right" vr-controller-right visible="true"></a-entity> */}
        {/* <a-entity oculus-touch-controls="hand: left" vr-controller-left visible="true"></a-entity> */}

        <a-entity id="hand-offset-left" position="0.00 -0.685 0.31">
          <a-entity 
            hand-tracking-controls="hand: left; modelStyle: mesh" vr-hand-as-controller="hand: left" >
          </a-entity>
        </a-entity>

        <a-entity id="hand-offset-right" position="-0.005 -0.685 0.301">
          <a-entity 
            hand-tracking-controls="hand: right; modelStyle: mesh" vr-hand-as-controller="hand: right" >
          </a-entity>
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