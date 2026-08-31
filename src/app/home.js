import 'aframe'
let THREE;
if (typeof window !== 'undefined' && window.AFRAME) {
    THREE = window.AFRAME.THREE;
}

import * as React from 'react'

import { WebRTC_G1_VRCam } from '../lib/WebRTC_Sora';
import RobotScene from './RobotScene_SAPNOW';
import registerAframeComponents from './components/registerAframeComponents'; 
import useRobotParamsInitialization from './hooks/useRobotParamsInitialization'
import useVRControllers from './hooks/useVRControllers'
import useBtpMqttSocket from './hooks/useBtpMqttSocket'
import MQTT_Setup from './MQTT_Setup';
import { mqttclient, idtopic, publishMQTT, codeType } from '../lib/MetaworkMQTT'
import { MQTT_CTRL_TOPIC, MQTT_DEVICE_TOPIC, MQTT_REQUEST_TOPIC, MQTT_UNREQUEST_TOPIC } from '../lib/MetaworkMQTT';
import { STATE_CODES } from '../modern_robotics/spatialKinematics.js';
import { roundArray } from '../lib/mathFunction.js';

// On Windows, run the following command to allow script execution at first:
// Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

/* ============================= Static Global Variables ==========================================*/

const mr = require('../modern_robotics/modern_robotics_core.js');

// Load Robot Model Assets, check 'Assets.js' for details
const robot_assets = [
    { robotId: "body", robot_model: "unitree_g1_dex3" },
];
const Euler_order = 'ZYX'; // Euler angle order

