"use client";
import 'aframe'
import * as React from 'react'
import { WebRTC_Video_Recv, WebRTC_Video_Send, WebRTC_Video_Send_Data, WebRTC_Data_Recv } from '../lib/WebRTC_Sora';
import RobotScene from './RobotScene';
import registerAframeComponents from './registerAframeComponents'; 
import MQTT_Sub from './MQTT_Sub';
import { mqttclient, idtopic, publishMQTT, subscribeMQTT, codeType } from '../lib/MetaworkMQTT'
import numeric from 'numeric';
import { IK_joint_velocity_limit, IK_joint_velocity, IK_finger } from '../modern_robotics/spatialKinematics.js';

// On Windows, run the following command to allow script execution at first:
// Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

/* ============================= Static Global Variables ==========================================*/
const THREE = window.AFRAME.THREE;
const mr = require('../modern_robotics/modern_robotics_core.js');
const RobotKinematics = require('../modern_robotics/modern_robotics_Kinematics.js');

// Load Robot Model Assets
// Change your robot model: jaka_zu_5, agilex_piper, myCobot280, etc.
const robot_list = [
  // { robotId: "left_arm", robot_model: "unitree_g1_arm_left_body" },
  { robotId: "body", robot_model: "unitree_g1_arm_right_body" },
  // { robotId: "cam", robot_model: "myCobot280" }
];

const toolLimit = { min: 0, max: 60 }; 

const Euler_order = 'ZYX'; // Euler angle order

const dt = 16.67/1000; // VR input period in seconds 

// MQTT Topics
const MQTT_REQUEST_TOPIC = "mgr/request";
const MQTT_DEVICE_TOPIC = "dev/" + idtopic;
const MQTT_CTRL_TOPIC = "control/"; 
const MQTT_ROBOT_STATE_TOPIC = "robot/";
const MQTT_SHARE_TOPIC = "share/";
const MQTT_VR_TOPIC = "vr/";

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

function rotz(theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [
    [c, -s, 0],
    [s,  c, 0],
    [0,  0, 1],
  ];
}

function worlr2three(v) {
    return [-v[1], v[2], -v[0]];
}

function three2world(v) {
    return [-v[2], -v[0], v[1]];
}

/**
 * 优化后的逻辑：从两个四元数直接提取旋转轴和角度
 */
function getAxisAngleFromQuatDiff(q_curr, q_init) {
    // 1. 计算相对四元数 Q_rel = Q_curr * inv(Q_init)
    // THREE.js 中：q_rel = q_curr * q_init.inverse()
    const q_rel = new THREE.Quaternion().copy(q_init).invert().premultiply(q_curr);
    
    // 2. 提取角度 theta = 2 * acos(w)
    const w = Math.max(-1, Math.min(1, q_rel.w));
    const theta = 2 * Math.acos(w);
    
    // 3. 提取单位轴 (x, y, z) / sin(theta/2)
    const s = Math.sqrt(1 - w * w);
    let axis = [0, 0, 1]; // 默认轴，当 theta 趋近 0 时
    
    if (s > 1e-6) {
        axis = [q_rel.x / s, q_rel.y / s, q_rel.z / s];
    }
    
    return { axis, theta };
}

function ScrewAxisToRMatrixOptimized(axis, theta) {
    const [nx, ny, nz] = axis;
    const s = Math.sin(theta);
    const c = Math.cos(theta);
    const v = 1 - c; // versine of theta

    // 罗德里格斯公式直接构造矩阵分量
    // R = I*cos(theta) + [axis]_x*sin(theta) + axis*axis^T*(1-cos(theta))
    return [
        [nx * nx * v + c,      nx * ny * v - nz * s,  nx * nz * v + ny * s],
        [nx * ny * v + nz * s, ny * ny * v + c,      ny * nz * v - nx * s],
        [nx * nz * v - ny * s, ny * nz * v + nx * s, nz * nz * v + c     ]
    ];
}

function getMiddleFingerR(dot) {
    const d = Math.max(-1, Math.min(1, dot));
    const bend = Math.sqrt(Math.max(0, 1 - d * d));

    // 第一列 (末端X轴/指尖)：从 X 前转向 Z 上
    const vX = [d, 0, bend];

    // 第二列 (末端Y轴/侧向)：在这个弯曲动作中，侧向 Y 保持不变
    const vY = [0, -1, 0];

    // 第三列 (末端Z轴/掌心)：为了维持右手定则 (Z = X cross Y)
    // 初始(dot=1)时为 [0, 0, 1]，当弯曲90度时变为 [-1, 0, 0]
    const vZ = [-bend, 0, d];

    return [
        [vX[0], vY[0], vZ[0]],
        [vX[1], vY[1], vZ[1]],
        [vX[2], vY[2], vZ[2]]
    ];
}

