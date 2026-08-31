import React from 'react';
import Assets from './Assets';
import WebInterface from './web_interface.js';
import TaskPanel from './scene/TaskPanel.js';
import VideoView from './scene/VideoView.js';
import HandControllerLayout from './scene/HandControllerLayout'
import RobotSceneView from './scene/RobotSceneView'

export default function RobotScene(props) {
  const {
    indicator,
    robot_assets, 
    robotProps, 
    
    // VR
    rendered, 
    interfacePropos, 

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

  } = props;

  const [vrcam_position, setVrcamPosition] = React.useState('0 0 0');
  const [vrcam_rotation, setVrcamRotation] = React.useState('0 0 0');

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

        <RobotSceneView robotProps={robotProps} state_codes={state_codes} position_ee={position_ee}
          euler_ee={euler_ee} rightArmPosition={rightArmPosition} joint_limits_right={joint_limits_right}
          state_codes_left={state_codes_left} position_ee_left={position_ee_left} euler_ee_left={euler_ee_left}
          leftArmPosition={leftArmPosition} joint_limits_left={joint_limits_left} state_codes_cam={state_codes_cam}
          position_ee_cam={position_ee_cam} euler_ee_cam={euler_ee_cam} showModel={showModel}
          vrcam_position={vrcam_position} vrcam_rotation={vrcam_rotation} indicator={indicator}/>

        <TaskPanel {...props}/>
 
        <HandControllerLayout showMenu={showMenu} />

        <VideoView showVideo={showVideo}
          setVrcamPosition={setVrcamPosition} setVrcamRotation={setVrcamRotation} />

        </a-scene>

      <WebInterface {...interfacePropos}/>

    </>
  );
}