/* ============================= Main Component ==========================================*/
export default function DynamicHome(props) {
  const [rendered, set_rendered] = React.useState(false)
  const dtRef = React.useRef(0.01667);

  const [time_offset, setTimeOffset] = React.useState(0); // Time offset state
  const timeOffsetRef = React.useRef(0);

  const robotNameList = ["Unitree-G1-Dex3"]
  const [robotName, set_robotName] = React.useState(robotNameList[0])

  // Right Arm
  const [M_right, setMRight] = React.useState([]);
  const [Slist_right, setSlistRight] = React.useState([]);
  const [Blist_right, setBlistRight] = React.useState([]);

  // Left Arm
  const [M_left, setMLeft] = React.useState([]);
  const [Slist_left, setSlistLeft] = React.useState([]);
  const [Blist_left, setBlistLeft] = React.useState([]);

  // Torso/Cam Arm
  const [M_cam, setMCam] = React.useState([]);
  const [Slist_cam, setSlistCam] = React.useState([]);
  const [Blist_cam, setBlistCam] = React.useState([]);

  // Hand (Index/Middle)
  const [M_index, setMIndex] = React.useState([]);
  const [Slist_index, setSlistIndex] = React.useState([]);

  const [error_code, setErrorCode] = React.useState(STATE_CODES.NORMAL);
  const [error_code_left, setErrorCodeLeft] = React.useState(STATE_CODES.NORMAL);
  const [error_code_cam, setErrorCodeCam] = React.useState(STATE_CODES.NORMAL);

  // VR controller state
  const vrModeRef = React.useRef(false); // VR mode flag
  
  // Right Controller
  const [trigger_on, set_trigger_on] = React.useState(false)
  const [grip_on, set_grip_on] = React.useState(false)
  const [button_a_on, set_button_a_on] = React.useState(false)
  const [button_b_on, set_button_b_on] = React.useState(false)
  const [thumbstick_right, setThumbstickRight] = React.useState([0, 0]);
  const [thumbstick_down_right, setThumbstickDownRight] = React.useState(false);
  const [controller_object, set_controller_object] = React.useState(() => {
    const controller_object = new THREE.Object3D();
    // console.log("Right Controller Object Created:", controller_object);
    return controller_object;
  });

  // Left Controller
  const [trigger_on_left, set_trigger_on_left] = React.useState(false)
  const [grip_on_left, set_grip_on_left] = React.useState(false)
  const [button_x_on, set_button_x_on] = React.useState(false)
  const [button_y_on, set_button_y_on] = React.useState(false)
  const [thumbstick_left, setThumbstickLeft] = React.useState([0, 0]);
  const [thumbstick_down_left, setThumbstickDownLeft] = React.useState(false);
  const [controller_object_left, set_controller_object_left] = React.useState(() => {
    const controller_object_left = new THREE.Object3D();
    // console.log("Left Controller Object Created:", controller_object_left);
    return controller_object_left;
  });

  // HMD / Cam Controller
  const [controller_object_cam, set_controller_object_cam] = React.useState(() => {
    const controller_object_cam = new THREE.Object3D();
    // console.log("Camera Object Created:", controller_object_cam);
    return controller_object_cam;
  });

  // Menu
  const [showMenu, setShowMenu] = React.useState(true);
  const [hmdControl, setHmdControl] = React.useState(false); // HMD control flag
  const [showVideo, setShowVideo] = React.useState(false); // Show video feed flag
  const [VR_Control_Mode, setControlMode] = React.useState('inSpace'); // 'inSpace' or 'inBody', not used currently
  const [indicator, setIndicator] = React.useState('false');
  const [shareControl, setShareControl] = React.useState(false);
  const [showModel, setShowModel] = React.useState(true);

  const [wholeBodyControl, setWholeBodyControl] = React.useState(false); // not used currently, reserved for future whole-body control extension

  const [selectedMode, setSelectedMode] = React.useState('control'); 
  const [robotID, setRobotID] = React.useState(null);

  // View Camera Pose
  const [view_cam_pose, setViewCamPose] = React.useState([0.0, 0.3, 0.5, 0, 0, 0]);

  // WebRTC Recv
  const [webcamStream1, setWebcamStream1] = React.useState(null);
  const [webcamStream2, setWebcamStream2] = React.useState(null);
  const [webcamStream3, setWebcamStream3] = React.useState(null);

  // Change Robot
  const robotChange = ()=>{
    const get = (robotName)=>{
      let changeIdx = robotNameList.findIndex((e)=>e===robotName) + 1
      if(changeIdx >= robotNameList.length){
        changeIdx = 0
      }
      return robotNameList[changeIdx]
    }
    set_robotName(get)
  }

  /* ---------------------- Control Parameters ------------------------------------*/
  // Right Arm 
  const [theta_body, setThetaBody] = React.useState([0, 0, 0, 0, 0, 0, 0, 0]);
  const [dtheta_body, setDThetaBody] = React.useState([0, 0, 0, 0, 0, 0, 0, 0]);

  const [theta_tool, setThetaTool] = React.useState([0, 0, 0, 0, 0, 0, 0]);
  const [joint_limits_right, setJointLimitsRight] = React.useState([]);
  const [rightArmPosition, setRightArmPosition] = React.useState("0.0, 0.0, 0.0");

  // Left Arm
  const [theta_body_left, setThetaBodyLeft] = React.useState([0, 0, 0, 0, 0, 0, 0, 0]);
   const [dtheta_body_left, setDThetaBodyLeft] = React.useState([0, 0, 0, 0, 0, 0, 0, 0]);

  const [theta_tool_left, setThetaToolLeft] = React.useState([0, 0, 0, 0, 0, 0, 0]);
  const [joint_limits_left, setJointLimitsLeft] = React.useState([]);
  const [leftArmPosition, setLeftArmPosition] = React.useState("0.0, 0.0, 0.0");

  // CAM Arm
  const [theta_body_cam, setThetaBodyCam] = React.useState([0, 0, 0]);
  const [joint_limits_cam, setJointLimitsCam] = React.useState([]);

  // Robot State
  const [robot_state, setRobotState] = React.useState(null);

  // Scan Data
  const [scanData, setScanData] = React.useState({});

  /* ---------------------- Right Arm Initialize ------------------------------------*/
  const [position_ee, setPositionEE] = React.useState([0.19978+0.0415, -0.14847, -0.19654+0.29178]);
  const [euler_ee, setEuler] = React.useState([0,0,0]);
  const [R_ee, setREE] = React.useState(
    [[1,0,0],
    [0,1,0],
    [0,0,1]]
  );

  /* ---------------------- Left Arm Initialize ------------------------------------ */
  const [position_ee_left, setPositionEELeft] = React.useState([0.19978+0.0415, 0.14847, -0.19654+0.29178]);
  const [euler_ee_left, setEulerEELeft] = React.useState([0,0,0]);
  const [R_ee_left, setREELeft] = React.useState(
    [[1,0,0],
     [0,1,0],
     [0,0,1]]
  );

  /* ------------------------- Cam Arm Initialize ------------------------------------*/
  // const [camArmInitialized, setCamArmInitialized] = React.useState(false);
  const [position_ee_cam, setPositionEECam] = React.useState([-0.00396,0,0.044]);
  const [euler_ee_cam, setEulerEECam] = React.useState([0,0,0]); //[-Math.PI/2-Math.PI/4,0,0]
  const [R_ee_cam, setREECam] = React.useState(
    [[1,0,0],
     [0,1,0],
     [0,0,1]]
  );

  /* ======================== Waist Control (use hmd)) ================================*/
  const thetaBodyCamRef = React.useRef(theta_body_cam);
  const positionEECamRef = React.useRef(position_ee_cam);

  /*======================= VR Right Robot Arm Control ====================================*/
  /*** Right Arm Unified Control Loop (Use Quaternion Diff to get rotation axis in space) ***/
  const thetaBodyRef = React.useRef(theta_body);
  const positionEERef = React.useRef(position_ee);
  const EulerEERef = React.useRef(euler_ee);

  /*======================= VR Left Arm Control ====================================*/
  const thetaBodyLeftRef = React.useRef(theta_body_left);
  const positionEELeftRef = React.useRef(position_ee_left);
  const EulerEELeftRef = React.useRef(euler_ee_left);

  /* ---------------------- Hand Control ------------------------------------*/
  // Figer Points Distance
  const [thumb_index_right, setThumbIndexRight] = React.useState(0);
  const [thumb_middle_right, setThumbMiddleRight] = React.useState(0);
  const [index_meta_right, setIndexMetaRight] = React.useState(0);
  const [middle_meta_right, setMiddleMetaRight] = React.useState(0);
  const [thumb_index_inter_right, setThumbIndexInterRight] = React.useState(0);

  const [thumb_index_left, setThumbIndexLeft] = React.useState(0);
  const [thumb_middle_left, setThumbMiddleLeft] = React.useState(0);
  const [index_meta_left, setIndexMetaLeft] = React.useState(0);
  const [middle_meta_left, setMiddleMetaLeft] = React.useState(0);
  const [thumb_index_inter_left, setThumbIndexInterLeft] = React.useState(0);

  const thetaToolRightRef = React.useRef(theta_tool);
  const thetaToolLeftRef = React.useRef(theta_tool_left);

  /* ========================= Web Interface (Only for Web Control) =========================*/
  const lastInterfacePropsRef = React.useRef(null);
  const interfacePropos = React.useMemo(() => {
    if (vrModeRef.current && lastInterfacePropsRef.current) {
      return lastInterfacePropsRef.current;
    }
    const currentProps = {
      robotName, robotNameList, set_robotName,
      view_cam_pose, setViewCamPose,
      vr_mode: vrModeRef.current,
      selectedMode, setSelectedMode,
      theta_body, setThetaBody,
      theta_tool, setThetaTool,
      joint_limits_right, setJointLimitsRight,
      // position_ee, setPositionEE,
      // euler_ee, setEuler,
      theta_body_left, setThetaBodyLeft,
      theta_tool_left, setThetaToolLeft,
      joint_limits_left, setJointLimitsLeft,
      theta_body_cam, setThetaBodyCam,
      joint_limits_cam, setJointLimitsCam,
      requestRobot: () => requestRobot(mqttclient),
      unrequestRobot: () => unrequestRobot(),
      robotID, time_offset
    };
    lastInterfacePropsRef.current = currentProps;
    return currentProps;
  }, [
    robotName, robotNameList, set_robotName,
    view_cam_pose, setViewCamPose,
    selectedMode, setSelectedMode,
    theta_body, setThetaBody,
    theta_tool, setThetaTool,
    joint_limits_right, setJointLimitsRight,
    // position_ee, setPositionEE,
    // euler_ee, setEuler,
    theta_body_left, setThetaBodyLeft,
    theta_tool_left, setThetaToolLeft,
    joint_limits_left, setJointLimitsLeft,
    theta_body_cam, setThetaBodyCam,
    joint_limits_cam, setJointLimitsCam,
    rendered,
    mqttclient,
    robotID, time_offset
  ]);

  /*------------------------ Get message from BTP Action by WebSocket ---------------------------*/
  const [btpActionMsg, setBTPActionMsg] = React.useState({});

  /* ============================== MQTT ==========================================*/
  // Robot Request
  const [robotRequested, setRobotRequested] = React.useState(false); // Request Flag for Robot State Initialization

  // Request Robot
  const requestRobot = (mqttclient) => {
    const requestInfo = {
      devId: idtopic,
      type: codeType,
    }
    publishMQTT(MQTT_REQUEST_TOPIC, JSON.stringify(requestInfo), 1);
    setRobotRequested(true);
  }

  // Release Robot
  const unrequestRobot = () => {
    const unrequestInfo = {
      devId: idtopic
    }
    publishMQTT(MQTT_UNREQUEST_TOPIC, JSON.stringify(unrequestInfo), 1);
    publishMQTT(MQTT_DEVICE_TOPIC + robotID, JSON.stringify({ controller: "browser", devId: ""}), 1);
    setRobotID(null);
    setRobotRequested(false);
  }

  MQTT_Setup({
    // MQTT Client and Topics
    props,
    requestRobot,
    // robotID: setRobotID,
    robotID: robotID,        // 改动：传当前值
    setRobotID: setRobotID,  // 改动：单独传 setter
    btpActionMsg: setBTPActionMsg,

    // Robot State
    robot_state: setRobotState,
    scanData: setScanData,

  });

  /* ================================== Robot State Update =====================================*/
  const robotProps = {
    robotNameList,
    robotName,
    theta_body: mr.rad2deg(thetaBodyRef.current),
    theta_tool:thetaToolRightRef.current,
    theta_body_left: mr.rad2deg(thetaBodyLeftRef.current),
    theta_tool_left:thetaToolLeftRef.current,
    theta_body_cam: mr.rad2deg(thetaBodyCamRef.current),
  };

  /* ================================== VR Animation Loop =====================================*/
  const receiveStateRef = React.useRef(true); // VR MQTT switch
  const [, tick] = React.useReducer(x => x + 1, 0);

  const lastRenderTimeRef = React.useRef(0);
  const lastMQTTPublishTimeRef = React.useRef(0);

  const showMenuRef = React.useRef(showMenu);
  const shareControlRef = React.useRef(shareControl);
  React.useEffect(() => {
    showMenuRef.current = showMenu;
  }, [showMenu]);

  React.useEffect(() => {
    shareControlRef.current = shareControl;
  }, [shareControl]);

  const MQTT_PUBLISH_INTERVAL = 1000 / 50; // MQTT Publish FPS (50Hz)

  const onXRFrameMQTT = React.useCallback((time, frame) => {
    if (!vrModeRef.current) return;
    frame.session.requestAnimationFrame(onXRFrameMQTT);

    const dt = (time - lastRenderTimeRef.current) / 1000; // ms -> s
    dtRef.current = dt;
    
    lastRenderTimeRef.current = time;
    // setNow(performance.now()); 
    tick(); // Trigger re-render

    // MQTT Publish
    if (time - lastMQTTPublishTimeRef.current >= MQTT_PUBLISH_INTERVAL) {
      lastMQTTPublishTimeRef.current = time;

      if (mqttclient && receiveStateRef.current && !showMenuRef.current && !shareControlRef.current) {
        // MQTT Message 
        const ctrl_msg = {
          header: {
            time: Date.now() + timeOffsetRef.current,
            // devId: idtopic,
            // taskId: btpActionMsg.taskID || null,
          },
          left: {
            arm: roundArray(thetaBodyLeftRef.current),
            hand: roundArray(mr.deg2rad(thetaToolLeftRef.current)),
          },
          right: {
            arm: roundArray(thetaBodyRef.current),
            hand: roundArray(mr.deg2rad(thetaToolRightRef.current)),
          },
          waist: {
            joints: roundArray(thetaBodyCamRef.current),
          }
        };
        
        publishMQTT(
          MQTT_CTRL_TOPIC + idtopic, // Topic: control/user-id
          JSON.stringify(ctrl_msg), // Message: {timestamp, devId, left: {arm, hand}, right: {arm, hand}}
          0 // QoS
        );
      }
    }

  }, []);

  
  /* =========================== Aframe Components ==============================*/
  React.useEffect(() => {
    registerAframeComponents({
      set_rendered,
      robotChange,

      // Right Controller
      set_controller_object,
      set_trigger_on,
      set_grip_on,
      set_button_a_on,
      set_button_b_on,
      setThumbstickRight,
      setThumbstickDownRight,

      // Left Controller
      set_controller_object_left,
      set_trigger_on_left,
      set_grip_on_left,
      set_button_x_on,
      set_button_y_on,
      setThumbstickLeft,
      setThumbstickDownLeft,

      // Right Hand
      setThumbIndexRight,
      setThumbMiddleRight,
      setIndexMetaRight,
      setMiddleMetaRight,
      setThumbIndexInterRight,

      // Left Hand
      setThumbIndexLeft,
      setThumbMiddleLeft,
      setIndexMetaLeft,
      setMiddleMetaLeft,
      setThumbIndexInterLeft,

      // HMD
      set_controller_object_cam,

      // VR Camera Pose
      setViewCamPose,
      vrModeRef,
      props,
      onXRFrameMQTT,
      
      // Menu
      setShowMenu,
      setHmdControl,
      setShowVideo,
      // setControlMode,
      setShowModel,
      setShareControl,
      setWholeBodyControl,
    });
  }, []);

  useRobotParamsInitialization({
    rendered,
    // Right Arm
    setMRight, Slist_right, setSlistRight, Blist_right, setBlistRight,
    // Left Arm
    setMLeft, Slist_left, setSlistLeft, Blist_left, setBlistLeft,
    // Torso/Cam Arm
    setMCam, setSlistCam, setBlistCam,
    // Hand (Index/Middle)
    setMIndex, setSlistIndex,
    wholeBodyControl,
    // Right Arm 
    setThetaBody, setJointLimitsRight,
    // Left Arm
    setThetaBodyLeft, setJointLimitsLeft,
    // CAM Arm
    setThetaBodyCam, setJointLimitsCam
  });

  useVRControllers({
    Euler_order,
    rendered, dtRef,
    // Right Arm
    M_right, Slist_right, setSlistRight, Blist_right,
    // Left Arm
    M_left, Slist_left, setSlistLeft, Blist_left,
    // Torso/Cam Arm
    M_cam, Slist_cam,
    setErrorCode, setErrorCodeLeft, setErrorCodeCam,
    // VR controller state
    vrModeRef,
    // Right Controller
    trigger_on, thumbstick_down_right, setThumbstickDownRight, controller_object,
    // Left Controller
    trigger_on_left, thumbstick_down_left, setThumbstickDownLeft, controller_object_left,
    // HMD / Cam Controller
    controller_object_cam,
    // Menu
    showMenu, setShowMenu, hmdControl, showVideo, VR_Control_Mode, shareControl, setShareControl,
    wholeBodyControl, robotID,
    // Right Arm 
    theta_body, setThetaBody, dtheta_body, theta_tool, setThetaTool, joint_limits_right,
    // Left Arm
    theta_body_left, setThetaBodyLeft, dtheta_body_left, theta_tool_left, setThetaToolLeft, joint_limits_left,
    // CAM Arm
    theta_body_cam, setThetaBodyCam,
    // Right Arm Initialize
    position_ee, setPositionEE, euler_ee, setEuler, R_ee, setREE,
    // Left Arm Initialize
    position_ee_left, setPositionEELeft, euler_ee_left, setEulerEELeft, R_ee_left, setREELeft,
    // Cam Arm Initialize
    position_ee_cam, setPositionEECam, setEulerEECam, R_ee_cam, setREECam,
    // Waist Control (use hmd)
    thetaBodyCamRef, positionEECamRef,
    // VR Right Robot Arm Control
    thetaBodyRef, positionEERef, EulerEERef,
    // VR Left Arm Control
    thetaBodyLeftRef, positionEELeftRef, EulerEELeftRef,
    // Hand Control
    // Figer Points Distance
    thumb_index_right, thumb_middle_right, index_meta_right, middle_meta_right, thumb_index_inter_right,
    thumb_index_left, thumb_middle_left, index_meta_left, middle_meta_left, thumb_index_inter_left,
    thetaToolRightRef, thetaToolLeftRef
  });

  useBtpMqttSocket({
    setTimeOffset, timeOffsetRef,
    // Right Arm
    M_right, Slist_right,
    // Left Arm
    M_left, Slist_left,
    // Menu
    robotID, setRobotID,
    // Control Parameters
    setThetaBody, setThetaTool, setThetaBodyLeft,
    setThetaToolLeft, setThetaBodyCam, robot_state, setRobotState,
    // Get message from BTP Action by WebSocket
    setBTPActionMsg,
    // MQTT
    robotRequested, setRobotRequested
  });

  // Robot Secene Render
  return (
    <>
      <WebRTC_G1_VRCam 
        onVideoStream1={setWebcamStream1}
        // onVideoStream2={setWebcamStream2}
        // onVideoStream3={setWebcamStream3} 
      />

      <RobotScene
        time_offset={timeOffsetRef.current}
        robot_assets={robot_assets}
        rendered={rendered}

        robotProps={robotProps}
        interfacePropos={interfacePropos}
        view_cam_pose={view_cam_pose}
        viewer={props.viewer}
        monitor={props.monitor}

        // Right Arm
        state_codes={error_code}
        position_ee={mr.worlr2three(positionEERef.current)}
        euler_ee={EulerEERef.current}
        rightArmPosition={rightArmPosition}
        joint_limits_right={joint_limits_right}

        // Left Arm
        state_codes_left={error_code_left}
        position_ee_left={mr.worlr2three(positionEELeftRef.current)}
        euler_ee_left={EulerEELeftRef.current}
        leftArmPosition={leftArmPosition}
        joint_limits_left={joint_limits_left}

        // Waist
        state_codes_cam={error_code_cam}
        position_ee_cam={mr.worlr2three(positionEECamRef.current)}
        euler_ee_cam={euler_ee_cam}

        // Menu
        indicator={indicator}
        webcamStream1={webcamStream1}
        webcamStream2={webcamStream2}
        webcamStream3={webcamStream3}
        showMenu={showMenu}
        showVideo={showVideo}
        showModel={showModel}

        // SAP
        apiData={btpActionMsg}
        scanData={scanData}
      />
    </>
  );
}
