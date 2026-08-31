import React from 'react';
import { Select_Robot } from '../Model';

/* ============================= Static Global Variables ==========================================*/
const mr = require('../../modern_robotics/modern_robotics_core');

export default function RobotSceneView(props) {
  const {
    robotProps, 
    // Right Arm
    state_codes, position_ee, euler_ee, rightArmPosition, joint_limits_right,
    // Left Arm
    state_codes_left, position_ee_left, euler_ee_left, leftArmPosition, joint_limits_left,
    // Cam Arm
    state_codes_cam, position_ee_cam, euler_ee_cam,
    // Others
    showModel,

    vrcam_position, vrcam_rotation
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

  const euler_ee_deg = euler_ee.map(mr.rad2deg);
  const euler_ee_deg_left = euler_ee_left.map(mr.rad2deg);
  const euler_ee_deg_cam = euler_ee_cam.map(mr.rad2deg);

  return (
    <>
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
    </>
  );
}