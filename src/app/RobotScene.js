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

  const botton_width = "0.42";
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
              "destination": WTDestination || "N/A",
            },
            time: Date.now() + time_offset, 
            record: "on" 
          }), 1);
          setIsRecording(true);
          // setTaskMsg(`Task ${activeTaskId || "N/A"} activated`);
        } 
        
        else if (action === "stop") {
          // publishMQTT(MQTT_ROBOT_DATA_TOPIC + idtopic, JSON.stringify({ 
          //   header: {
          //     "userID": apiData?.userID || "unknown_user",
          //     "robot": apiData?.robot || "unknown_robot",
          //     "warehouse": apiData?.warehouse || "unknown_warehouse",
          //     "warehouseTask":activeTaskId || "N/A",
          //     "product":activeProductId || "N/A",
          //     "destination": WTDestination || "N/A",
          //   },
          //   time: Date.now() + time_offset,
          //   record: "off" 
          // }), 1);

          if (isRecording) {
            setHasRecordedCurrentTask(true); 
          }
          setIsRecording(false);
          // setTaskMsg(`Task ${activeTaskId || "N/A"} completed.`);
        } 
        
    }, [activeTaskId, activeProductId, isRecording, WTDestination, apiData]);

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

  // {Scan for Manual Task Activation}
  // React.useEffect(() => {
  //   if (!scanData?.value) return;

  //   try {
  //     const json = typeof scanData.value === "string"
  //       ? JSON.parse(scanData.value)
  //       : scanData.value;

  //     if (json?.type && json?.id) {
  //       if (json.type === "product") {
  //         setWTProduct(json.id);
  //         setScanHistory(prev => ({ ...prev, product: json.id }));
  //       } else if (json.type === "destination") {
  //         setWTDestination(json.id);
  //         setScanHistory(prev => ({ ...prev, destination: json.id }));
  //       } 
  //     }
  //   } catch (e) {
  //     console.error("扫码数据格式非合法 JSON:", scanData.value);
  //   }
  // }, [scanData]); 

  // {Scan for Auto Task Activation}
  // 计算任务总数和已完成数
  const totalTasks = apiData && Array.isArray(apiData.task) ? apiData.task.length : 0;
  const completedCount = completedTaskIds ? completedTaskIds.length : 0;

  // 计算进度比例 (0 ~ 1)
  const progressRatio = totalTasks > 0 ? completedCount / totalTasks : 0;
  const progressPercentage = Math.round(progressRatio * 100);

  // 定义进度条总物理宽度
  const mainBarMaxWidth = 1.25; // 刚好适配主菜单表格的宽度
  const mainBarWidth = mainBarMaxWidth * progressRatio;

  // 克服 A-Frame 居中锚点的向右延伸位置偏移公式
  const mainBarXPos = -mainBarMaxWidth / 2 + mainBarWidth / 2;

  // 动态计算进度条在列表下方的 Y 轴位置：
  // 基础高度在列表上方偏移，根据任务总数动态往下推，保证不管任务多还是少，都不会发生 UI 重叠
  const progressBarYPos = -0.16 - (totalTasks * 0.085) - 0.05;

  // 专门监听任务全部完成的通知
  React.useEffect(() => {
    const totalTasks = apiData && Array.isArray(apiData.task) ? apiData.task.length : 0;
    const completedCount = completedTaskIds ? completedTaskIds.length : 0;

    // 触发条件：有任务、任务全部完成、且当前还没有提示过这个消息（防止无限死循环赋值）
    if (totalTasks > 0 && completedCount === totalTasks && task_msg !== "Congratulations! All tasks completed!") {
      setTaskMsg("Congratulations! All tasks completed!");
    }
  }, [completedTaskIds, apiData, task_msg]);

  const lastProcessedScanRef = React.useRef(null);

  React.useEffect(() => {
    if (!scanData?.value) return;

    // 🚀 核心防重逻辑 1：如果这一帧的扫码数据和上一次处理过的一模一样，直接拦截，不重复走业务
    if (lastProcessedScanRef.current === scanData.value) {
      return;
    }

    try {
      const json = typeof scanData.value === "string"
        ? JSON.parse(scanData.value)
        : scanData.value;

      if (json?.type && json?.id) {
        
        // ==========================================
        // 1. 扫到商品：自动激活任务
        // ==========================================
        if (json.type === "product") {
          setWTProduct(json.id);
          setScanHistory(prev => ({ ...prev, product: json.id }));

          if (apiData && Array.isArray(apiData.task)) {
            const firstMatchedTask = apiData.task.find(taskItem => 
              taskItem.product === json.id && 
              !completedTaskIds.includes(taskItem.warehouseTask)
            );

            if (firstMatchedTask) {
              console.log(`【自动激活】自动匹配并激活任务: ${firstMatchedTask.warehouseTask}`);
              setTaskMsg(`Task ${firstMatchedTask.warehouseTask} activated.`);
              handleActivateTask(firstMatchedTask); 
              handleRecordControl("start"); // 扫到商品后自动开始录制
              
              // 🎯 成功消费该商品数据，记录下来
              lastProcessedScanRef.current = scanData.value;
            } else {
              setTaskMsg(`[Warning] No uncompleted task matches product: ${json.id}`);
            }
          }

        // ==========================================
        // 2. 扫到目的地：自动完成当前激活的任务
        // ==========================================
        } else if (json.type === "destination") {
          
          // 🚀 核心防重逻辑 2：如果当前根本没有激活的任务，说明可能已经被上一次执行结算过了，静默退出，不报错
          if (!activeTaskId) {
            return; 
          }

          // 先同步更新目的地状态
          setWTDestination(json.id);
          setScanHistory(prev => ({ ...prev, destination: json.id }));
          handleRecordControl("stop");

          publishMQTT(MQTT_ROBOT_DATA_TOPIC + idtopic, JSON.stringify({ 
            header: {
              "userID": apiData?.userID || "unknown_user",
              "robot": apiData?.robot || "unknown_robot",
              "warehouse": apiData?.warehouse || "unknown_warehouse",
              "warehouseTask":activeTaskId || "N/A",
              "product":activeProductId || "N/A",
              "destination": json.id || "N/A",
            },
            time: Date.now() + time_offset,
            record: "off" 
          }), 1);

          // 🛑 执行自动完成前的【前置安全检查】
          if (isRecording) {
            setTaskMsg("[Error] Cannot complete task while recording! Please stop recording first.");
            return;
          }

          // 💡 针对自动流程的容错：因为上面刚刚执行了 handleRecordControl("stop")，
          // 或者是自动流中由于时序问题导致的判定，这里可以根据你的实际业务决定是否卡死机制。
          // 如果 handleRecordControl("stop") 导致状态还没来得及变，这里可以用逻辑兜底
          if (!hasRecordedCurrentTask) {
            setTaskMsg("[Error] You must start and stop recording at least once before completing.");
            return;
          }

          if (!json.id) {
            setTaskMsg("[Error] Invalid destination barcode.");
            return;
          }

          // 🎯 通过所有检查，执行自动结算与清理
          setCompletedTaskIds((prev) => [...prev, activeTaskId]);
          setTaskMsg(`Task ${activeTaskId} completed.`);

          // 🎯 成功消费该目的地数据，记录下来
          lastProcessedScanRef.current = scanData.value;

          // 清理当前任务的所有上下状态，迎接下一个任务
          // setActiveTaskId(null);
          // setActiveProduct(null);
          setHasRecordedCurrentTask(false);
          // setWTProduct(null);           
          // setWTDestination(null);       
          // setScanHistory({ product: null, destination: null });
        } 
      }
    } catch (e) {
      console.error("扫码数据格式非合法 JSON:", scanData.value);
    }

  }, [scanData, apiData, completedTaskIds, activeTaskId, isRecording, hasRecordedCurrentTask]);


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

            {/* <a-entity 
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

                  <a-text 
                    value={item.value} 
                    position="0.0 0 0.01" 
                    width="1.2" 
                    color={statusColors.text}
                    font={font_path}
                  ></a-text>

                </a-entity>
              ))}
            </a-entity>
            
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
            </a-entity> */}

            {/* 整合后的统一任务与扫码状态看板 */}
            <a-entity 
              id="unified-task-monitor"
              position="-0.52 -0.30 -1.20" 
              rotation="-10 30 -8" 
              scale="0.6 0.6 0.6"
              highlight 
              button-action
            >
              <a-plane
                width="1.0"
                height="0.50"
                color="#111"
                opacity="0.6" 
                position="0 0.04 0" 
                material="shader: flat"
              ></a-plane>

              {/* 统一的看板标题 */}
              <a-text 
                value="Scanner Monitor" 
                align="center" 
                color="#4CC3D9" 
                width="1.6" 
                position="0 0.23 0.01" 
                font={font_path}
              ></a-text>

              <a-entity id="btp_message" position="-0.0 -0.12 0.01" 
                geometry={`primitive: plane; width: 0.95; height: 0.13`}
                material="color:rgb(82, 91, 100); opacity: 0.95"
              >
                <a-text value={task_msg || "---"} align="center" color="#ffffff" width="1.0" position="0.0 0 0.01" font={font_path}></a-text>
              </a-entity>

              {/* 数据行渲染 */}
              {[
                // { 
                //   name: "Task", 
                //   value: activeTaskId || "---", 
                //   type: "normal" 
                // },
                { 
                  name: "Product", 
                  value: activeProductId || "---", 
                  type: "product",
                  hasData: !!activeProductId,
                  isScanned: scanHistory.product !== null,
                  isMatch: isProductMatch 
                },
                { 
                  name: "Destination", 
                  value: WTDestination || "---", 
                  type: "destination",
                  hasData: WTDestination && WTDestination !== "---"
                },
              ].map((item, index) => {
                
                const yPos = 0.12 - index * 0.11; 
                const rowBgColor = index % 2 === 0 ? "#333" : "#222";

                // 🎯 动态文本颜色解析核心
                let textColor = "#888"; // 默认无数据时的暗灰色
                
                // 🟢 核心改动：精准判断当前显示的任务是否已经进入完成列表
                const isCurrentTaskDone = activeTaskId && completedTaskIds.includes(activeTaskId);

                if (isCurrentTaskDone) {
                  // 🌟 如果任务已完成且数据未被清空，整块看板的数值全部显示为象征完工的亮绿色
                  textColor = "#00ff00"; 
                } else if (item.value && item.value !== "---") {
                  if (item.type === "product") {
                    if (item.isScanned) {
                      textColor = item.isMatch ? "#00ff00" : "#ff3333"; 
                    } else {
                      textColor = "#fff"; 
                    }
                  } else if (item.type === "destination") {
                    textColor = "#fff"; 
                  } else {
                    textColor = statusColors?.text || "#fff"; 
                  }
                }

                return (
                  <a-entity key={item.name} position={`0 ${yPos} 0.01`}>
                    
                    {/* 单行背景条 */}
                    <a-plane 
                      width="0.95" 
                      height="0.09" 
                      color={rowBgColor} 
                      opacity="0.4" 
                      material="shader: flat"
                    ></a-plane>

                    {/* 标签名称 */}
                    <a-text 
                      value={item.name} 
                      position="-0.42 0 0.01" 
                      width="1.2" 
                      color="#aaa"
                      font={font_path}
                    ></a-text>

                    {/* 动态变化的实际数值 */}
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

        {/* SAP Menu Manual*/}
        {/* {false && (
          <a-entity id="task" position="-1.0 0.8 -1.2" rotation="0 37 0" highlight button-action>
            <a-plane
              width="1.5"
              height="1.65"
              color="#222"
              opacity="1.0"
              position="0 -0.35 0"
              // class="raycastable"
            ></a-plane>
            <a-text value="SAP Warehouse Task Menu" align="center" color="#fff" width="2.0" position="0 0.35 0.01" font={font_path}></a-text>

            <a-text value="Warehouse Task Recording" align="right" color="#fff" width="1.25" position="0.0 0.22 0.01" font={font_path}></a-text>

            <a-entity 
              id="sap-data-start" 
              position="-0.46 0.08 0.01" 
              className="raycastable menu-button" 
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

            <a-entity 
              id="sap-data-stop" 
              position="-0.020 0.08 0.01" 
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
              position="0.42 0.08 0.01" 
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

            <a-entity id="btp_message" position="-0.020 -0.10 0.01" 
              geometry={`primitive: plane; width: 1.3; height: 0.12`}
              material="color:rgb(72, 158, 244); opacity: 0.95"
            ><a-text value={task_msg || "---"} align="center" color="#fff" width="1.0" position="0.0 0 0.01" font={font_path}></a-text></a-entity>

            <a-entity id="data-section" position="-0.16 -0.52 0.02">
              <a-text value="Warehouse Task Info" align="right" color="#fff" width="1.25" position="0.0 0.28 0.01" font={font_path}></a-text>

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

                <a-entity position="0.04 -0.05 0">
                  <a-plane width="1.29" height="0.08" color="#444a54" opacity="0.9"></a-plane>
                  <a-text value="Task"  position="-0.585 0 0.01" width="1" font={font_path} color="#00c8ff"></a-text>
                  <a-text value="Product"  position="-0.21 0 0.01" width="1" font={font_path} color="#00c8ff"></a-text>
                  <a-text value="Action"   position="0.315 0 0.01"  width="1" font={font_path} color="#00c8ff"></a-text>
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

                      <a-text 
                        value={taskItem.warehouseTask || "---"} 
                        position="-0.55 0 0.01" 
                        width="1" 
                        font={font_path}
                        // color={isActive ? "#00e6ff" : "#fff"}
                        color={isCompleted ? "#555" : (isActive ? "#00e6ff" : "#fff")}
                      ></a-text>

                      <a-text 
                        value={taskItem.product || "---"} 
                        position="-0.18 0 0.01" 
                        width="1" 
                        // color={isActive ? "#00e6ff" : "#fff"}
                        color={isCompleted ? "#555" : (isActive ? "#00e6ff" : "#fff")}
                        font={font_path}
                      ></a-text>

                      <a-entity position="0.43 0.008 0.01">
                        <a-plane
                          // class="raycastable"
                          class={isCompleted ? "" : "raycastable"}
                          width="0.22"
                          height="0.065"
                          // color={isActive ? "#4CAF50" : "#777"}
                          color={isCompleted ? "#222" : (isActive ? "#4CAF50" : "#777")}
                          material="shader: flat"
                          onClick={() => {
                            if (isCompleted) return;
                            handleActivateTask(taskItem);
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
              </a-entity>
            </a-entity>

          </a-entity>
        )} */}

        {/* SAP Menu Auto*/}
        {showMenu && (
          <a-entity id="task" position="-1.0 0.8 -1.2" rotation="0 37 0" highlight button-action>
            {/* Background Plane */}
            <a-plane
              width="1.4"
              height="1.5"
              color="#222"
              opacity="1.0"
              position="-0.05 -0.25 0"
              // class="raycastable"
            ></a-plane>
            <a-text value="SAP Warehouse Task Menu" align="center" color="#fff" width="2.0" position="0 0.35 0.01" font={font_path}></a-text>

            {/* TASK INFO */}
            <a-entity id="data-section" position="-0.16 -0.08 0.02">
              <a-text value="Warehouse Task Info" align="right" color="#fff" width="1.25" position="0.0 0.28 0.01" font={font_path}></a-text>

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

                <a-entity position="0.0 -0.05 0">
                  <a-plane width="1.25" height="0.08" color="#444a54" opacity="0.9"></a-plane>
                  <a-text value="Task"  position="-0.55 0 0.01" width="1" font={font_path} color="#00c8ff"></a-text>
                  <a-text value="Product"  position="-0.18 0 0.01" width="1" font={font_path} color="#00c8ff"></a-text>
                  {/* <a-text value="Status"   position="0.15 0 0.01"  width="1" font={font_path} color="#00c8ff"></a-text> */}
                  <a-text value="Action"   position="0.32 0 0.01"  width="1" font={font_path} color="#00c8ff"></a-text>
                </a-entity>

                {Array.isArray(apiData?.task) && (() => {
                const MAX_DISPLAY = 5;
                const allTasks = [...apiData.task]; // 浅拷贝一份，避免直接修改原始 apiData

                // 1. 🎯 核心排序：根据 激活中 > 未激活 > 已完成 重新排列数组
                allTasks.sort((a, b) => {
                  // 计算 a 的状态权重
                  const aActive = activeTaskId === a.warehouseTask;
                  const aCompleted = completedTaskIds.includes(a.warehouseTask);
                  const aPriority = aActive ? 2 : (aCompleted ? 0 : 1);

                  // 计算 b 的状态权重
                  const bActive = activeTaskId === b.warehouseTask;
                  const bCompleted = completedTaskIds.includes(b.warehouseTask);
                  const bPriority = bActive ? 2 : (bCompleted ? 0 : 1);

                  // 降序排列：权重大的排在前面
                  return bPriority - aPriority;
                });

                // 2. 动态滑动窗口起点计算（既然激活的任务必然被排到了 index 0，这里默认从 0 开始切割即可）
                // 如果当前激活的任务完成了，它会被踢到后面，下一个未完成的任务会自动补位到第一行
                const start = 0; 
                const visibleTasks = allTasks.slice(start, start + MAX_DISPLAY);

                // 3. 开始循环渲染
                return visibleTasks.map((taskItem, localIndex) => {
                  const taskYPos = -0.14 - localIndex * 0.085;                  
                  const isActive = activeTaskId === taskItem.warehouseTask;
                  const isCompleted = completedTaskIds.includes(taskItem.warehouseTask);

                  return (
                    <a-entity key={taskItem.warehouseTask || localIndex} position={`0 ${taskYPos} 0`}>
                      
                      {/* 背景条颜色深浅交替（为了不让排序后颜色混乱，这里直接基于局部的 localIndex 决定深浅） */}
                      <a-plane 
                        width="1.25" 
                        height="0.08" 
                        color={isActive ? "#1b365d" : (localIndex % 2 === 0 ? "#333" : "#2a2a2a")} 
                        opacity="0.8"
                      ></a-plane>

                      {/* 列1：Task ID */}
                      <a-text 
                        value={taskItem.warehouseTask || "---"} 
                        position="-0.55 0 0.01" 
                        width="1" 
                        font={font_path}
                        color={isCompleted ? "#555" : (isActive ? "#00e6ff" : "#fff")}
                      ></a-text>

                      {/* 列2：Product */}
                      <a-text 
                        value={taskItem.product || "---"} 
                        position="-0.18 0 0.01" 
                        width="1" 
                        color={isCompleted ? "#555" : (isActive ? "#00e6ff" : "#fff")}
                        font={font_path}
                      ></a-text>

                      {/* 列3：Action 按钮 */}
                      <a-entity position="0.43 0.00 0.01">
                        <a-plane
                          class={isCompleted ? "" : "raycastable"}
                          width="0.22"
                          height="0.065"
                          color={isCompleted ? "#222" : (isActive ? "#4CAF50" : "#777")}
                          material="shader: flat"
                          onClick={() => {
                            if (isCompleted) return;
                            handleActivateTask(taskItem);
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
                });
              })()}

                {/* 🛠️ 核心新增：位于任务列表底部的动态总任务进度条 */}
                <a-entity position={`-0.04 -0.7 0`}>
                  
                  {/* 进度提示文本 */}
                  <a-text 
                    value={`Total Progress: ${completedCount} / ${totalTasks} (${progressPercentage}%)`}
                    position="-0.58 0.06 0.01"
                    width="1.1"
                    color="#00c8ff"
                    font={font_path}
                  ></a-text>

                  {/* 进度条槽底（深黑色背景条） */}
                  <a-plane
                    width={mainBarMaxWidth}
                    height="0.04"
                    color="#111"
                    opacity="0.9"
                    position="0 0 0.01"
                    material="shader: flat"
                  ></a-plane>

                  {/* 进度条实时填充条 */}
                  {mainBarWidth > 0 && (
                    <a-plane
                      width={mainBarWidth}
                      height="0.04"
                      // 全部满载完成变绿，否则显示青科技蓝
                      color={progressRatio === 1 ? "#00ff00" : "#00c8ff"}
                      position={`${mainBarXPos+0.05} -0.02 0.015`}
                      material="shader: flat"
                    ></a-plane>
                  )}

                </a-entity>

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