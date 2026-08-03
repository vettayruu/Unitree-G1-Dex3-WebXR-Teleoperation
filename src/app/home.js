import 'aframe'
let THREE;
if (typeof window !== 'undefined' && window.AFRAME) {
    THREE = window.AFRAME.THREE;
}

import * as React from 'react'
import numeric, { t } from 'numeric';

import { WebRTC_G1_VRCam, WebRTC_Video_Send, WebRTC_Video_Send_Data, WebRTC_Data_Recv } from '../lib/WebRTC_Sora';
import RobotScene from './RobotScene_SAPNOW';
import registerAframeComponents from './registerAframeComponents'; 
import MQTT_Setup from './MQTT_Setup';
import { mqttclient, idtopic, version, publishMQTT, subscribeMQTT, codeType, currentIP } from '../lib/MetaworkMQTT'
import { MQTT_REGISTER_TOPIC, MQTT_CTRL_TOPIC, MQTT_DEVICE_TOPIC, MQTT_REQUEST_TOPIC, MQTT_UNREQUEST_TOPIC, MQTT_ROBOT_DATA_TOPIC, MQTT_ROBOT_STATE_TOPIC, MQTT_ROBOT_SCAN_TOPIC  } from '../lib/MetaworkMQTT';
import { IK_joint_velocity_limit, IK_joint_velocity_limit_dq } from '../modern_robotics/spatialKinematics.js';
import { io } from 'socket.io-client';
import {performTimeSync} from '../lib/timeSync.js';
import {roundArray, getAxisAngleFromQuatDiff, ScrewAxisToRMatrix} from '../lib/mathFunction.js';

// On Windows, run the following command to allow script execution at first:
// Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

/* ============================= Static Global Variables ==========================================*/

const mr = require('../modern_robotics/modern_robotics_core.js');
const RobotKinematics = require('../modern_robotics/modern_robotics_Kinematics.js');

// Load Robot Model Assets, check 'Assets.js' for details
const robot_assets = [
    { robotId: "body", robot_model: "unitree_g1_dex3" },
];
const Euler_order = 'ZYX'; // Euler angle order

// IK State Codes
const STATE_CODES = {
  NORMAL: 0x00,
  IK_FAILED: 0x01,
  VELOCITY_LIMIT: 0x02,
  JOINT_LIMIT: 0x03,
};

/* ============================= Functions ==========================================*/
const loadRobotParams = (robot_model) => {
  const rk = new RobotKinematics(robot_model);
  const M = rk.get_M();
  const Slist = rk.get_Slist();
  const Blist = mr.SlistToBlist(M, Slist);
  const jointLimits = rk.jointLimits;
  const jointInitial = rk.get_jointInitial();
  return {
    M, Slist, Blist,
    jointLimits, jointInitial
  };
};

function worlr2three(v) {
    return [-v[1], v[2], -v[0]];
}

function three2world(v) {
    return [-v[2], -v[0], v[1]];
}