/* ============================= Main Component ==========================================*/
export default function DynamicHome(props) {
  const [rendered, set_rendered] = React.useState(false)

  const robotNameList = ["Model"]
  const [robotName,set_robotName] = React.useState(robotNameList[0])

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
  const [trigger_on,set_trigger_on] = React.useState(false)
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
  const [trigger_on_left,set_trigger_on_left] = React.useState(false)
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

  // Menu
  const [showMenu, setShowMenu] = React.useState(false);
  const [left_arm_mode, setLeftArmMode] = React.useState('free'); // 'free' or 'assist'
  const [VR_Control_Mode, setControlMode] = React.useState('inSpace'); // 'inSpace' or 'inBody'
  const [indicator, setIndicator] = React.useState('false');
  const [shareControl, setShareControl] = React.useState(false);

  const [wholeBodyControl, setWholeBodyControl] = React.useState(false);
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

 // MQTT
  const [selectedMode, setSelectedMode] = React.useState('control'); 
  const robotIDRef = React.useRef(idtopic); 

  // View Camera Pose
  const [view_cam_pose, setViewCamPose] = React.useState([0.24, 0.20, -0.67, 0, 150, 0]);

  // Message Display
  const [dsp_message, set_dsp_message] = React.useState("")

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
  const toolNameList = ["No tool"]
  const [toolName,set_toolName] = React.useState(toolNameList[0])

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
  const [robot_state, setRobotState] = React.useState(null);
  const [theta_body, setThetaBody] = React.useState([]);
  const [theta_tool, setThetaTool] = React.useState([[0, 0, 0], [0, 0], [0, 0]]);
  const [joint_limits_right, setJointLimitsRight] = React.useState([]);
  const [rightArmPosition, setRightArmPosition] = React.useState("0.0, 0.0, 0.0");

  // Left Arm
  const [robot_state_left, setRobotStateLeft] = React.useState(null);
  const [theta_body_left, setThetaBodyLeft] = React.useState([]); 
  const [theta_tool_left, setThetaToolLeft] = React.useState([[0, 0, 0], [0, 0], [0, 0]]);
  const [joint_limits_left, setJointLimitsLeft] = React.useState([]);
  const [leftArmPosition, setLeftArmPosition] = React.useState("0.0, 0.0, 0.0");

  // CAM Arm
  const [robot_state_cam, setRobotStateCam] = React.useState(null);
  const [theta_body_cam, setThetaBodyCam] = React.useState([]);
  const [joint_limits_cam, setJointLimitsCam] = React.useState([]);

  // Collision Check
  const [collision, setCollision] = React.useState(false);

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

  /* ---------------------- Left Arm Initialize ------------------------------------*/
  const [leftArmInitialized, setLeftArmInitialized] = React.useState(false);
  const [position_ee_left, setPositionEELeft] = React.useState([0.19978+0.0415,-0.14847,-0.19654+0.29178]);
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
  const [position_ee_cam, setPositionEECam] = React.useState([0,0,0]);
  const [euler_ee_cam, setEulerEECam] = React.useState([0,0,0]);
  const [R_ee_cam, setREECam] = React.useState(
    [1,0,0],
    [0,1,0],
    [0,0,1]
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

  /*======================= VR Right Robot Arm Control ====================================*/
  /* ---------------------- Right VR Controller Motion ------------------------------------*/
  // Update VR controller position and rotation matrix
  // !! Do not use Euler angle for control, since it can cause gimbal lock !!
  // 优化后的控制逻辑：使用四元数差值
  const lastVRPosRef = React.useRef(null);
  const lastQuatRef = React.useRef(null); // 改为存储四元数副本

  const thetaBodyRef = React.useRef(theta_body);
  const positionEERef = React.useRef(position_ee);
  const REERef = React.useRef(R_ee);

  React.useEffect(() => {
    if (!rendered || !vrModeRef.current || showMenu || shareControl) return;
    if (!thetaBodyRef.current || !positionEERef.current || !REERef.current) return;

    if (trigger_on) {
      const { position: p_raw, quaternion: q_raw } = controller_object;

      // --- 初始帧处理 (锚点锁定) ---
      if (!lastVRPosRef.current) {
        lastVRPosRef.current = [p_raw.x, p_raw.y, p_raw.z];
        lastQuatRef.current = q_raw.clone(); // 记录按下瞬间的姿态
        return;
      }

      // --- A. 计算位移增量 ---
      const pos_diff_world = mr.three2world([
        p_raw.x - lastVRPosRef.current[0],
        p_raw.y - lastVRPosRef.current[1],
        p_raw.z - lastVRPosRef.current[2]
      ]);
      
      lastVRPosRef.current[0] = p_raw.x;
      lastVRPosRef.current[1] = p_raw.y;
      lastVRPosRef.current[2] = p_raw.z;

      // --- B. 直接从四元数计算旋转轴和角度 (关键优化) ---
      const { axis, theta } = getAxisAngleFromQuatDiff(q_raw, lastQuatRef.current);
      
      // 更新姿态锚点
      lastQuatRef.current.copy(q_raw);

      // --- C. 计算机械臂目标位姿 ---
      const p_scale = 1.0;
      const R_scale = 1.0;
      
      const newP = [
        position_ee[0] + pos_diff_world[0] * p_scale,
        position_ee[1] + pos_diff_world[1] * p_scale,
        position_ee[2] + pos_diff_world[2] * p_scale
      ];

      let newT;
      if (VR_Control_Mode === 'inSpace') {
        // 空间模式：注意这里可以直接应用坐标转换映射
        // 如果你的轴需要映射：[-axis[2], -axis[0], axis[1]]
        const axis_world = [-axis[2], -axis[0], axis[1]]; 
        const R_rel = ScrewAxisToRMatrixOptimized(axis_world, theta * R_scale); 
        newT = mr.RpToTrans(numeric.dot(R_rel, R_ee), newP);
      } else {
        // 身体模式
        // const axis_body = [-axis[2], -axis[0], axis[1]]; 
        const R_rel = ScrewAxisToRMatrixOptimized(axis, theta * R_scale); 
        newT = mr.RpToTrans(numeric.dot(R_ee, R_rel), newP);
      }

      // --- D. 执行 IK 与 限速 ---
      const { new_theta_body, error_code } = IK_joint_velocity(
        newT, M_right, Slist_right, Blist_right, 
        joint_limits_right, 
        // thetaBodyRef.current,
        theta_body, 
        VR_Control_Mode, 
        dt
      );

      // setThetaBody(new_theta_body);
      // setErrorCode(error_code);

      // ✅ 更新 ref（不触发重渲染）
      thetaBodyRef.current = new_theta_body;

      // 计算新的末端位姿
      const T_right = mr.FKinSpace(M_right, Slist_right, new_theta_body);
      const [R_right, p_right] = mr.TransToRp(T_right);
      
      // ✅ 更新 ref
      positionEERef.current = p_right;
      REERef.current = R_right;

      const euler_ee = worlr2three(mr.RotMatToEuler(R_right, Euler_order))

      // ✅ 批量更新状态（只触发一次渲染）
      setThetaBody(new_theta_body);
      setErrorCode(error_code);
      setPositionEE(p_right);
      setREE(R_right);
      setEuler(euler_ee);

    } else {
      // --- 重置状态 ---
      if (lastVRPosRef.current) {
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
    VR_Control_Mode
  ]);

  React.useEffect(() => {
    thetaBodyRef.current = theta_body;
    positionEERef.current = position_ee;
    REERef.current = R_ee;
  }, [theta_body, position_ee, R_ee]);

  /*======================= VR Right Left Arm Control ====================================*/
  /* ---------------------- Left VR Controller Motion ------------------------------------*/
  /*** Left Arm Unified Control Loop (Optimized with Quaternion Diff) ***/
  const lastVRPosRef_left = React.useRef(null);
  const lastQuatRef_left = React.useRef(null); // 使用四元数存储姿态锚点

  const thetaBodyLeftRef = React.useRef(theta_body_left);
  const positionEELeftRef = React.useRef(position_ee_left);
  const REELeftRef = React.useRef(R_ee_left);

  React.useEffect(() => {
    // 1. 运行条件检查
    if (!rendered || !vrModeRef.current || showMenu || shareControl) return;
    if (!thetaBodyLeftRef.current || !positionEELeftRef.current || !REELeftRef.current) return;

    if (trigger_on_left) {
      const { position: p_raw, quaternion: q_raw } = controller_object_left;

      // --- 初始帧锚点锁定 ---
      if (!lastVRPosRef_left.current) {
        lastVRPosRef_left.current = [p_raw.x, p_raw.y, p_raw.z];
        lastQuatRef_left.current = q_raw.clone(); // 记录起始四元数
        return; 
      }

      // --- A. 计算位移增量 (Delta Position) ---
      const pos_diff_world = mr.three2world([
        p_raw.x - lastVRPosRef_left.current[0],
        p_raw.y - lastVRPosRef_left.current[1],
        p_raw.z - lastVRPosRef_left.current[2]
      ]);

      // 原地更新位移锚点
      lastVRPosRef_left.current[0] = p_raw.x;
      lastVRPosRef_left.current[1] = p_raw.y;
      lastVRPosRef_left.current[2] = p_raw.z;

      // --- B. 计算旋转增量 (通过四元数差值提取 Axis-Angle) ---
      // 调用之前定义的 getAxisAngleFromQuatDiff
      const { axis, theta } = getAxisAngleFromQuatDiff(q_raw, lastQuatRef_left.current);

      // 更新旋转锚点
      lastQuatRef_left.current.copy(q_raw);

      // --- C. 计算机械臂目标位姿 (Target Pose) ---
      const p_scale = 1.0;
      const R_scale = 1.0;
      const newP = [
        position_ee_left[0] + pos_diff_world[0] * p_scale,
        position_ee_left[1] + pos_diff_world[1] * p_scale,
        position_ee_left[2] + pos_diff_world[2] * p_scale
      ];

      let newT;
      if (VR_Control_Mode === 'inSpace') {
        // 空间坐标系映射 (维持之前的轴映射逻辑)
        const axis_world = [-axis[2], -axis[0], axis[1]];
        const R_rel = ScrewAxisToRMatrixOptimized(axis_world, theta * R_scale);
        newT = mr.RpToTrans(numeric.dot(R_rel, R_ee_left), newP);
      } else {
        // 身体坐标系映射
        // const axis_body = three2world(axis); // 如果需要映射轴到身体坐标系，使用相同的转换
        const R_rel = ScrewAxisToRMatrixOptimized(axis, theta * R_scale);
        newT = mr.RpToTrans(numeric.dot(R_ee_left, R_rel), newP);
      }

      // --- D. 执行 IK 与 限速 ---
      const { new_theta_body, error_code } = IK_joint_velocity(
        newT, 
        M_left, 
        Slist_left, 
        Blist_left, 
        joint_limits_left, 
        theta_body_left, 
        // thetaBodyLeftRef.current,
        VR_Control_Mode,
        dt
      );

      // ✅ 更新 ref（不触发重渲染）
      thetaBodyLeftRef.current = new_theta_body;

      // 计算新的末端位姿
      const T_left = mr.FKinSpace(M_left, Slist_left, new_theta_body);
      const [R_left, p_left] = mr.TransToRp(T_left);
      
      // ✅ 更新 ref
      positionEELeftRef.current = p_left;
      REELeftRef.current = R_left;

      const euler_ee_left = worlr2three(mr.RotMatToEuler(R_left, Euler_order))

      // ✅ 批量更新状态（只触发一次渲染）
      setThetaBodyLeft(new_theta_body);
      setErrorCodeLeft(error_code);
      setPositionEELeft(p_left);
      setREELeft(R_left);
      setEulerEELeft(euler_ee_left);

    } else {
      // --- Trigger 释放时重置 ---
      if (lastVRPosRef_left.current) {
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
    VR_Control_Mode
  ]);

  // ✅ 同步 ref 初始值
  React.useEffect(() => {
    thetaBodyLeftRef.current = theta_body_left;
    positionEELeftRef.current = position_ee_left;
    REELeftRef.current = R_ee_left;
  }, [theta_body_left, position_ee_left, R_ee_left]);


  /* ---------------------- Hand Control ------------------------------------*/
  const [thumb_index_right, setThumbIndexRight] = React.useState(0);
  const [middle_wrist_right, setMiddleWristRight] = React.useState(0);
  const [thumb_index_left, setThumbIndexLeft] = React.useState(0);
  const [middle_wrist_left, setMiddleWristLeft] = React.useState(0);

  const [middle_dot_right, setMiddleDotRight] = React.useState([1]);

  // const initialThetas = [
  //   [0, 0, 0], // thumb
  //   [0, 0],    // index
  //   [0, 0] // middle
  // ];
  // const [theta_tool, setThetaTool] = React.useState(initialThetas);

  // const lastThetaRef = React.useRef(Math.acos(middle_dot_right || 1));
  // const middleThetalistRef = React.useRef([0, 0]);
  // // theta_tool is deg
  // React.useEffect(() => {
  //   if (!rendered || !vrModeRef.current || showMenu || shareControl) return;

  //   const newThumbRight = [thumb_index_right * (30/0.095), thumb_index_right * (17/0.095), thumb_index_right * (42/0.095)];
  //   const newIndexRight = [thumb_index_right * (60/0.1), thumb_index_right * (50/0.095)];
  //   // const newMiddleRight = [middle_wrist_right * (75/0.1), middle_wrist_right * (75/0.1)];
    
  //   const d_current = Math.max(-1, Math.min(1, 
  //     Array.isArray(middle_dot_right) ? middle_dot_right[0] : middle_dot_right
  //   ));
  //   const theta_current = Math.acos(d_current);

  //   const theta_dot = (theta_current - lastThetaRef.current) / dt;
  //   lastThetaRef.current = theta_current;

  //   const L = 0.083; 
  //   const vz = -(theta_dot) * (L * Math.cos(theta_current));
  //   const vx_linked = (theta_dot) * (L * Math.sin(theta_current));

  //   const Vs_target = [0, 0, theta_dot, vx_linked, 0, vz];

  //   const currentThetas = middleThetalistRef.current;

  //   const Js = mr.JacobianSpace(Slist_index, currentThetas);

  //   const q_dot = numeric.dot(mr.matPinv(Js), Vs_target);

  //   const newMiddleThetas = currentThetas.map((theta, i) => {
  //       return theta + q_dot[i] * dt * 3.0;
  //   });

  //   // 先转度数并限位
  //   const newMiddleThetasDeg = mr.rad2deg(newMiddleThetas).map(deg => 
  //     Math.max(0, Math.min(90, deg))
  //   );

  //   // ✅ 关键：更新限位后的弧度值到 Ref
  //   middleThetalistRef.current = newMiddleThetasDeg.map(deg => mr.deg2rad(deg));

  //   setThetaTool([newThumbRight, newIndexRight, newMiddleThetasDeg]);

  // }, [thumb_index_right, middle_wrist_right, middle_dot_right]);

  React.useEffect(() => {
    if (!rendered || !vrModeRef.current || showMenu || shareControl) return;
    const newThumbRight = [thumb_index_right * (30), thumb_index_right * (17), thumb_index_right * (46)];
    const newIndexRight = [thumb_index_right * (62), thumb_index_right * (55)];
    const newMiddleRight = [middle_wrist_right * (75), middle_wrist_right * (75)];
    setThetaTool([newThumbRight, newIndexRight, newMiddleRight]);
  }, [thumb_index_right, middle_wrist_right]);

  React.useEffect(() => {
    if (!rendered || !vrModeRef.current || showMenu || shareControl) return;
    const newThumbLeft = [thumb_index_left * (30), thumb_index_left * (17), thumb_index_left * (46)];
    const newIndexLeft = [thumb_index_left * (62), thumb_index_left * (55)];
    const newMiddleLeft = [middle_wrist_left * (75), middle_wrist_left * (75)];
    setThetaToolLeft([newThumbLeft, newIndexLeft, newMiddleLeft]);
  }, [thumb_index_left, middle_wrist_left]);

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

  /*========================= Collision Check ================================*/
  const thetaHistoryRef = React.useRef([]);
  const thetaLeftHistoryRef = React.useRef([]);

  // React.useEffect(() => {
  //   if (!collision) {
  //     thetaHistoryRef.current.push(theta_body);
  //     thetaLeftHistoryRef.current.push(theta_body_left);

  //     if (thetaHistoryRef.current.length > 5) thetaHistoryRef.current.shift();
  //     if (thetaLeftHistoryRef.current.length > 5) thetaLeftHistoryRef.current.shift();
  //   } else if (collision) {
  //     if (thetaHistoryRef.current.length > 0 && thetaLeftHistoryRef.current.length > 0) {
  //       const last = thetaHistoryRef.current.pop();
  //       const lastLeft = thetaLeftHistoryRef.current.pop();

  //       setThetaBody(last);
  //       setThetaBodyLeft(lastLeft);

  //       console.warn("🔁 Return to last valid theta due to collision");
  //     }
  //   }
  // }, [collision, theta_body, theta_body_left]);

  /* ======================== CAM Arm Control ================================*/
  React.useEffect(() => {
    if (rendered && vrModeRef.current && !showMenu) {
      const euler_sensitivity = 0.025
      const position_sensitivity = 0.002

      theta_body_cam[1] += -thumbstick_right[0] * euler_sensitivity
      theta_body_cam[2] += -thumbstick_right[1] * euler_sensitivity
      setThetaBodyCam(theta_body_cam);

      // theta_body[0] = theta_body_cam[0]; 
      // theta_body[2] = theta_body[2] + thumbstick_right[1] * euler_sensitivity
      // setThetaBody(theta_body);

      // theta_body_left[0] = theta_body_cam[0]
      // theta_body_left[2] = theta_body_left[2] + thumbstick_left[1] * euler_sensitivity
      // setThetaBodyLeft(theta_body_left);

    }

  }, [rendered, vrModeRef.current, thumbstick_left, thumbstick_right]);


  /* ========================= Web Interface =========================*/
  // 1. 增加一个用于存储 UI 快照的 Ref
  const lastInterfacePropsRef = React.useRef(null);

  const interfacePropos = React.useMemo(() => {
    // --- 阻隔逻辑 ---
    // 如果当前在 VR 模式，且我们已经存过一份快照，则直接返回快照
    if (vrModeRef.current && lastInterfacePropsRef.current) {
      return lastInterfacePropsRef.current;
    }

    // --- 原始对象构造 ---
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
    };

    // 更新快照，以便下次进入 VR 时使用
    lastInterfacePropsRef.current = currentProps;
    
    return currentProps;

    // 注意：虽然逻辑上阻隔了，但 React 要求依赖项必须完整
  }, [
    robotName, robotNameList, set_robotName,
    view_cam_pose, setViewCamPose,
    // vrModeRef.current 不需要放这里，因为 Ref 改变不触发 memo
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
    // 必须添加一个触发开关，比如进入 VR 瞬间产生的 State 变化
    rendered 
  ]);

  /* =============== VRController Inputs (Aframe Components) =================*/
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
      setMiddleWristRight,
      setMiddleDotRight,

      // Left Hand
      setThumbIndexLeft,
      setMiddleWristLeft,

      //Collision Check
      // collision,
      setCollision,

      // VR Camera Pose
      setViewCamPose,
      vrModeRef,
      props,
      onXRFrameMQTT,
      
      // Menu
      setShowMenu,
      setLeftArmMode,
      setControlMode,
      setIndicator,
      setShareControl,
      setWholeBodyControl,
    });
  }, []);

  /* ============================== MQTT ==========================================*/

  // const thetaBodyMQTT = React.useRef(theta_body);
  // React.useEffect(() => {
  //   thetaBodyMQTT.current = theta_body;
  // }, [theta_body]);

  // const thetaToolMQTT = React.useRef(theta_tool);
  // React.useEffect(() => {
  //   thetaToolMQTT.current = theta_tool;
  // }, [theta_tool]);

  // const thetaBodyLeftMQTT = React.useRef(theta_body_left);
  // React.useEffect(() => {
  //   thetaBodyLeftMQTT.current = theta_body_left;
  // }, [theta_body_left]);

  // const thetaToolLeftMQTT = React.useRef(theta_tool_left);
  // React.useEffect(() => {
  //   thetaToolLeftMQTT.current = theta_tool_left;
  // }, [theta_tool_left]);

  // const thetaBodyCamMQTT = React.useRef(theta_body_cam);
  // React.useEffect(() => {
  //   thetaBodyCamMQTT.current = theta_body_cam.map(val => Number(val.toFixed(2)));
  // }, [theta_body_cam]);

  
  /* ---------------------- Robot Control MQTT message ------------------------------------*/

  /* Animation Frame for MQTT Publish */
  // React.useEffect(() => {
  //   window.requestAnimationFrame(onAnimationMQTT);
  // }, []);
  // const onAnimationMQTT = (time) =>{
  //   const robot_state_json = JSON.stringify({
  //     time: time,
  //     joint: thetaBodyMQTT.current,
  //     tool: thetaToolMQTT.current,
  //     joint_left: thetaBodyLeftMQTT.current,
  //     tool_left: thetaToolLeftMQTT.current,
  //     cam: thetaBodyCamMQTT.current
  //   });
  //   // publishMQTT(MQTT_ROBOT_STATE_TOPIC + robotIDRef.current , robot_state_json); 
  //   // console.log("onAnimationMQTT published:", robot_state_json);
  //   window.requestAnimationFrame(onAnimationMQTT); 
  // }

  /* VR Frame for MQTT Publish */
  const receiveStateRef = React.useRef(true); // VR MQTT switch

  // // Publish control JSON messages (entire)
  // React.useEffect(() => {
  //     const ctl_json = JSON.stringify({
  //       timestamp: Date.now(),
  //       joint: thetaBodyMQTT.current,
  //       tool: thetaToolMQTT.current,
  //       joint_left: thetaBodyLeftMQTT.current,
  //       tool_left: thetaToolLeftMQTT.current,
  //       cam: thetaBodyCamMQTT.current
  //     });
  //     if ((mqttclient != null) && receiveStateRef.current && !shareControl && !showMenu) {
  //       publishMQTT(MQTT_CTRL_TOPIC + robotIDRef.current, ctl_json);
  //       // console.log("onXRFrameMQTT published:", MQTT_CTRL_TOPIC + robotIDRef.current, ctl_json);
  //     }
  // }, [
  //   thetaBodyMQTT.current, 
  //   thetaToolMQTT.current, 
  //   thetaBodyLeftMQTT.current, 
  //   thetaToolLeftMQTT.current, 
  //   thetaBodyCamMQTT.current
  // ]);

  // Publish control JSON messages (individual)
  // React.useEffect(() => {
  //   const json_msg = JSON.stringify({
  //     timestamp: Date.now(),
  //     joint: thetaBodyMQTT.current,
  //   });
  //   if ((mqttclient != null) && receiveStateRef.current && rendered && !showMenu && !shareControl) {
  //     publishMQTT(MQTT_CTRL_TOPIC + 'right/' + 'joint/' + robotIDRef.current, json_msg);
  //   }
  // }, [thetaBodyMQTT.current]);

  // React.useEffect(() => {
  //   const json_msg = JSON.stringify({
  //     timestamp: Date.now(),
  //     tool: thetaToolMQTT.current,
  //   });
  //   if ((mqttclient != null) && receiveStateRef.current && rendered && !showMenu) {
  //     publishMQTT(MQTT_CTRL_TOPIC + 'right/' + 'tool/' + robotIDRef.current, json_msg);
  //   }
  // }, [thetaToolMQTT.current, robot_state]);

  // React.useEffect(() => {
  //   const json_msg = JSON.stringify({
  //     timestamp: Date.now(),
  //     joint: thetaBodyLeftMQTT.current,
  //   });
  //   if ((mqttclient != null) && receiveStateRef.current && rendered && !showMenu) {
  //     publishMQTT(MQTT_CTRL_TOPIC + 'left/' + 'joint/' + robotIDRef.current, json_msg);
  //   }
  // }, [thetaBodyLeftMQTT.current]);

  // React.useEffect(() => {
  //   const json_msg = JSON.stringify({
  //     timestamp: Date.now(),
  //     tool: thetaToolLeftMQTT.current,
  //   });
  //   if ((mqttclient != null) && receiveStateRef.current && rendered && !showMenu) {
  //     publishMQTT(MQTT_CTRL_TOPIC + 'left/' + 'tool/' + robotIDRef.current, json_msg);
  //   }
  // }, [thetaToolLeftMQTT.current, robot_state_left]);

  // React.useEffect(() => {
  //   const json_msg = JSON.stringify({
  //     timestamp: Date.now(),
  //     joint: thetaBodyCamMQTT.current,
  //   });
  //   if ((mqttclient != null) && receiveStateRef.current && rendered && !showMenu) {
  //     publishMQTT(MQTT_CTRL_TOPIC + 'cam/' + 'joint/' + robotIDRef.current, json_msg);
  //   }
  // }, [thetaBodyCamMQTT.current]);

  // /* ---------------------- Visual Assistance MQTT message ------------------------------------*/
  // React.useEffect(() => {
  //     let share_control_flag;
  //     if (shareControl) {
  //       share_control_flag = 1;
  //     } else {
  //       share_control_flag = 0;
  //     }

  //     let share_control_signal;
  //     if (thumbstick_right[1] < -0.35) {
  //       share_control_signal = 1;
  //     } else if (thumbstick_right[1] > 0.7) {
  //       share_control_signal = -1;
  //     } else {
  //       share_control_signal = 0;
  //     }

  //     if ((mqttclient != null) && receiveStateRef.current) {
  //       publishMQTT(MQTT_SHARE_TOPIC + robotIDRef.current, JSON.stringify({
  //         flag: share_control_flag,
  //         share: share_control_signal,
  //       }));
  //       console.log("Shared Control Published:", share_control_signal);
  //     }

  // }, [thumbstick_right, shareControl]);

  // Robot Request MQTT
  const requestRobot = (mqclient) => {
    const requestInfo = {
      devId: idtopic,
      type: codeType,
    }
    publishMQTT(MQTT_REQUEST_TOPIC, JSON.stringify(requestInfo));
  }

  /* ---------------------- Feedback Update ------------------------------------*/
  // Update theta_body when robot_state is "initialize"
  const [theta_body_feedback, setThetaBodyFeedback] = React.useState([]);
  React.useEffect(() => {
    if (robot_state === "initialize") {
      setThetaBody(theta_body_feedback)
    }
  }, [robot_state, theta_body_feedback]);

  // const [theta_body_left_feedback, setThetaBodyLeftFeedback] = React.useState([0, 0, 0, 0, 0, 0]);
  // React.useEffect(() => {
  //   if (robot_state_left === "initialize") {
  //     setThetaBodyLeft(theta_body_left_feedback)
  //   }
  // }, [robot_state_left]);

  const [theta_body_cam_feedback, setThetaBodyCamFeedback] = React.useState([]);
  React.useEffect(() => {
    if (robot_state_cam === "initialize") {
      setThetaBodyCam(theta_body_cam_feedback)
    }
  }, [robot_state_cam]);
  
  /* ---------------------- Option MQTT message -------------------------------*/
  // Send VR Controller Pose Message for Robot Control
  // React.useEffect(() => {
  //   const json_msg = JSON.stringify({
  //     timestamp: Date.now(),
  //     p_diff: vr_controller_p_diff,
  //     R_relative: vr_controller_R_relative,
  //   });
  //   if ((mqttclient != null) && receiveStateRef.current && rendered && !showMenu) {
  //     publishMQTT(MQTT_VR_TOPIC + 'right/' + robotIDRef.current, json_msg);
  //   }
  // }, [vr_controller_p_diff, vr_controller_R_relative]);

  MQTT_Sub({
    // MQTT Client and Topics
    props,
    requestRobot,
    robotIDRef,
    MQTT_DEVICE_TOPIC, 
    MQTT_CTRL_TOPIC, 
    MQTT_ROBOT_STATE_TOPIC,

    // Right Arm
    thetaBodyMQTT: setThetaBody,
    thetaToolMQTT: setThetaTool,
    thetaBodyFeedback: setThetaBodyFeedback,
    robot_state: setRobotState,

    // Left Arm
    thetaBodyLeftMQTT: setThetaBodyLeft,
    thetaToolLeftMQTT: setThetaToolLeft,
    // thetaBodyLeftFeedback: setThetaBodyLeftFeedback,
    robot_state_left: setRobotStateLeft,

    // Cam Arm
    thetaBodyCamMQTT: setThetaBodyCam,
    thetaBodyCamFeedback: setThetaBodyCamFeedback,
    robot_state_cam: setRobotStateCam

  });


  /* ============================== WebRTC ==========================================*/
  
  // Get stream from media devices (For testing purpose)
  // React.useEffect(() => {
  //   navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  //     .then(stream => {
  //       setVrLeftStream(stream);
  //       setVrRightStream(stream); 
  //     });
  // }, []);

  /* ------------------------ Get Stream from WebXR ------------------------*/
  // React.useEffect(() => {
  //   if (!vrModeRef.current && !rendered) {
  //     console.warn('⚠️ Not in VR mode');
  //     return;
  //   }

  //   const scene = document.querySelector('a-scene');
  //   if (!scene) {
  //     console.warn('⚠️ a-scene not found');
  //     return;
  //   }

  //   const getCanvasStream = () => {
  //     const sceneEl = document.querySelector('a-scene');
  //     const canvas = sceneEl.renderer.domElement;
  //     const stream = canvas.captureStream(30);  // 30 FPS
  //     return stream;
  //   };

  //   // Listen VR enter event
  //   const handleEnterVR = async () => {
  //     console.log('🥽 Entering VR, capturing streams...');
  //     const stream = getCanvasStream();
  //     setVrLeftStream(stream);
  //     setVrRightStream(stream);
  //   };

  //   const handleExitVR = () => {
  //     console.log('🚪 Exiting VR, stopping streams...');
      
  //     // Stop all tracks
  //     if (vrLeftStream) {
  //       vrLeftStream.getTracks().forEach(track => track.stop());
  //       setVrLeftStream(null);
  //     }
  //     if (vrRightStream) {
  //       vrRightStream.getTracks().forEach(track => track.stop());
  //       setVrRightStream(null);
  //     }
  //   };

  //   scene.addEventListener('enter-vr', handleEnterVR);
  //   scene.addEventListener('exit-vr', handleExitVR);

  //   return () => {
  //     scene.removeEventListener('enter-vr', handleEnterVR);
  //     scene.removeEventListener('exit-vr', handleExitVR);
  //   };
  // }, [vrModeRef.current, rendered]);

  // React.useEffect(() => {
  //   if (!vrLeftStream && !vrRightStream) return;

  //   if (!shareControl && !showMenu) {
  //     const payload = {
  //       timestamp: Date.now(),
  //       joint: thetaBodyMQTT.current,
  //       tool: thetaToolMQTT.current,
  //       joint_left: thetaBodyLeftMQTT.current,
  //       tool_left: thetaToolLeftMQTT.current,
  //     };
  //     setControlData(payload);
  //   }

  //   // const interval = setInterval(() => {
  //   //   const payload = {
  //   //     timestamp: Date.now(),
  //   //     joint: thetaBodyMQTT.current,
  //   //     tool: thetaToolMQTT.current,
  //   //     joint_left: thetaBodyLeftMQTT.current,
  //   //     tool_left: thetaToolLeftMQTT.current,
  //   //   };
  //   //   setControlData(payload);
  //   // }, 45); // 25Hz

  //   // return () => clearInterval(interval);
  // }, [
  //   // vrLeftStream, 
  //   // vrRightStream,
  //   thetaBodyMQTT.current,
  //   thetaToolMQTT.current,
  //   thetaBodyLeftMQTT.current,
  //   thetaToolLeftMQTT.current
  // ]);


  /* ============================= Robot State Update ==========================================*/
  // Robot State Update Props
  const robotProps = React.useMemo(() => ({
    robotNameList, robotName, theta_body, theta_tool, theta_body_left, theta_tool_left, theta_body_cam
  }), [robotNameList, robotName, theta_body, theta_tool, theta_body_left, theta_tool_left, theta_body_cam]);

  // // VR Frame Update
  // const [frameCount, tick] = React.useReducer(x => x + 1, 0);

  // const lastRenderTimeRef = React.useRef(performance.now());
  // const FRAME_MIN_TIME = 1000/25; // 目标 60Hz

  // // 使用 useCallback 确保函数引用稳定，防止在渲染中反复重建
  // const onXRFrameMQTT = React.useCallback((time, frame) => {
  //   if (vrModeRef.current) {
  //     // 1. 始终优先请求下一帧，确保循环的连续性
  //     frame.session.requestAnimationFrame(onXRFrameMQTT);

  //     const currentTime = performance.now();
  //     const deltaTime = currentTime - lastRenderTimeRef.current;

  //     // 2. 帧率节流判断
  //     if (deltaTime >= FRAME_MIN_TIME) {
  //       // 这里的补偿算法可以抵消 requestAnimationFrame 的时间漂移
  //       lastRenderTimeRef.current = currentTime - (deltaTime % FRAME_MIN_TIME);
        
  //       // 3. 触发 React 更新：使用 useReducer 的 tick 代替 performance.now()
  //       // 这样 React 只需要处理一个简单的整数自增，而不是复杂的浮点数
  //       tick(); 
  //     }
  //   }
  // }, []); // 依赖项为空，确保该函数永远不会改变

  // ✅ 保留 tick，但降低频率
const [frameCount, tick] = React.useReducer(x => x + 1, 0);

const lastRenderTimeRef = React.useRef(performance.now());
const lastUIUpdateTimeRef = React.useRef(performance.now());
const lastMQTTPublishTimeRef = React.useRef(performance.now());

const FRAME_MIN_TIME = 1000 / 50; // XR 循环 90Hz
const UI_UPDATE_INTERVAL = 1000 / 50; // UI 更新 20Hz (降低 React 渲染频率)
const MQTT_PUBLISH_INTERVAL = 1000 / 30; // MQTT 发布 25Hz

// ✅ 优化后的 XR 帧回调
const onXRFrameMQTT = React.useCallback((time, frame) => {
  if (!vrModeRef.current) return;

  // 1. 请求下一帧
  frame.session.requestAnimationFrame(onXRFrameMQTT);

  const currentTime = performance.now();
  const deltaTime = currentTime - lastRenderTimeRef.current;

  if (deltaTime < FRAME_MIN_TIME) return;
  lastRenderTimeRef.current = currentTime - (deltaTime % FRAME_MIN_TIME);

  // 2. ✅ MQTT 发布（25Hz）
  const mqttDeltaTime = currentTime - lastMQTTPublishTimeRef.current;
  if (mqttDeltaTime >= MQTT_PUBLISH_INTERVAL) {
    lastMQTTPublishTimeRef.current = currentTime;

    if (mqttclient != null && receiveStateRef.current && !showMenu && !shareControl) {
      const timestamp = Date.now();
      
      publishMQTT(
        MQTT_CTRL_TOPIC + 'right/joint/' + robotIDRef.current,
        JSON.stringify({ timestamp, joint: thetaBodyRef.current })
      );

      // publishMQTT(
      //   MQTT_CTRL_TOPIC + 'right/tool/' + robotIDRef.current,
      //   JSON.stringify({ timestamp, tool: thetaToolMQTT.current })
      // );

      publishMQTT(
        MQTT_CTRL_TOPIC + 'left/joint/' + robotIDRef.current,
        JSON.stringify({ timestamp, joint: thetaBodyLeftRef.current })
      );

      // publishMQTT(
      //   MQTT_CTRL_TOPIC + 'left/tool/' + robotIDRef.current,
      //   JSON.stringify({ timestamp, tool: thetaToolLeftMQTT.current })
      // );

      // publishMQTT(
      //   MQTT_CTRL_TOPIC + 'cam/joint/' + robotIDRef.current,
      //   JSON.stringify({ timestamp, joint: thetaBodyCamMQTT.current })
      // );
    }
  }

  // 3. ✅ UI 更新（20Hz，降低 React 渲染压力）
  const uiDeltaTime = currentTime - lastUIUpdateTimeRef.current;
  if (uiDeltaTime >= UI_UPDATE_INTERVAL) {
    lastUIUpdateTimeRef.current = currentTime;
    tick(); // 只在这里调用，频率降低到 20Hz
  }

}, []); // 空依赖，确保函数稳定

  // Robot Secene Render
  return (
    <>
      {/* <WebRTC_Video_Recv 
        onVideoStream1={setWebcamStream1}
        onVideoStream2={setWebcamStream2}
        onVideoStream3={setWebcamStream3} /> */}

      {/* <WebRTC_Video_Send 
        VR_Left_Stream={vrLeftStream}
        VR_Right_Stream={vrRightStream}
      /> */}

      {/* <WebRTC_Video_Send_Data
        VR_Left_Stream={vrLeftStream}
        VR_Right_Stream={vrRightStream}
        controlData={controlData}
        recvData={DataRecv}
      />

      <WebRTC_Data_Recv
        channelId="sora_liust_vr_left"
        onControlData={setDataRecv}
      /> */}

      <RobotScene
        robot_list={robot_list}
        rendered={rendered}

        robotProps={robotProps}
        interfacePropos={interfacePropos}
        dsp_message={dsp_message}
        view_cam_pose={view_cam_pose}
        viewer={props.viewer}
        monitor={props.monitor}

        // Right Arm
        state_codes={error_code}
        position_ee={worlr2three(position_ee)}
        euler_ee={euler_ee}
        rightArmPosition={rightArmPosition}
        joint_limits_right={joint_limits_right}

        // Left Arm
        state_codes_left={error_code_left}
        position_ee_left={worlr2three(position_ee_left)}
        euler_ee_left={euler_ee_left}
        leftArmPosition={leftArmPosition}
        joint_limits_left={joint_limits_left}

        // CAM Arm
        // state_codes_cam={error_code_cam}
        // position_ee_cam={eeShowData.camPos}
        // euler_ee_cam={eeShowData.camEuler}

        indicator={indicator}
        webcamStream1={webcamStream1}
        webcamStream2={webcamStream2}
        webcamStream3={webcamStream3}
        showMenu={showMenu}
      />
    </>
  );
}
