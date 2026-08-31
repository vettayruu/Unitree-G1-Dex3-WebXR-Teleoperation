import 'aframe'

import * as React from 'react'
import numeric, { t } from 'numeric';

import { publishMQTT } from '../../lib/MetaworkMQTT'
import { IK_joint_velocity_limit } from '../../modern_robotics/spatialKinematics.js';
import { getAxisAngleFromQuatDiff, ScrewAxisToRMatrix } from '../../lib/mathFunction.js';

/* ============================= Static Global Variables ==========================================*/

const mr = require('../../modern_robotics/modern_robotics_core.js');

/* ============================= Main Component ==========================================*/
export default function useVRControllers(props) {
  const {
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
  } = props

  /* ======================== Waist Control (use hmd)) ================================*/
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
      const euler_ee_cam = mr.worlr2three(mr.RotMatToEuler(R_waist, Euler_order))

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

  const REERef = React.useRef(R_ee);

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
      const pos_diff_world = mr.three2world([
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
      const euler_ee = mr.worlr2three(mr.RotMatToEuler(R_right, Euler_order))

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
      const euler_ee = mr.worlr2three(mr.RotMatToEuler(R_right, Euler_order))
      setPositionEE(p_right);
      setREE(R_right);
      setEuler(euler_ee);
    }
  }, [theta_body, dtheta_body, position_ee, R_ee, theta_body_cam]);

  /*======================= VR Left Arm Control ====================================*/
  const lastVRPosRef_left = React.useRef(null);
  const lastQuatRef_left = React.useRef(null);

  const REELeftRef = React.useRef(R_ee_left);

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
      const pos_diff_world = mr.three2world([
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
      const euler_ee_left = mr.worlr2three(mr.RotMatToEuler(R_left, Euler_order))

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
      const euler_ee_left = mr.worlr2three(mr.RotMatToEuler(R_left, Euler_order))
      setPositionEELeft(p_left);
      setREELeft(R_left);
      setEulerEELeft(euler_ee_left);
    } 
  }, [theta_body_left, dtheta_body_left, position_ee_left, R_ee_left, theta_body_cam]);

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
      const euler_ee_left = mr.worlr2three(mr.RotMatToEuler(R_left, Euler_order))
      setPositionEELeft(p_left);
      setREELeft(R_left);
      setEulerEELeft(euler_ee_left);

      thetaBodyRef.current = [0, ...theta_body.slice(1)];
      const T_right = mr.FKinSpace(M_right, Slist_right, thetaBodyRef.current);
      const [R_right, p_right] = mr.TransToRp(T_right);
      positionEERef.current = p_right;
      REERef.current = R_right;
      const euler_ee = mr.worlr2three(mr.RotMatToEuler(R_right, Euler_order))
      setPositionEE(p_right);
      setREE(R_right);
      setEuler(euler_ee);

    }
  }, [wholeBodyControl, trigger_on, trigger_on_left, showMenu]);


  /* ---------------------- Hand Control ------------------------------------*/
  // Figer Points Distance
  const [handGestureModeRight, setHandGestureModeRight] = React.useState('free'); // 'free', 'thumb-index', 'thumb-middle', 'all'

  const [handGestureModeLeft, setHandGestureModeLeft] = React.useState('free'); // 'free', 'thumb-index', 'thumb-middle', 'all'

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

  // const pinchThreshold = 0.78; 
  const releaseThreshold = 0.75; 

  React.useLayoutEffect(() => {
    if (!rendered || !vrModeRef.current || showMenu || shareControl) return;

    let newThumbRight = [0, 0, 0];
    let newMiddleRight = [0, 0];
    let newIndexRight = [0, 0];

    if (handGestureModeRight === 'free') {
        const isScan = thumb_index_inter_right > 0.6;

        if (isScan && thumb_index_inter_right > thumb_index_right) {
            setHandGestureModeRight('scan');
        } else {
            setHandGestureModeRight('free');
        }
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
}