/* ============================= Main Component ==========================================*/
export default function DynamicHome(props) {
  const [rendered, set_rendered] = React.useState(false)
  const dtRef = React.useRef(0.01667);

  const [time_offset, setTimeOffset] = React.useState(0); // Time offset state
  const timeOffsetRef = React.useRef(0);

  const robotNameList = ["Unitree-G1-Dex3"]
  const [robotName, set_robotName] = React.useState(robotNameList[0])

  // Load Robot Parameters
  const [robot_model_left, setRobotModelLeft] = React.useState("unitree_g1_arm_left_body");
  const [robot_model_right, setRobotModelRight] = React.useState("unitree_g1_arm_right_body");
  const [robot_model_cam, setRobotModelCam] = React.useState("unitree_g1_waist");
  const [hand_index_middle, setHandIndexMiddle] = React.useState("unitree_g1_hand_index_middle");

  const [robotParams, setRobotParams] = React.useState({
    left: null,  // left control robot parameters
    right: null, // right control robot parameters
    cam: null,   // camera robot parameters
    hand_index_middle: null, // hand kinematics parameters
  });

  React.useEffect(() => {
    const leftParams = loadRobotParams(robot_model_left);
    const rightParams = loadRobotParams(robot_model_right);
    const camParams = loadRobotParams(robot_model_cam);
    const handIndexMiddleParams = loadRobotParams(hand_index_middle);
    setRobotParams((prev) => ({
      ...prev,
      left: leftParams,
      right: rightParams,
      cam: camParams,
      hand_index_middle: handIndexMiddleParams,
    }));
  }, [robot_model_left, robot_model_right, robot_model_cam, hand_index_middle]);

  // Right Arm
  const [M_right, setMRight] = React.useState([]);
  const [Slist_right, setSlistRight] = React.useState([]);
  const Slist_right_FK = React.useRef([Slist_right]); 
  const [Blist_right, setBlistRight] = React.useState([]);

  // Left Arm
  const [M_left, setMLeft] = React.useState([]);
  const [Slist_left, setSlistLeft] = React.useState([]);
  const Slist_left_FK = React.useRef([Slist_left]); 
  const [Blist_left, setBlistLeft] = React.useState([]);

  // Torso/Cam Arm
  const [M_cam, setMCam] = React.useState([]);
  const [Slist_cam, setSlistCam] = React.useState([]);
  const [Blist_cam, setBlistCam] = React.useState([]);

  // Hand (Index/Middle)
  const [M_index, setMIndex] = React.useState([]);
  const [Slist_index, setSlistIndex] = React.useState([]);

  React.useEffect(() => {
    if (robotParams.right !== null) {
      setMRight(robotParams.right.M.map(arr => arr.slice())); // Deep copy
      setSlistRight(robotParams.right.Slist.map(arr => arr.slice())); // Deep copy
      setBlistRight(robotParams.right.Blist.map(arr => arr.slice())); // Deep copy
      console.log("Load Robot Params Right:", robotParams.right);
    }
    if (robotParams.left !== null) {
      setMLeft(robotParams.left.M.map(arr => arr.slice()));
      setSlistLeft(robotParams.left.Slist.map(arr => arr.slice()));
      setBlistLeft(robotParams.left.Blist.map(arr => arr.slice()));
      console.log("Load Robot Params Left:", robotParams.left);
    }
    if (robotParams.cam !== null) {
      setMCam(robotParams.cam.M.map(arr => arr.slice()));
      setSlistCam(robotParams.cam.Slist.map(arr => arr.slice()));
      setBlistCam(robotParams.cam.Blist.map(arr => arr.slice()));
      console.log("Load Robot Params Cam:", robotParams.cam);
    }
    if (robotParams.hand_index_middle !== null) {
      setMIndex(robotParams.hand_index_middle.M.map(arr => arr.slice()));
      setSlistIndex(robotParams.hand_index_middle.Slist.map(arr => arr.slice()));
      console.log("Load Hand Kinematics Params:", robotParams.hand_index_middle);
    }
  }, [robotParams.left, robotParams.right, robotParams.cam]);

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
  React.useEffect(() => {
    if (robotParams.right !== null && robotParams.left !== null) {
      if (!wholeBodyControl) {
          Slist_right[2][0] = 0;
          Blist_right[2][0] = 0;
          Slist_left[2][0] = 0;
          Blist_left[2][0] = 0;
      } else if (wholeBodyControl) {
          Slist_left[2][0] = 1;
          Blist_left[2][0] = 1;
          Slist_right[2][0] = 1;
          Blist_right[2][0] = 1;
      }

      setSlistRight(Slist_right);
      setBlistRight(Blist_right);
      setSlistLeft(Slist_left);
      setBlistLeft(Blist_left);

    }
  }, [rendered, wholeBodyControl]);

  React.useEffect(() => {
    if (robotParams.right !== null && robotParams.left !== null) {
      Slist_right_FK.current = Slist_right.map(arr => arr.slice());
      Slist_left_FK.current = Slist_left.map(arr => arr.slice());
      Slist_right_FK.current[2][0] = 1;
      Slist_left_FK.current[2][0] = 1;
    }
  }, [Slist_right, Slist_left]);


  const [selectedMode, setSelectedMode] = React.useState('control'); 
  const [robotID, setRobotID] = React.useState(null);

  // View Camera Pose
  // const [view_cam_pose, setViewCamPose] = React.useState([0.24, 0.20, -0.67, 0, 150, 0]);
  const [view_cam_pose, setViewCamPose] = React.useState([0.0, 0.3, 0.5, 0, 0, 0]);

  // WebRTC Recv
  const [webcamStream1, setWebcamStream1] = React.useState(null);
  const [webcamStream2, setWebcamStream2] = React.useState(null);
  const [webcamStream3, setWebcamStream3] = React.useState(null);

  // WebRTC Send
  const [vrLeftStream, setVrLeftStream] = React.useState(null);
  const [vrRightStream, setVrRightStream] = React.useState(null);
  const [controlData, setControlData] = React.useState(null);
  const [DataRecv, setDataRecv] = React.useState(null);

  // Robot Tool
  // const toolNameList = ["No tool"]
  // const [toolName,set_toolName] = React.useState(toolNameList[0])

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
  const [rightArmInitialized, setRightArmInitialized] = React.useState(false);
  const [position_ee, setPositionEE] = React.useState([0.19978+0.0415, -0.14847, -0.19654+0.29178]);
  const [euler_ee, setEuler] = React.useState([0,0,0]);
  const [R_ee, setREE] = React.useState(
    [[1,0,0],
    [0,1,0],
    [0,0,1]]
  );

  React.useEffect(() => {
    if (robotParams.right !== null) {
      const jointInitial_right = robotParams.right.jointInitial;
      if (!rightArmInitialized) {
        setThetaBody(jointInitial_right);
        setJointLimitsRight(robotParams.right.jointLimits);
        setRightArmInitialized(true);
        console.log("Right Robot Arm Initialized", jointInitial_right);
      }
    }
  }, [robotParams.right]);

  /* ---------------------- Left Arm Initialize ------------------------------------ */
  const [leftArmInitialized, setLeftArmInitialized] = React.useState(false);
  const [position_ee_left, setPositionEELeft] = React.useState([0.19978+0.0415, 0.14847, -0.19654+0.29178]);
  const [euler_ee_left, setEulerEELeft] = React.useState([0,0,0]);
  const [R_ee_left, setREELeft] = React.useState(
    [[1,0,0],
     [0,1,0],
     [0,0,1]]
  );

  React.useEffect(() => {
    if (robotParams.left !== null) {
      const jointInitial_left = robotParams.left.jointInitial;
      if (!leftArmInitialized) {
        setThetaBodyLeft(jointInitial_left);
        setJointLimitsLeft(robotParams.left.jointLimits);
        setLeftArmInitialized(true);
        console.log("Left Robot Arm Initialized", jointInitial_left);
      } 
    }
  }, [robotParams.left]);

  /* ------------------------- Cam Arm Initialize ------------------------------------*/
  const [camArmInitialized, setCamArmInitialized] = React.useState(false);
  const [position_ee_cam, setPositionEECam] = React.useState([-0.00396,0,0.044]);
  const [euler_ee_cam, setEulerEECam] = React.useState([0,0,0]); //[-Math.PI/2-Math.PI/4,0,0]
  const [R_ee_cam, setREECam] = React.useState(
    [[1,0,0],
     [0,1,0],
     [0,0,1]]
  );

  React.useEffect(() => {
    if (robotParams.cam !== null) {
      const jointInitial_cam = robotParams.cam.jointInitial;
      if (!camArmInitialized) {
        setThetaBodyCam(jointInitial_cam);
        setJointLimitsCam(robotParams.cam.jointLimits);
        setCamArmInitialized(true);
        console.log("Cam Robot Arm Initialized", jointInitial_cam);
      } 
    }
  }, [robotParams.cam]);


  /* ======================== Waist Control (use hmd)) ================================*/
  const thetaBodyCamRef = React.useRef(theta_body_cam);
  const positionEECamRef = React.useRef(position_ee_cam);
  const REECamRef = React.useRef(R_ee_cam);

  const [waistControlOwner, setWaistControlOwner] = React.useState('none'); // 'none', 'left', 'right'

  React.useLayoutEffect(() => {
    if (!rendered || !vrModeRef.current || showMenu || !hmdControl ) return;

    const q_raw = controller_object_cam.quaternion;

    // --- 提取欧拉角（YXZ 顺序适合人体腰部）---
    const euler = new THREE.Euler().setFromQuaternion(q_raw, 'YXZ');

    // --- 直接映射到关节角度 ---
    // 假设 theta_body_cam = [waist_yaw, waist_pitch, waist_roll]
    const new_theta_cam = [
      euler.y,  // Yaw (左右转头)
      0,  // Pitch (俯仰)
      0   // Roll (可选，一般不需要)
    ];

      // Ref Update
      thetaBodyCamRef.current = new_theta_cam;

      const T_cam = mr.FKinSpace(M_cam, Slist_cam, new_theta_cam);
      const [R_waist, p_cam] = mr.TransToRp(T_cam);
      
      positionEECamRef.current = p_cam;
      REECamRef.current = R_waist;
      const euler_ee_cam = worlr2three(mr.RotMatToEuler(R_waist, Euler_order))

      setThetaBodyCam(new_theta_cam);
      setErrorCodeCam(0);
      setPositionEECam(p_cam);
      setREECam(R_waist);
      setEulerEECam(euler_ee_cam);

  }, [
    controller_object_cam.position.x,
    controller_object_cam.position.y,
    controller_object_cam.position.z,
    controller_object_cam.quaternion.x,
    controller_object_cam.quaternion.y,
    controller_object_cam.quaternion.z,
    controller_object_cam.quaternion.w,
    rendered,
    vrModeRef.current,
    showMenu
  ]);

  /*======================= VR Right Robot Arm Control ====================================*/
  /*** Right Arm Unified Control Loop (Use Quaternion Diff to get rotation axis in space) ***/

  const lastVRPosRef = React.useRef(null); // Last Position Reference for Delta Calculation
  const lastQuatRef = React.useRef(null);  // Last Quaternion Reference for Rotation Calculation 

  const thetaBodyRef = React.useRef(theta_body);
  const positionEERef = React.useRef(position_ee);
  const REERef = React.useRef(R_ee);
  const EulerEERef = React.useRef(euler_ee);

  const [cameraYaw, setCameraYaw] = React.useState(0); // Camera Yaw Angle in Radians
  React.useEffect(() => {
    if (showVideo)
      setCameraYaw(47.0 * Math.PI / 180);
    else
      setCameraYaw(0);
  }, [showVideo]);

  const R_cam = [
    [Math.cos(cameraYaw), 0, Math.sin(cameraYaw)],
    [0, 1, 0],
    [-Math.sin(cameraYaw), 0, Math.cos(cameraYaw)]
  ]

  React.useLayoutEffect(() => {
    if (!rendered || !vrModeRef.current ) return;
    if (!thetaBodyRef.current || !positionEERef.current || !REERef.current) return;

    if (trigger_on && !showMenu) {
      const { position: p_raw, quaternion: q_raw } = controller_object;

      // --- Initial Frame ---
      if (!lastVRPosRef.current) {
        lastVRPosRef.current = [p_raw.x, p_raw.y, p_raw.z];
        lastQuatRef.current = q_raw.clone(); // Record initial quaternion as reference
        return;
      }

      // --- A. Pisition Difference ---
      const pos_diff_world = three2world([
        p_raw.x - lastVRPosRef.current[0],
        p_raw.y - lastVRPosRef.current[1],
        p_raw.z - lastVRPosRef.current[2]
      ]);
      
      lastVRPosRef.current[0] = p_raw.x;
      lastVRPosRef.current[1] = p_raw.y;
      lastVRPosRef.current[2] = p_raw.z;

      const pos_diff_cam = numeric.dot(R_cam, pos_diff_world); // Convert to camera frame if needed

      // --- B. Get rotation axis and angle from quaterion difference ---
      const { axis, theta } = getAxisAngleFromQuatDiff(q_raw, lastQuatRef.current);
      
      // Update last quaternion reference
      lastQuatRef.current.copy(q_raw);

      // --- C. Calculate Target SE3 ---
      const newP = [
        position_ee[0] + pos_diff_cam[0],
        position_ee[1] + pos_diff_cam[1],
        position_ee[2] + pos_diff_cam[2]
      ];

      const axis_world = [-axis[2], -axis[0], axis[1]]; 
      const axis_cam = numeric.dot(R_cam, axis_world); // Convert rotation axis to camera frame if needed

      const R_rel = ScrewAxisToRMatrix(axis_cam, theta); 
      const newT = mr.RpToTrans(numeric.dot(R_rel, R_ee), newP);

      // --- D. IK ---
      const { new_theta_body, error_code } = IK_joint_velocity_limit(
        newT, M_right, Slist_right, Blist_right, 
        joint_limits_right, 
        thetaBodyRef.current,
        VR_Control_Mode, 
        dtRef.current
      );

      // Update refs with new values (without triggering re-render)
      const T_right = mr.FKinSpace(M_right, Slist_right, new_theta_body);
      const [R_right, p_right] = mr.TransToRp(T_right);
      const euler_ee = worlr2three(mr.RotMatToEuler(R_right, Euler_order))

      thetaBodyRef.current = new_theta_body;
      positionEERef.current = p_right;
      REERef.current = R_right;
      EulerEERef.current = euler_ee;

      setThetaBody(new_theta_body);
      setErrorCode(error_code);
      
      setPositionEE(p_right);
      setREE(R_right);
      setEuler(euler_ee);
      
      if (wholeBodyControl && waistControlOwner === 'right') {
        thetaBodyCamRef.current = [new_theta_body[0], 0, 0];
        setThetaBodyCam([new_theta_body[0], 0, 0]);
      }

    } else {
      // --- Reset as trigger off ---
      if (lastVRPosRef.current || showMenu) {
        lastVRPosRef.current = null;
        lastQuatRef.current = null;
      }
    }
  }, [
    controller_object.position.x, 
    controller_object.position.y, 
    controller_object.position.z,
    controller_object.quaternion.x,
    controller_object.quaternion.y,
    controller_object.quaternion.z,
    controller_object.quaternion.w,
    trigger_on,
    VR_Control_Mode,
    waistControlOwner,
  ]);

  // React for Render
  React.useEffect(() => {
    if (!wholeBodyControl) {
      thetaBodyRef.current = theta_body;
      positionEERef.current = position_ee;
      REERef.current = R_ee;
    } 
    else {
      thetaBodyRef.current = [theta_body_cam[0], ...theta_body.slice(1)];
      const T_right = mr.FKinSpace(M_right, Slist_right, thetaBodyRef.current);
      const [R_right, p_right] = mr.TransToRp(T_right);
      positionEERef.current = p_right;
      REERef.current = R_right;
      const euler_ee = worlr2three(mr.RotMatToEuler(R_right, Euler_order))
      setPositionEE(p_right);
      setREE(R_right);
      setEuler(euler_ee);
    }
  }, [theta_body, dtheta_body, position_ee, R_ee, theta_body_cam]);

  /*======================= VR Left Arm Control ====================================*/
  const lastVRPosRef_left = React.useRef(null);
  const lastQuatRef_left = React.useRef(null);

  const thetaBodyLeftRef = React.useRef(theta_body_left);
  const positionEELeftRef = React.useRef(position_ee_left);
  const REELeftRef = React.useRef(R_ee_left);
  const EulerEELeftRef = React.useRef(euler_ee_left);

  React.useLayoutEffect(() => {
    if (!rendered || !vrModeRef.current) return;
    if (!thetaBodyLeftRef.current || !positionEELeftRef.current || !REELeftRef.current) return;

    if (trigger_on_left && !showMenu) {
      const { position: p_raw, quaternion: q_raw } = controller_object_left;

      if (!lastVRPosRef_left.current) {
        lastVRPosRef_left.current = [p_raw.x, p_raw.y, p_raw.z];
        lastQuatRef_left.current = q_raw.clone(); 
        return; 
      }

      // --- A. Delta Position ---
      const pos_diff_world = three2world([
        p_raw.x - lastVRPosRef_left.current[0],
        p_raw.y - lastVRPosRef_left.current[1],
        p_raw.z - lastVRPosRef_left.current[2]
      ]);

      lastVRPosRef_left.current[0] = p_raw.x;
      lastVRPosRef_left.current[1] = p_raw.y;
      lastVRPosRef_left.current[2] = p_raw.z;

      const pos_diff_cam = numeric.dot(R_cam, pos_diff_world); // Convert to camera frame if needed

      // --- B. Axis-Angle ---
      const { axis, theta } = getAxisAngleFromQuatDiff(q_raw, lastQuatRef_left.current);

      lastQuatRef_left.current.copy(q_raw);

      // --- C. Target Pose ---
      const newP = [
        position_ee_left[0] + pos_diff_cam[0],
        position_ee_left[1] + pos_diff_cam[1],
        position_ee_left[2] + pos_diff_cam[2]
      ];

      const axis_world = [-axis[2], -axis[0], axis[1]];
      const axis_cam = numeric.dot(R_cam, axis_world); // Convert rotation axis to camera frame if needed

      const R_rel = ScrewAxisToRMatrix(axis_cam, theta);
      const newT = mr.RpToTrans(numeric.dot(R_rel, R_ee_left), newP);

      // --- D. IK ---
      const { new_theta_body, error_code } = IK_joint_velocity_limit(
        newT, 
        M_left, 
        Slist_left, 
        Blist_left, 
        joint_limits_left, 
        // theta_body_left, 
        thetaBodyLeftRef.current,
        VR_Control_Mode,
        dtRef.current
      );

      const T_left = mr.FKinSpace(M_left, Slist_left, new_theta_body);
      const [R_left, p_left] = mr.TransToRp(T_left);
      const euler_ee_left = worlr2three(mr.RotMatToEuler(R_left, Euler_order))

      // Ref Update
      thetaBodyLeftRef.current = new_theta_body;
      positionEELeftRef.current = p_left;
      REELeftRef.current = R_left;
      EulerEELeftRef.current = euler_ee_left;

      setThetaBodyLeft(new_theta_body);
      setErrorCodeLeft(error_code);

      setPositionEELeft(p_left);
      setREELeft(R_left);
      setEulerEELeft(euler_ee_left);

      if (wholeBodyControl && waistControlOwner === 'left') {
        thetaBodyCamRef.current = [new_theta_body[0], 0, 0];
        setThetaBodyCam([new_theta_body[0], 0, 0]);
      }

    } else {
      // --- Trigger Off Reset ---
      if (lastVRPosRef_left.current || showMenu) {
        lastVRPosRef_left.current = null;
        lastQuatRef_left.current = null;
      }
    }
  }, [
    controller_object_left.position.x,
    controller_object_left.position.y,
    controller_object_left.position.z,
    controller_object_left.quaternion.x,
    controller_object_left.quaternion.y,
    controller_object_left.quaternion.z,
    controller_object_left.quaternion.w,
    trigger_on_left,
    VR_Control_Mode,
    waistControlOwner,
    rendered
  ]);

  // Refresh for Left Arm
  React.useEffect(() => {
    if (!wholeBodyControl) {
      thetaBodyLeftRef.current = theta_body_left;
      positionEELeftRef.current = position_ee_left;
      REELeftRef.current = R_ee_left;
    } 
    else {
      thetaBodyLeftRef.current = [theta_body_cam[0], ...theta_body_left.slice(1)];
      const T_left = mr.FKinSpace(M_left, Slist_left, thetaBodyLeftRef.current);
      const [R_left, p_left] = mr.TransToRp(T_left);
      positionEELeftRef.current = p_left;
      REELeftRef.current = R_left;
      const euler_ee_left = worlr2three(mr.RotMatToEuler(R_left, Euler_order))
      setPositionEELeft(p_left);
      setREELeft(R_left);
      setEulerEELeft(euler_ee_left);
    } 
  }, [theta_body_left, dtheta_body_left, position_ee_left, R_ee_left, theta_body_cam]);

  //   React.useEffect(() => {
  //     thetaBodyLeftRef.current = theta_body_left;
  //     positionEELeftRef.current = position_ee_left;
  //     REELeftRef.current = R_ee_left;
  // }, [theta_body_left, position_ee_left, R_ee_left, theta_body_cam]);


  /* ---------------------- Waist State ------------------------------------*/
  React.useEffect(() => {
    if (!hmdControl && wholeBodyControl) {
      if (trigger_on && !trigger_on_left && !showMenu) {
        setWaistControlOwner('right');
        Slist_right[2][0] = 1;
        setSlistRight(Slist_right);
        Slist_left[2][0] = 1;
        setSlistLeft(Slist_left);
      } else if (!trigger_on && trigger_on_left && !showMenu) {
        setWaistControlOwner('left');
        Slist_left[2][0] = 1;
        setSlistLeft(Slist_left);
        Slist_right[2][0] = 1;
        setSlistRight(Slist_right);
      } else if (trigger_on && trigger_on_left && !showMenu){
        setWaistControlOwner('none');
        Slist_right[2][0] = 0;
        Slist_left[2][0] = 0;
        setSlistRight(Slist_right);
        setSlistLeft(Slist_left);
      }
    } else if (!hmdControl && !wholeBodyControl) {
      setWaistControlOwner('none');
      thetaBodyCamRef.current = [0, 0, 0];
      setThetaBodyCam([0, 0, 0]);

      thetaBodyLeftRef.current = [0, ...theta_body_left.slice(1)];
      const T_left = mr.FKinSpace(M_left, Slist_left, thetaBodyLeftRef.current);
      const [R_left, p_left] = mr.TransToRp(T_left);
      positionEELeftRef.current = p_left;
      REELeftRef.current = R_left;
      const euler_ee_left = worlr2three(mr.RotMatToEuler(R_left, Euler_order))
      setPositionEELeft(p_left);
      setREELeft(R_left);
      setEulerEELeft(euler_ee_left);

      thetaBodyRef.current = [0, ...theta_body.slice(1)];
      const T_right = mr.FKinSpace(M_right, Slist_right, thetaBodyRef.current);
      const [R_right, p_right] = mr.TransToRp(T_right);
      positionEERef.current = p_right;
      REERef.current = R_right;
      const euler_ee = worlr2three(mr.RotMatToEuler(R_right, Euler_order))
      setPositionEE(p_right);
      setREE(R_right);
      setEuler(euler_ee);

    }
  }, [wholeBodyControl, trigger_on, trigger_on_left, showMenu]);


  /* ---------------------- Hand Control ------------------------------------*/
  // Figer Points Distance
  const [thumb_index_right, setThumbIndexRight] = React.useState(0);
  const [thumb_middle_right, setThumbMiddleRight] = React.useState(0);
  const [index_meta_right, setIndexMetaRight] = React.useState(0);
  const [middle_meta_right, setMiddleMetaRight] = React.useState(0);
  const [thumb_index_inter_right, setThumbIndexInterRight] = React.useState(0);
  const [handGestureModeRight, setHandGestureModeRight] = React.useState('free'); // 'free', 'thumb-index', 'thumb-middle', 'all'

  const [thumb_index_left, setThumbIndexLeft] = React.useState(0);
  const [thumb_middle_left, setThumbMiddleLeft] = React.useState(0);
  const [index_meta_left, setIndexMetaLeft] = React.useState(0);
  const [middle_meta_left, setMiddleMetaLeft] = React.useState(0);
  const [thumb_index_inter_left, setThumbIndexInterLeft] = React.useState(0);
  const [handGestureModeLeft, setHandGestureModeLeft] = React.useState('free'); // 'free', 'thumb-index', 'thumb-middle', 'all'

  const thetaToolRightRef = React.useRef(theta_tool);
  const thetaToolLeftRef = React.useRef(theta_tool_left);

  // React.useEffect(() => {
  //   if (thumb_index_inter_right > 0.95) {
  //     setScanData(scanDataRaw);
  //   }
  // }, [thumb_index_inter_right]);

  // 在你的主程序/父组件内：
  // 1. 在组件顶部（useEffect 外部）或 useRef 中声明一个开关锁，记录上一次是否已经发送过 ON
  const hasFiredOnRef = React.useRef(false);

  React.useEffect(() => {
    // 容错处理：确保 robotID 存在时才执行逻辑
    if (!robotID) return;
    const targetTopic = `scan/user/${robotID}`; 

    // 条件 A：手指极度贴合（> 0.98），且【之前没有发送过 ON】
    if (thumb_index_inter_right > 0.95) {
      if (!hasFiredOnRef.current) {
        const payload = JSON.stringify({
          action: "on",
          time: Date.now()
        });

        console.log("🚀 [MQTT] 发送抓取/扫码开启信号 (仅此一次):", payload);
        publishMQTT(targetTopic, payload, 1);
        
        hasFiredOnRef.current = true; // 🌟 锁住！防止重复发送
      }
    } 
    
    // 条件 B：手指松开（比如小于 0.60），且【当前处于 ON 的状态】
    else if (thumb_index_inter_right < 0.75) {
      if (hasFiredOnRef.current) {
        const payload = JSON.stringify({
          action: "off",
          time: Date.now()
        });

        console.log("🛑 [MQTT] 发送释放/扫码关闭信号:", payload);
        publishMQTT(targetTopic, payload, 1);
        
        hasFiredOnRef.current = false; // 🌟 解锁！允许下一次捏合时再次触发 ON
      }
    }

  }, [thumb_index_inter_right, robotID]);

  const pinchThreshold = 0.78; 
  const releaseThreshold = 0.75; 

  React.useLayoutEffect(() => {
    if (!rendered || !vrModeRef.current || showMenu || shareControl) return;

    let newThumbRight = [0, 0, 0];
    let newMiddleRight = [0, 0];
    let newIndexRight = [0, 0];

    if (handGestureModeRight === 'free') {
        const isIndexPinching = thumb_index_right > pinchThreshold;
        const isMiddlePinching = thumb_middle_right > pinchThreshold;
        const isScan = thumb_index_inter_right > 0.6;

        if (isScan && thumb_index_inter_right > thumb_index_right) {
            setHandGestureModeRight('scan');
        } else {
            setHandGestureModeRight('free');
        }

        // if (isIndexPinching && thumb_index_right > thumb_middle_right) {
        //     setHandGestureModeRight('thumb-index');
        // } else if (isMiddlePinching && thumb_index_right < thumb_middle_right) {
        //     setHandGestureModeRight('thumb-middle');
        // } else {
        //     setHandGestureModeRight('free');
        // }
    }

    switch (handGestureModeRight) {
        case 'thumb-index':
            newThumbRight = [-thumb_index_right * 35, -thumb_index_right * 30, -thumb_index_right * 30];
            newIndexRight = [thumb_index_right * 75, thumb_index_right * 35];
            newMiddleRight = [middle_meta_right * 75, middle_meta_right * 75];
            if (thumb_index_right < releaseThreshold) setHandGestureModeRight('free');
            break;
        case 'thumb-middle':
            newThumbRight = [thumb_middle_right * 35, -thumb_middle_right * 30, -thumb_middle_right * 30];
            newIndexRight = [index_meta_right * 75, index_meta_right * 75];
            newMiddleRight = [thumb_middle_right * 75, thumb_middle_right * 35];
            if (thumb_middle_right < releaseThreshold) setHandGestureModeRight('free');
            break;
        case 'scan':
            newThumbRight = [0, -thumb_index_inter_right * 85, -thumb_index_inter_right * 85];
            newIndexRight = [index_meta_right * 85, index_meta_right * 85];
            newMiddleRight = [middle_meta_right * 85, middle_meta_right * 85];
            if (thumb_index_inter_right < 0.55) setHandGestureModeRight('free');
            break;
        default: // 'free'
            // newThumbRight = [0, -thumb_index_inter_right * 30, -thumb_index_inter_right * 40];
            // newIndexRight = [index_meta_right * 85, index_meta_right * 40];
            // newMiddleRight = [middle_meta_right * 85, middle_meta_right * 40];

            // Box Grasping
            newThumbRight = [0, -thumb_index_right * 30, -thumb_index_right * 30];
            newIndexRight = [thumb_index_right * 85, thumb_index_right * 30];
            newMiddleRight = [thumb_index_right * 85, thumb_index_right * 30];

            // Object Grasping
            // newThumbRight = [-thumb_index_right * 35, -thumb_index_right * 40, -thumb_index_right * 40];
            // newIndexRight = [thumb_index_right * 60, thumb_index_right * 60];
            // newMiddleRight = [middle_meta_right * 70, middle_meta_right * 85];

            break;
    }

    setThetaTool([...newThumbRight, ...newMiddleRight, ...newIndexRight]);

  }, [
    thumb_index_right, 
    thumb_middle_right, 
    thumb_index_inter_right,
    index_meta_right, 
    middle_meta_right, 
    handGestureModeRight
  ]);

  React.useEffect(() => {
    thetaToolRightRef.current = theta_tool;
  }, [theta_tool]);

  React.useLayoutEffect(() => {
      if (!rendered || !vrModeRef.current || showMenu || shareControl) return;

      let newThumbLeft = [0, 0, 0];
      let newMiddleLeft = [0, 0];
      let newIndexLeft = [0, 0];

      // if (handGestureModeLeft === 'free') {
      //     const isIndexPinching = thumb_index_left > pinchThreshold;
      //     const isMiddlePinching = thumb_middle_left > pinchThreshold;

      //     if (isIndexPinching && thumb_index_left > thumb_middle_left) {
      //         setHandGestureModeLeft('thumb-index');
      //     } else if (isMiddlePinching && thumb_index_left < thumb_middle_left) {
      //         setHandGestureModeLeft('thumb-middle');
      //     } else {
      //         setHandGestureModeLeft('free');
      //     }
      // }
      

      switch (handGestureModeLeft) {
          case 'thumb-index':
              newThumbLeft = [-thumb_index_left * 35, thumb_index_left * 30, thumb_index_left * 30];
              newIndexLeft = [-thumb_index_left * 75, -thumb_index_left * 35];
              newMiddleLeft = [-middle_meta_left * 75, -middle_meta_left * 75];
              if (thumb_index_left < releaseThreshold) setHandGestureModeLeft('free');
              break;
          case 'thumb-middle':
              newThumbLeft = [thumb_middle_left * 35, thumb_middle_left * 30, thumb_middle_left * 30];
              newMiddleLeft = [-thumb_middle_left * 75, -thumb_middle_left * 35];
              newIndexLeft = [-index_meta_left * 75, -index_meta_left * 75];
              if (thumb_middle_left < releaseThreshold) setHandGestureModeLeft('free');
              break;
          default: // 'free'
              // newThumbLeft = [0, thumb_index_inter_left * 30, thumb_index_inter_left * 90];
              // newIndexLeft = [-index_meta_left * 90, -index_meta_left * 90];
              // newMiddleLeft = [-middle_meta_left * 90, -middle_meta_left * 90];

              // Box Grasping
              newThumbLeft = [0, thumb_index_left * 30, thumb_index_left * 30];
              newIndexLeft = [-thumb_index_left * 85, -thumb_index_left * 30];
              newMiddleLeft = [-thumb_index_left * 85, -thumb_index_left * 30];

              // Object Grasping
              // newThumbLeft = [-thumb_index_left * 35, thumb_index_left * 40, thumb_index_left * 40];
              // newIndexLeft = [-thumb_index_left * 60, -thumb_index_left * 60];
              // newMiddleLeft = [-middle_meta_left * 70, -middle_meta_left * 85];

              break;
      }

      setThetaToolLeft([...newThumbLeft, ...newMiddleLeft, ...newIndexLeft]);

    }, [
      thumb_index_left, 
      thumb_middle_left, 
      thumb_index_inter_left,
      index_meta_left, 
      middle_meta_left, 
      handGestureModeLeft
    ]);

  React.useEffect(() => {
    thetaToolLeftRef.current = theta_tool_left;
  }, [theta_tool_left]);

  // Button
  React.useEffect(() => {
    if (thumbstick_down_left) {
      setShowMenu(prev => !prev);
      setThumbstickDownLeft(false);
      console.log("Show Menu:", !showMenu);
    }
  }, [thumbstick_down_left]);

  React.useEffect(() => {
    if (thumbstick_down_right) {
      setShareControl(prev => !prev);
      setThumbstickDownRight(false);
      console.log("Shared Control On:", !shareControl);
    }
  }, [thumbstick_down_right]);


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
  const socketRef = React.useRef(null);

  React.useEffect(() => {
    const wsurl = 'https://liust.local/ws';
    // const wsurl = currentIP + '/ws';
    const socket = io(wsurl, {
      transports: ['websocket'],
      upgrade: true
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ WebSocket connected!");
      socket.emit("register_user", { userId: idtopic }); 

      performTimeSync(socket).then((offset) => {
        if (offset !== null) {
          timeOffsetRef.current = offset;
          setTimeOffset(offset);
          console.log(`⏱️ Time sync successful! Local time offset: ${offset}ms`);
        }
      });

      console.log(`🔄 [WS-Sync] Requesting cache for: ${idtopic}`);
      socket.emit("task_cache", { userId: idtopic });
    });

    socket.on('btp_action', (action) => { 
      console.log("📩 Recv Message from BTP Action:", action);
      setBTPActionMsg(action); 
      publishMQTT(MQTT_DEVICE_TOPIC + action.robot, JSON.stringify({ controller: "browser", devId: idtopic }), 1)
      console.log(`🔄 [BTP Action] Published to MQTT for robotID: ${action.robot}`);
      setRobotID(action.robot); // Update robotID based on BTP action
      setRobotRequested(true);
      subscribeMQTT(MQTT_ROBOT_STATE_TOPIC + action.robot);  // 新增
      subscribeMQTT(MQTT_ROBOT_SCAN_TOPIC + action.robot);   // 新增
    });

    socket.on('get_cache', (data) => { 
      console.log("📩 [Cache] Recv Message from BTP Action:", data);
      
      // 1. 拿到原始的列表
      const cacheList = data?.cache;
      
      if (Array.isArray(cacheList) && cacheList.length > 0) {
        const [cachedObj] = cacheList; // 等同于 const cachedObj = cacheList[0];
        
        if (cachedObj && cachedObj.userID) {
          console.log("✅ [Cache] Destructured successfully:", cachedObj);
          setBTPActionMsg(cachedObj); 
          publishMQTT(MQTT_DEVICE_TOPIC + cachedObj.robot, JSON.stringify({ controller: "browser", devId: idtopic }), 1)
          console.log(`🔄 [Cache] Published to MQTT for robotID: ${cachedObj.robot}`);
          setRobotID(cachedObj.robot);
          setRobotRequested(true);
          subscribeMQTT(MQTT_ROBOT_STATE_TOPIC + cachedObj.robot);  // 新增
          subscribeMQTT(MQTT_ROBOT_SCAN_TOPIC + cachedObj.robot);   // 新增
        }
      }
    });
    
    socket.on('disconnect', () => { console.log('❌ WebSocket to BTP is Disconnected'); });

    return () => { 
      console.log('🔌 Unloading, disconnecting WebSocket');
      socket.disconnect(); 
    };
  }, [idtopic]);

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

  /* ---------------------- Robot State Update (Request Robot State) and Watchdog ---------------------*/
  const connectionWatchdogRef = React.useRef(null);
  React.useEffect(() => {
    if (robotID == null) return;

    if (connectionWatchdogRef.current) {
      clearTimeout(connectionWatchdogRef.current);
    }

    // Watchdog Timer: If no robot state update for 5 seconds, consider connection lost
    connectionWatchdogRef.current = setTimeout(() => {
      console.warn("Connection lost. No robot message update for 5 seconds. Please request again.");
      setRobotID(null);
      setRobotState(null); 
    }, 5000); // 5s

    if (robotRequested) {
      // User Info
      publishMQTT(MQTT_DEVICE_TOPIC + robotID, JSON.stringify({ controller: "browser", devId: idtopic }), 1)
      
      // Update robot state as Robot Request
      if (robot_state == null) return;

      setThetaBodyLeft(robot_state.left.arm)
      setThetaToolLeft(mr.rad2deg(robot_state.left.hand))
      setThetaBody(robot_state.right.arm)
      setThetaTool(mr.rad2deg(robot_state.right.hand))
      setThetaBodyCam(robot_state.waist.joints)

      console.log("Left Arm State Updated:", robot_state.left.arm);
      console.log("Left Hand State Updated:", robot_state.left.hand);
      console.log("Right Arm State Updated:", robot_state.right.arm);
      console.log("Right Hand State Updated:", robot_state.right.hand);
      console.log("Waist State Updated:", robot_state.waist.joints);

      const T_left = mr.FKinSpace(M_left, Slist_left, robot_state.left.arm);
      const [R_left, p_left] = mr.TransToRp(T_left);

      const T_right = mr.FKinSpace(M_right, Slist_right, robot_state.right.arm);
      const [R_right, p_right] = mr.TransToRp(T_right);

      setPositionEELeft(p_left);
      setREELeft(R_left);
      setPositionEE(p_right);
      setREE(R_right);

      // Reset request flag
      setRobotRequested(false);
    }

    return () => {
      if (connectionWatchdogRef.current) {
        clearTimeout(connectionWatchdogRef.current);
      }
    };

  }, [robot_state, robotID, robotRequested]);

  /* ================================== Robot State Update =====================================*/
  // const robotProps = React.useMemo(() => ({
  //   robotNameList, robotName, theta_body, theta_tool, theta_body_left, theta_tool_left, theta_body_cam
  // }), [robotNameList, robotName, theta_body, theta_tool, theta_body_left, theta_tool_left, theta_body_cam]);

  const robotProps = {
    robotNameList,
    robotName,
    theta_body: mr.rad2deg(thetaBodyRef.current),
    theta_tool:thetaToolRightRef.current,
    theta_body_left: mr.rad2deg(thetaBodyLeftRef.current),
    theta_tool_left:thetaToolLeftRef.current,
    theta_body_cam: mr.rad2deg(thetaBodyCamRef.current),
  };

  // React.useEffect(() => {
  //   window.robotRefs = {
  //     theta_body:thetaBodyRef,
  //     theta_tool:thetaToolRightRef,
  //     theta_body_left:thetaBodyLeftRef,
  //     theta_tool_left:thetaToolLeftRef,
  //     theta_body_cam,
  //   };
  // }, []);

  /* ================================== VR Animation Loop =====================================*/
  const receiveStateRef = React.useRef(true); // VR MQTT switch
  const [, tick] = React.useReducer(x => x + 1, 0);
  const [, setNow] = React.useState(Date.now());

  const lastRenderTimeRef = React.useRef(0);
  const lastUIUpdateTimeRef = React.useRef(0);
  const lastMQTTPublishTimeRef = React.useRef(0);
  // const sequenceNumberRef = React.useRef(0); // Check packet loss

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
        position_ee={worlr2three(positionEERef.current)}
        euler_ee={EulerEERef.current}
        rightArmPosition={rightArmPosition}
        joint_limits_right={joint_limits_right}

        // Left Arm
        state_codes_left={error_code_left}
        position_ee_left={worlr2three(positionEELeftRef.current)}
        euler_ee_left={EulerEELeftRef.current}
        leftArmPosition={leftArmPosition}
        joint_limits_left={joint_limits_left}

        // Waist
        state_codes_cam={error_code_cam}
        position_ee_cam={worlr2three(positionEECamRef.current)}
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
