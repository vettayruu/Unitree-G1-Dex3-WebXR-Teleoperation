import React from 'react';
import Assets from './Assets';
import { Select_Robot } from './Model';
import WebInterface from './web_interface.js';

export default function RobotScene(props) {
  const {
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
    btp_action,

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

        <a-entity position={vrcam_position} rotation={vrcam_rotation}>
              {showModel && (
                <Select_Robot 
                  {...robotProps} 
                  // modelOpacity={props.modelOpacity}
                  position_left={leftArmPosition}
                  position_right={rightArmPosition}
                  joint_limits_right={joint_limits_right}
                  joint_limits_left={joint_limits_left}
                  indicator_visibility={props.indicator}
                />
              )}

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
              position="-0.5 -0.20 -1.2" 
              rotation="-10 30 -12" 
              scale="0.6 0.6 0.6"
              highlight 
              button-action
            >
              <a-plane
                width="1.0"
                height="0.6"
                color="#111"
                opacity="0.5" 
                position="0 0 0"
              ></a-plane>

              <a-text 
                value="Data from EWM" 
                align="center" 
                color="#4CC3D9" 
                width="1.8" 
                position="0 0.22 0.01" 
                font ={font_path}
              ></a-text>

              {[
                { name: "Warehouse", value: btp_action.EWMWarehouse || "---", status: "ok" },
                { name: "Order", value: btp_action.WarehouseOrder || "---", status: "ok" },
                { name: "Product", value: btp_action.Product || "---", status: "ok" },
                { name: "Destination", value: btp_action.DestinationStorageBin || "---", status: "ok" },
              ].map((item, index) => (
                <a-entity key={item.name} position={`0 ${0.08 - index * 0.1} 0.01`}>
                  
                  <a-plane 
                    width="0.95" 
                    height="0.09" 
                    color={index % 2 === 0 ? "#333" : "#222"} 
                    opacity="0.3" 
                  ></a-plane>

                  <a-text value={item.name} position="-0.42 0 0.01" width="1.2" font="/fonts/Roboto-msdf.json"></a-text>

                  <a-text 
                    value={item.value} 
                    position="0.05 0 0.01" 
                    width="1.2" 
                    color={item.status === 'warn' ? "#FFCC00" : "#00FF00"}
                    font="/fonts/Roboto-msdf.json"
                  ></a-text>
                </a-entity>
              ))}
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
          <a-entity id="setting" position="1.0 0.8 -1.2" rotation="0 -37 0" highlight button-action>
            {/* Background Plane */}
            <a-plane
              width="1.2"
              height="1.35"
              color="#222"
              opacity="1.0"
              position="0 0.05 0"
              // class="raycastable"
            ></a-plane><a-text value="Robot Settings" align="center" color="#fff" width="2.0" position="0 0.60 0.01" font="/fonts/Roboto-msdf.json"></a-text>
            {/* Button 1 */}
            <a-entity id="button1" position="-0.3 0.4 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.18`}
              material="color: white; opacity: 0.95"
            ><a-text value="HMD Control \n Off" align="center" color="#fff" width="1.0" position="0 0 0.01" font="/fonts/Roboto-msdf.json"></a-text></a-entity>
            
            {/* Button 2 */}
            <a-entity id="button2" position="0.3 0.4 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.18`}
              material="color: white; opacity: 0.95"
            ><a-text value="HMD Control \n On" align="center" color="#fff" width="1.0" position="0 0 0.01" font="/fonts/Roboto-msdf.json"></a-text></a-entity>
            
            {/* Button 3 */}
            <a-entity id="button3" position="-0.3 0.2 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.18`}
              material="color: white; opacity: 0.95"
            ><a-text value="Show Video \n Off" align="center" color="#fff" width="1.0" position="0 0 0.01" font="/fonts/Roboto-msdf.json"></a-text></a-entity>

            {/* Button 4 */}
            <a-entity id="button4" position="0.3 0.2 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.18`}
              material="color: white; opacity: 0.95"
            ><a-text value="Show Video \n On" align="center" color="#fff" width="1.0" position="0 0 0.01" font="/fonts/Roboto-msdf.json"></a-text></a-entity>

            {/* Button 5 */}
            <a-entity id="button5" position="-0.3 0.0 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.18`}
              material="color: white; opacity: 0.95"
            ><a-text value="Indicator \n On" align="center" color="#fff" width="1.0" position="0 0 0.01" font="/fonts/Roboto-msdf.json"></a-text></a-entity>

            {/* Button 6 */}
            <a-entity id="button6" position="0.3 0.0 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.18`}
              material="color: white; opacity: 0.95"
            ><a-text value="Indicator \n Off" align="center" color="#fff" width="1.0" position="0 0 0.01" font="/fonts/Roboto-msdf.json"></a-text></a-entity>

            {/* Button 7 */}
            <a-entity id="button7" position="-0.3 -0.2 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.18`}
              material="color: white; opacity: 0.95"
            ><a-text value="Visual Assist \n On" align="center" color="#fff" width="1.0" position="0 0 0.01" font="/fonts/Roboto-msdf.json"></a-text></a-entity>

            {/* Button 8 */}
            <a-entity id="button8" position="0.3 -0.2 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.18`}
              material="color: white; opacity: 0.95"
            ><a-text value="Visual Assist \n Off" align="center" color="#fff" width="1.0" position="0 0 0.01" font="/fonts/Roboto-msdf.json"></a-text></a-entity>

            {/* Button 9 */}
            <a-entity id="button9" position="-0.3 -0.4 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.18`}
              material="color: white; opacity: 0.95"
            ><a-text value="Whole Body Control \n On" align="center" color="#fff" width="1.0" position="0 0 0.01" font="/fonts/Roboto-msdf.json"></a-text></a-entity>

            {/* Button 10 */}
            <a-entity id="button10" position="0.3 -0.4 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.18`}
              material="color: white; opacity: 0.95"
            ><a-text value="Whole Body Control \n Off" align="center" color="#fff" width="1.0" position="0 0 0.01" font="/fonts/Roboto-msdf.json"></a-text></a-entity>

          </a-entity>
        )}

        {showMenu && (
          <a-entity id="task" position="-1.0 0.8 -1.2" rotation="0 37 0" highlight button-action>
            {/* Background Plane */}
            <a-plane
              width="1.5"
              height="2.2"
              color="#222"
              opacity="1.0"
              position="0 -0.35 0"
              // class="raycastable"
            ></a-plane>
            <a-text value="SAP EWM Order" align="center" color="#fff" width="2.0" position="0 0.60 0.01" font="/fonts/Roboto-msdf.json"></a-text>

            {/* Putaway Status Signal */}
            <a-text value="Putaway Status Signal" align="right" color="#fff" width="1.25" position="-0.12 0.48 0.01" font="/fonts/Roboto-msdf.json"></a-text>
            
            <a-entity id="signal_1" position="-0.46 0.35 0.01" 
              geometry={`primitive: plane; width: ${botton_width}; height: 0.12`}
              material="color: orange; opacity: 0.95"
            ><a-text value="Awaiting" align="center" color="#fff" width="1.0" position="0 0 0.01" font="/fonts/Roboto-msdf.json"></a-text></a-entity>
            
            <a-entity id="signal_2" position="0.010 0.35 0.01" 
              geometry={`primitive: plane; width: ${botton_width}; height: 0.12`}
              material="color: blue; opacity: 0.95"
            ><a-text value="Processing" align="center" color="#fff" width="1.0" position="0 0 0.01" font="/fonts/Roboto-msdf.json"></a-text></a-entity>
            
            <a-entity id="signal_3" position="0.480 0.35 0.01" 
              geometry={`primitive: plane; width: ${botton_width}; height: 0.12`}
              material="color: green; opacity: 0.95"
            ><a-text value="Completed" align="center" color="#fff" width="1.0" position="0 0 0.01" font="/fonts/Roboto-msdf.json"></a-text></a-entity>

            {/* Putaway Button */}
            <a-text value="Putaway Button" align="right" color="#fff" width="1.25" position="-0.28 0.22 0.01" font="/fonts/Roboto-msdf.json"></a-text>
            
            <a-entity id="btp_start" position="-0.46 0.10 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.15`}
              material="color: white; opacity: 0.95"
            ><a-text value="Start" align="center" color="#fff" width="1.0" position="0 0 0.01" font="/fonts/Roboto-msdf.json"></a-text></a-entity>

            <a-entity id="btp_confirm" position="0.010 0.10 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.15`}
              material="color: white; opacity: 0.95"
            ><a-text value="WT Confirm" align="center" color="#fff" width="1.0" position="0 0 0.01" font="/fonts/Roboto-msdf.json"></a-text></a-entity>

            <a-entity id="btp_continue" position="0.480 0.10 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.15`}
              material="color: white; opacity: 0.95"
            ><a-text value="Continue" align="center" color="#fff" width="1.0" position="0 0 0.01" font="/fonts/Roboto-msdf.json"></a-text></a-entity>

            <a-entity id="btp_complete" position="0.010 -0.10 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: ${botton_width}; height: 0.15`}
              material="color: white; opacity: 0.95"
            ><a-text value="Complete" align="center" color="#fff" width="1.0" position="0 0 0.01" font="/fonts/Roboto-msdf.json"></a-text></a-entity>

            {/* Message */}
            <a-text value="Message" align="right" color="#fff" width="1.25" position="-0.44 -0.25 0.01" font="/fonts/Roboto-msdf.json"></a-text>
            <a-entity id="btp_message" position="-0.0 -0.42 0.01" class="raycastable menu-button"
              geometry={`primitive: plane; width: 1.25; height: 0.20`}
              material="color: white; opacity: 0.95"
            ><a-text value={btp_action.Message || "No message"} align="center" color="#fff" width="1.0" position="0 0 0.01" font="/fonts/Roboto-msdf.json"></a-text></a-entity>

            {/* Data Section */}
            <a-text value="Data Section" align="right" color="#fff" width="1.25" position="-0.36 -0.63 0.01" font="/fonts/Roboto-msdf.json"></a-text>
            <a-entity id="data-section" position="0 -0.98 0.02">
              <a-text 
                value="Data from EWM" 
                align="center" 
                color="#4CC3D9" 
                width="1.5" 
                position="0 0.25 0" 
                font="/fonts/Roboto-msdf.json"
              ></a-text>

              {/* 表头背景 */}
              <a-plane width="1.0" height="0.08" color="#222" position="0 0.15 0"></a-plane>
              <a-text value="Parameter" position="-0.42 0.15 0.01" width="1.1" color="#aaa"></a-text>
              <a-text value="Value" position="0.05 0.15 0.01" width="1.1" color="#aaa"></a-text>
              {/* <a-text value="Status" position="0.4 0.15 0.01" width="1.1" color="#aaa"></a-text> */}
              
              {/* 动态数据列表 */}
              {[
                { name: "Warehouse", value: btp_action.EWMWarehouse || "---", status: "ok" },
                { name: "Order", value: btp_action.WarehouseOrder || "---", status: "ok" },
                { name: "Product", value: btp_action.Product || "---", status: "ok" },
                { name: "Destination", value: btp_action.DestinationStorageBin || "---", status: "ok" },
              ].map((item, index) => (
                <a-entity key={item.name} position={`0 ${0.06 - index * 0.09} 0`}>
                  {/* 斑马纹底色 */}
                  <a-plane 
                    width="1.0" 
                    height="0.08" 
                    color={index % 2 === 0 ? "#333" : "#2a2a2a"} 
                    opacity="0.8"
                  ></a-plane>

                  {/* 参数名 */}
                  <a-text value={item.name} position="-0.42 0 0.01" width="1" font={font_path}></a-text>

                  {/* 参数值 - 根据状态改变颜色 */}
                  <a-text 
                    value={item.value} 
                    position="0.05 0 0.01" 
                    width="1" 
                    color={item.status === 'warn' ? "#FFCC00" : "#00FF00"}
                    font={font_path}
                  ></a-text>

                  {/* 侧边指示小灯 */}
                  {/* <a-entity 
                    geometry="primitive: circle; radius: 0.015" 
                    material={`color: ${item.status === 'ok' ? '#00FF00' : '#FFCC00'}; shader: flat`}
                    position="0.45 0 0.01"
                  ></a-entity> */}
                </a-entity>
              ))}
            </a-entity>

          </a-entity>
        )}

        

        {/* {showMenu && (
          <a-entity 
            id="leftHand" 
            laser-controls="hand: left; model: false" 
            raycaster="objects: .raycastable"
            gltf-model="url(/models/quest-touch-plus-left.glb)"
          ></a-entity>
        )} */}

        {showMenu && (
          <a-entity 
            oculus-touch-controls="hand: right"
            laser-controls="hand: right; model: false" 
            raycaster="objects: .raycastable"
            gltf-model="url(/models/quest-touch-plus-right.glb)"
          ></a-entity>
        )}

        {/* -------------- VR Controller -------------*/}
        {/* <a-entity oculus-touch-controls="hand: right" vr-controller-right visible="true"></a-entity> */}
        {/* <a-entity oculus-touch-controls="hand: left" vr-controller-left visible="true"></a-entity> */}

        <a-entity id="hand-offset-left" position="0.00 -0.685 0.31">
          <a-entity 
            hand-tracking-controls="hand: left; modelStyle: mesh; model: false; " 
            gltf-model="url(/models/left.glb)"
            vr-hand-as-controller="hand: left"
            >
          </a-entity>
        </a-entity>

        <a-entity id="hand-offset-right" position="-0.005 -0.685 0.301">
          <a-entity 
            hand-tracking-controls="hand: right; modelStyle: mesh; model: false" 
            gltf-model="url(/models/right.glb)"
            aabb-collider="objects: .menu-button"
            vr-hand-as-controller="hand: right"
            >
          </a-entity>
        </a-entity>

        <a-entity vr-controller-hmd></a-entity>
        
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