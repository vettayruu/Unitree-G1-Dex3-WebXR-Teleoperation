import 'aframe'

import * as React from 'react'

/* ============================= Static Global Variables ==========================================*/

const mr = require('../../modern_robotics/modern_robotics_core.js');

/* ============================= Main Component ==========================================*/
export default function useRobotParamsInitialization(props) {
  const {
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
  } = props

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
    const leftParams = mr.loadRobotParams(robot_model_left);
    const rightParams = mr.loadRobotParams(robot_model_right);
    const camParams = mr.loadRobotParams(robot_model_cam);
    const handIndexMiddleParams = mr.loadRobotParams(hand_index_middle);
    setRobotParams((prev) => ({
      ...prev,
      left: leftParams,
      right: rightParams,
      cam: camParams,
      hand_index_middle: handIndexMiddleParams,
    }));
  }, [robot_model_left, robot_model_right, robot_model_cam, hand_index_middle]);

  // Right Arm
  const Slist_right_FK = React.useRef([Slist_right]); 

  // Left Arm
  const Slist_left_FK = React.useRef([Slist_left]); 

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

  /* ---------------------- Right Arm Initialize ------------------------------------*/
  const [rightArmInitialized, setRightArmInitialized] = React.useState(false);

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
}
