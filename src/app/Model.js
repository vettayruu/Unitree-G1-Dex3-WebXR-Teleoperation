import React from 'react';

// Robot Params
const rad2deg = rad => rad * 180 / Math.PI;
const indicator_radius = 0.0025;
// const indicator_visibility = true;

const Piper = (props) => {
  const L_01 = 0.123, L_23 = 0.28503, L_34 = 0.25075, L_56 = 0.091, L_ee = 0.1358;
  const W_34 = 0.0219;
  const { 
    theta_body = [0,0,0,0,0,0], 
    theta_tool = 0, 
    position = "0 0 0",     
    rotation = "0 0 0",      
    robotId = "robot1",     
    visible = true,
    indicator_visibility = true
  } = props;
  
  const [theta1, theta2, theta3, theta4, theta5, theta6] = theta_body.map(rad2deg);
  const finger_pos = (((theta_tool)*0.4) / 1000)+0.0004;

  return (
    <>
      <a-entity 
        id={robotId}
        position={position}
        rotation={rotation}
        visible={visible}
      >
        <a-plane
          position="0 0 0"
          rotation="-90 0 0"
          width="1.2"
          height="1.2"
          color="#e0e0e0"
          opacity="0.3"
          visible="false"
        ></a-plane>

        {/* Robot Base */}
        <a-entity robot-click="" id={`${robotId}_base`}  gltf-model={`#${robotId}_base`} position={'0 0 0'} visible="true"
          >
          {/* J1 */}
          <a-entity j_id="1" id={`${robotId}_j1`} gltf-model={`#${robotId}_j1`} position={'0 0 0'} rotation={`0 ${theta1-180} 0`} model-opacity="0.3"
            ><a-cylinder radius={indicator_radius} height="0.15" color="rgba(242, 63, 23, 1)" position={`0 ${L_01} 0.075`} rotation={`0 90 90`} visible={indicator_visibility}></a-cylinder>
            {/* J2 */}
            <a-entity j_id="2" id={`${robotId}_j2`} gltf-model={`#${robotId}_j2`} position={`0 ${L_01} 0`} rotation={`${theta2} 0 0`} model-opacity="0.3"
              ><a-cylinder radius={indicator_radius} height="0.15" color="#1976d2" position={`0 0.075 0`} rotation={`0 90 0`} visible={indicator_visibility}></a-cylinder>
              {/* J3 */}
              <a-entity j_id="3" id={`${robotId}_j3`} gltf-model={`#${robotId}_j3`} position={`0 ${L_23} 0`} rotation={`${theta3} 0 0`} model-opacity="0.3"
                ><a-cylinder radius={indicator_radius} height="0.15" color="#1976d2" position={`0 0.075 0`} rotation={`0 90 0`} visible={indicator_visibility}></a-cylinder>
                {/* J4 */}
                <a-entity j_id="4" id={`${robotId}_j4`} gltf-model={`#${robotId}_j4`} position={`0 ${L_34} -${W_34}`} rotation={`0 ${theta4} 0`} model-opacity="0.3"
                  ><a-cylinder radius={indicator_radius} height="0.15" color="rgba(242, 63, 23, 1)" position={`0.0 0.0 -0.075`} rotation={`90 0 0`} visible={indicator_visibility}></a-cylinder>
                  {/* J5 */}
                  <a-entity j_id="5" id={`${robotId}_j5`} gltf-model={`#${robotId}_j5`} position={`0 0 0`} rotation={`${theta5-90} 0 0`} model-opacity="0.3"
                    ><a-cylinder radius={indicator_radius} height="0.12" color="#1976d2" position={`-0.0 0.0 0.06`} rotation={`90 0 0`} visible={indicator_visibility}></a-cylinder>
                    {/* J6 */}
                    <a-entity j_id="6" id={`${robotId}_j6`} gltf-model={`#${robotId}_j6`} position={`0 0 0`} rotation={`0 0 ${theta6}`} model-opacity="0.3"
                      ><a-cylinder radius={indicator_radius} height="0.15" color="rgba(242, 63, 23, 1)" position={`0 0.075 0.14`} rotation={`0 0 0`} visible={indicator_visibility}></a-cylinder>
                      {/* Tool */}
                      <a-entity id={`${robotId}_j6_1`} gltf-model={`#${robotId}_j6_1`} position={`${finger_pos} 0 ${L_56+L_ee}`}></a-entity>
                      <a-entity id={`${robotId}_j6_2`} gltf-model={`#${robotId}_j6_2`} position={`${-finger_pos} 0 ${L_56+L_ee}`}></a-entity>
                        <a-sphere
                          id={`${robotId}_end_sphere`}
                          radius="0.05"
                          color="pink"
                          position="0 0 0.15"
                          joint-collision-check={`target: #${robotId === 'left_arm' ? 'right_arm_end_sphere' : 'left_arm_end_sphere'}`}
                          visible="false"
                        ></a-sphere>
                    </a-entity>
                    {/* J6 Rotation Indicator */}
                    <a-ring
                      radius-inner="0.12"
                      radius-outer="0.15"
                      theta-start={-120}
                      theta-length={240}
                      color="#ccc"
                      position={`0 0 ${L_ee}`}
                      rotation="0 0 90"
                      opacity="0.8"
                      side="double"
                      visible={indicator_visibility}
                    ></a-ring>
                  </a-entity>
                  {/* J5 Rotation Indicator */}
                  <a-ring
                    radius-inner="0.09"
                    radius-outer="0.12"
                    theta-start={1}
                    theta-length={68}
                    color="#ccc"
                    position={`-0.0 0 0`}
                    rotation="0 90 90"
                    opacity="0.8"
                    side="double"
                    visible={indicator_visibility}
                  ></a-ring>
                </a-entity>
                {/* J4 Rotation Indicator */}
                <a-ring
                  radius-inner="0.12"
                  radius-outer="0.15"
                  theta-start={-95}
                  theta-length={190}
                  color="#ccc"
                  position={`0 ${L_34} 0`}
                  rotation="90 0 -90"
                  opacity="0.8"
                  side="double"
                  visible={indicator_visibility}
                ></a-ring>
              </a-entity>
              {/* J3 Rotation Indicator */}
              <a-ring
                radius-inner="0.12"
                radius-outer="0.15"
                theta-start={45}
                theta-length={100}
                color="#ccc"
                position={`0 ${L_23} 0`}
                rotation="0 90 90"
                opacity="0.8"
                side="double"
                visible={indicator_visibility}
              ></a-ring>
            </a-entity>
            {/* J2 Rotation Indicator */}
            <a-ring
              radius-inner="0.12"
              radius-outer="0.15"
              theta-start={-45}
              theta-length={100}
              color="#ccc"
              position={`0 ${L_01} 0`}
              rotation="0 90 90"
              opacity="0.8"
              side="double"
              visible={indicator_visibility}
            ></a-ring>
          </a-entity>
          {/* J1 Rotation Indicator */}
          <a-ring radius-inner="0.12" 
            radius-outer="0.15"
            theta-start={-45}
            theta-length={90}
            color="#ccc"
            position={`0 ${L_01} 0`}
            rotation="-90 90 0"
            opacity="0.8"
            visible={indicator_visibility}
          ></a-ring>
        </a-entity>
        
        {/* <a-text 
          value={robotId}
          position="0 0.7 0"
          rotation="0 0 0"
          color="white"
          align="center"
          scale="0.2 0.2 0.2"
        ></a-text> */}
      </a-entity>
    </>
  );
};

const MyCobot = (props) => {
  const { 
    theta_body = [0,0,0,0,0,0], 
    position = "0 0 0",     
    rotation = "0 0 0",     
    robotId = "cam",     
    visible = true         
  } = props;
  
  const [theta1, theta2, theta3, theta4, theta5, theta6] = theta_body.map(rad2deg);

  return (
    <>
      <a-entity 
        id={robotId}
        position={position}
        rotation={rotation}
        visible={visible}
      >

        {/* Robot Base */}
        <a-entity robot-click="" id={`${robotId}_base`}  gltf-model={`#${robotId}_base`} position={'0 0 0'} rotation={`0 90 0`} model-opacity="0.3"
          >
          {/* J1 */}
          <a-entity j_id="1" id={`${robotId}_j1`} gltf-model={`#${robotId}_j1`} position={'0 0.0706 0'} rotation={`0 ${theta1} 0`} model-opacity="0.3"
            >
            {/* J2 */}
            <a-entity j_id="2" id={`${robotId}_j2`} gltf-model={`#${robotId}_j2`} position={`0 0.06 0.03256`} rotation={`0 0 ${theta2}`} model-opacity="0.3"
              >
              {/* J3 */}
              <a-entity j_id="3" id={`${robotId}_j3`} gltf-model={`#${robotId}_j3`} position={`0 0.1104 0`} rotation={`0 0 ${theta3}`} model-opacity="0.3"
                >
                {/* J4 */}
                <a-entity j_id="4" id={`${robotId}_j4`} gltf-model={`#${robotId}_j4`} position={`0 +0.096 0`} rotation={`0 0 ${theta4}`} model-opacity="0.3"
                  >
                  {/* J5 */}
                  <a-entity j_id="5" id={`${robotId}_j5`} gltf-model={`#${robotId}_j5`} position={`0 0.0345 0.0335`} rotation={`0 ${theta5} 0`} model-opacity="0.3"
                    >
                    {/* J6 */}
                    <a-entity j_id="6" id={`${robotId}_j6`} gltf-model={`#${robotId}_j6`} position={`0.034 0.038 0`} rotation={`${theta6} 0 0`} model-opacity="0.3"
                      >
                      {/* Tool */}
                      <a-entity id={`${robotId}_cam_mount_1`} gltf-model={`#${robotId}_cam_mount_1`} position={`0.0135 0.001 0`}></a-entity>
                      <a-entity id={`${robotId}_cam_mount_2`} gltf-model={`#${robotId}_cam_mount_2`} position={`0.0135 0.024 0`}></a-entity>
                      <a-entity id={`${robotId}_cam`} gltf-model={`#${robotId}_cam`} position={`0.024 0.04 0`}></a-entity>
                        {/* <a-sphere
                          id={`${robotId}_end_sphere`}
                          radius="0.08"
                          color="pink"
                          position="0.05 0.01 0"
                          joint-collision-check={`target: #left_arm_end_sphere`}
                        ></a-sphere>

                        <a-sphere
                          id={`${robotId}_end_sphere`}
                          radius="0.08"
                          color="pink"
                          position="0.05 0.01 0"
                          joint-collision-check={`target: #right_arm_end_sphere`}
                        ></a-sphere> */}
                    </a-entity>
                  </a-entity>
                </a-entity>
              </a-entity>
            </a-entity>
          </a-entity>
        </a-entity>
        
        {/* <a-text 
          value={robotId}
          position="0 0.7 0"
          rotation="0 0 0"
          color="white"
          align="center"
          scale="0.2 0.2 0.2"
        ></a-text> */}
      </a-entity>
    </>
  );
};


const G1_Body = (props) => {
  const { 
    theta_body, 
    theta_tool, 
    joint_limits_right,
    theta_body_left,
    theta_tool_left,
    joint_limits_left,
    theta_body_cam,
    position = "0 0 0",     
    rotation = "0 0 0",     
    robotId = "unitree_g1_body",     
    visible = true,        
    indicator_visibility = true,
  } = props;

  const [theta0, theta1, theta2, theta3, theta4, theta5, theta6, theta7] = theta_body.map(rad2deg);
  const [theta0_left, theta1_left, theta2_left, theta3_left, theta4_left, theta5_left, theta6_left, theta7_left] = theta_body_left.map(rad2deg);
  const [theta0_cam, theta1_cam, theta2_cam] = theta_body_cam.map(rad2deg);

  const opacity = "0.8"; // 设置整体透明度

  return (
    <>
      <a-entity 
        id={robotId}
        position={position}
        rotation={rotation}
        visible={visible}
      >

        {/* Waist */}
        <a-entity j_id="waist_yaw" id={`${robotId}_waist_yaw`}  gltf-model={`#${robotId}_waist_yaw`} position={'0 0.0 0'} rotation={`0 ${theta0_cam+90} 0`} model-opacity={opacity}
          >
          <a-entity j_id="waist_roll" id={`${robotId}_waist_roll`} gltf-model={`#${robotId}_waist_roll`} position={'-0.00396 0.044 0'} rotation={`0 0 0`} model-opacity={opacity}
            >
            <a-entity j_id="torso" id={`${robotId}_torso`}  gltf-model={`#${robotId}_torso`} position={'0 0.0 0.0'} rotation={`0 0 ${-theta2_cam}`} model-opacity={opacity}
              >
              {/* Right Arm J1 */}
              <a-entity j_id="1" id={`${robotId}_arm_right_j1`} gltf-model={`#${robotId}_arm_right_j1`} position={'0.00396 0.24778 0.1'} rotation={`-16 0 ${-theta1}`} 
                ><a-cylinder radius={indicator_radius} height="0.15" color="rgba(23, 242, 38, 1)" position={`0.075 0 0.0`} rotation={`0 0 90`} visible={indicator_visibility}></a-cylinder>
                {/* Right Arm J2 */}
                <a-entity j_id="2" id={`${robotId}_arm_right_j2`} gltf-model={`#${robotId}_arm_right_j2`} position={`0.0 -0.01383 0.038`} rotation={`${theta2+16} 0 0`} 
                  ><a-cylinder radius={indicator_radius} height="0.15" color="rgba(242, 63, 23, 1)" position={`0.0 0.0 0.075`} rotation={`90 0 0`} visible={indicator_visibility}></a-cylinder>
                  {/* Right Arm J3 */}
                  <a-entity j_id="3" id={`${robotId}_arm_right_j3`} gltf-model={`#${robotId}_arm_right_j3`} position={`0 -0.1032 0.00624`} rotation={`0 ${theta3} 0`} 
                    ><a-cylinder radius={indicator_radius} height="0.15" color="rgba(10, 41, 241, 1)" position={`0.075 0.0 0.0`} rotation={`0 0 90`} visible={indicator_visibility}></a-cylinder>
                    {/* Right ArmJ4 */}
                    <a-entity j_id="4" id={`${robotId}_arm_right_j4`} gltf-model={`#${robotId}_arm_right_j4`} position={`0.01578 -0.08052 0.0`} rotation={`0 0 ${-theta4}`} 
                      ><a-cylinder radius={indicator_radius} height="0.15" color="rgba(23, 242, 38, 1)" position={`0.075 0 0.0`} rotation={`0 0 90`} visible={indicator_visibility}></a-cylinder>
                      {/* Right Arm J5 */}
                      <a-entity j_id="5" id={`${robotId}_arm_right_j5`} gltf-model={`#${robotId}_arm_right_j5`} position={`0.1 -0.010 0.00189`} rotation={`${theta5} 0 0`} 
                        ><a-cylinder radius={indicator_radius} height="0.15" color="rgba(242, 63, 23, 1)" position={`0.0 0.0 0.075`} rotation={`90 0 0`} visible={indicator_visibility}></a-cylinder>
                        {/* Right Arm J6 */}
                        <a-entity j_id="6" id={`${robotId}_arm_right_j6`} gltf-model={`#${robotId}_arm_right_j6`} position={`0.038 0 0`} rotation={`0 0 ${-theta6}`} 
                          ><a-cylinder radius={indicator_radius} height="0.15" color="rgba(23, 242, 38, 1)" position={`0.075 0 0.0`} rotation={`0 0 90`} visible={indicator_visibility}></a-cylinder>
                          {/* Right Arm J7 */}
                          <a-entity j_id="7" id={`${robotId}_arm_right_j7`} gltf-model={`#${robotId}_arm_right_j7`} position={`0.046 0.0 0.0`} rotation={`0 ${theta7} 0`} 
                            ><a-cylinder radius={indicator_radius} height="0.15" color="rgba(10, 41, 241, 1)" position={`0.075 0.0 0.0`} rotation={`0 0 90`} visible={indicator_visibility}></a-cylinder>
                              {/* Right Hand */}
                              <a-entity j_id="hand_right_palm" id={`${robotId}_hand_right_palm`} gltf-model={`#${robotId}_hand_right_palm`} position={`0.0415 0.0 0.003`} rotation={`0 0 0`} 
                              >
                                {/* Right Hand Thumb */}
                                <a-entity j_id="hand_right_thumb_0" id={`${robotId}_hand_right_thumb_0`} gltf-model={`#${robotId}_hand_right_thumb_0`} position={`0.0255 0.0 0.0`} rotation={`0 0 ${theta_tool[0][0]}`} 
                                >
                                  <a-entity j_id="hand_right_thumb_1" id={`${robotId}_hand_right_thumb_1`} gltf-model={`#${robotId}_hand_right_thumb_1`} position={`-0.0025 0.0 -0.0193`} rotation={`0 ${-theta_tool[0][1]} 0`} 
                                  >
                                    <a-entity j_id="hand_right_thumb_2" id={`${robotId}_hand_right_thumb_2`} gltf-model={`#${robotId}_hand_right_thumb_2`} position={`0.00 0.0 -0.0458`} rotation={`0 ${-theta_tool[0][2]} 0`} 
                                    >
                                    </a-entity>
                                  </a-entity>
                                </a-entity>
                                {/* Right Hand Index */}
                                <a-entity j_id="hand_right_index_0" id={`${robotId}_hand_right_index_0`} gltf-model={`#${robotId}_hand_right_index_0`} position={`0.07771 0.02848 -0.00159`} rotation={`0 ${theta_tool[1][0]} 0`} 
                                >
                                  <a-entity j_id="hand_right_index_1" id={`${robotId}_hand_right_index_1`} gltf-model={`#${robotId}_hand_right_index_1`} position={`0.0458 0.0 0.0`} rotation={`0 ${theta_tool[1][1]} 0`} 
                                  >
                                  </a-entity>
                                </a-entity>
                                {/* Right Hand Middle */}
                                <a-entity j_id="hand_right_middle_0" id={`${robotId}_hand_right_middle_0`} gltf-model={`#${robotId}_hand_right_middle_0`} position={`0.07771 -0.02848 -0.00159`} rotation={`0 ${theta_tool[2][0]} 0`} 
                                >
                                  <a-entity j_id="hand_right_middle_1" id={`${robotId}_hand_right_middle_1`} gltf-model={`#${robotId}_hand_right_middle_1`} position={`0.0458 0.0 0.0`} rotation={`0 ${theta_tool[2][1]} 0`} 
                                  >
                                  </a-entity>
                                </a-entity>
                            </a-entity>
                            
                          </a-entity>
                            {/* J7 Indocator*/}
                              <a-ring radius-inner="0.12" radius-outer="0.15" theta-start={rad2deg(joint_limits_right[7].min)} theta-length={rad2deg(joint_limits_right[7].max) - rad2deg(joint_limits_right[7].min)} color="rgba(232, 253, 118, 1)" 
                                      position={`0.046 0 0`} rotation="90 0 0" opacity={opacity} side="double" visible={indicator_visibility}></a-ring>
                        </a-entity>
                          {/* J6 Indocator*/}
                            <a-ring radius-inner="0.12" radius-outer="0.15" theta-start={rad2deg(joint_limits_right[6].min)} theta-length={rad2deg(joint_limits_right[6].max) - rad2deg(joint_limits_right[6].min)} color="rgba(232, 253, 118, 1)" 
                                    position={`0.038 0.0 0.0`} rotation="0 0 0" opacity={opacity} side="double" visible={indicator_visibility}></a-ring>
                      </a-entity>
                        {/* J5 Indocator*/}
                          <a-ring radius-inner="0.12" radius-outer="0.15" theta-start={rad2deg(joint_limits_right[5].min)} theta-length={rad2deg(joint_limits_right[5].max) - rad2deg(joint_limits_right[5].min)} color="rgba(232, 253, 118, 1)" 
                                  position={`0.1 -0.010 0.00189`} rotation="0 -90 0" opacity={opacity} side="double" visible={indicator_visibility}></a-ring>
                    </a-entity>
                      {/* J4 Indocator*/}
                        <a-ring radius-inner="0.12" radius-outer="0.15" theta-start={rad2deg(joint_limits_right[4].min)} theta-length={rad2deg(joint_limits_right[4].max) - rad2deg(joint_limits_right[4].min)} color="rgba(232, 253, 118, 1)" 
                                position={`0.01578 -0.08052 0.0`} rotation="0 0 -30" opacity={opacity} side="double" visible={indicator_visibility}></a-ring>
                  </a-entity>
                    {/* J3 Indocator*/}
                      <a-ring radius-inner="0.12" radius-outer="0.15" theta-start={rad2deg(joint_limits_right[3].min)} theta-length={rad2deg(joint_limits_right[3].max) - rad2deg(joint_limits_right[3].min)} color="rgba(232, 253, 118, 1)" 
                              position={`0 -0.1032 0.00624`} rotation={`90 0 0`} opacity={opacity} side="double" visible={indicator_visibility}></a-ring>
                </a-entity>
                  {/* J2 Indocator*/}
                    <a-ring radius-inner="0.12" radius-outer="0.15" theta-start={rad2deg(joint_limits_right[2].min)} theta-length={rad2deg(joint_limits_right[2].max) - rad2deg(joint_limits_right[2].min)} color="rgba(232, 253, 118, 1)" 
                            position={`0.0 -0.01383 0.038`} rotation="0 90 -164" opacity={opacity} side="double" visible={indicator_visibility}></a-ring>
              </a-entity>
                {/* J1 Indocator*/}
                  <a-ring radius-inner="0.12" radius-outer="0.15" theta-start={rad2deg(joint_limits_right[1].min)} theta-length={rad2deg(joint_limits_right[1].max) - rad2deg(joint_limits_right[1].min)} color="rgba(232, 253, 118, 1)" 
                          position={'0.00396 0.24778 0.1'} rotation="-16 0 90" opacity={opacity} side="double" visible={indicator_visibility}></a-ring>
              {/* Head */}
              <a-entity j_id="head" id={`${robotId}_head`} gltf-model={`#${robotId}_head`} position={'0 -0.05 0.0'} rotation={`0 ${theta1_cam-theta0_cam} 0`} model-opacity={opacity}
                >
                </a-entity>
              {/* Left Arm J1 */}
              <a-entity j_id="1" id={`${robotId}_arm_left_j1`} gltf-model={`#${robotId}_arm_left_j1`} position={'0.00396 0.24778 -0.1'} rotation={`16 0 ${-theta1_left}`} 
                ><a-cylinder radius={indicator_radius} height="0.15" color="rgba(23, 242, 38, 1)" position={`0.075 0 0.0`} rotation={`0 0 90`} visible={indicator_visibility}></a-cylinder>
                {/* J2 */}
                <a-entity j_id="2" id={`${robotId}_arm_left_j2`} gltf-model={`#${robotId}_arm_left_j2`} position={`0.0 -0.01383 -0.038`} rotation={`${theta2_left-16} 0 0`} 
                  ><a-cylinder radius={indicator_radius} height="0.15" color="rgba(242, 63, 23, 1)" position={`0.0 0.0 -0.075`} rotation={`90 0 0`} visible={indicator_visibility}></a-cylinder>
                  {/* J3 */}
                  <a-entity j_id="3" id={`${robotId}_arm_left_j3`} gltf-model={`#${robotId}_arm_left_j3`} position={`0 -0.1032 -0.00624`} rotation={`0 ${theta3_left} 0`} 
                    ><a-cylinder radius={indicator_radius} height="0.15" color="rgba(10, 41, 241, 1)" position={`0.075 0.0 0.0`} rotation={`0 0 90`} visible={indicator_visibility}></a-cylinder>
                    {/* J4 */}
                    <a-entity j_id="4" id={`${robotId}_arm_left_j4`} gltf-model={`#${robotId}_arm_left_j4`} position={`0.01578 -0.08052 0.0`} rotation={`0 0 ${-theta4_left}`} 
                      ><a-cylinder radius={indicator_radius} height="0.15" color="rgba(23, 242, 38, 1)" position={`0.075 0 0.0`} rotation={`0 0 90`} visible={indicator_visibility}></a-cylinder>
                      {/* J5 */}
                      <a-entity j_id="5" id={`${robotId}_arm_left_j5`} gltf-model={`#${robotId}_arm_left_j5`} position={`0.1 -0.010 0.00189`} rotation={`${theta5_left} 0 0`} 
                        ><a-cylinder radius={indicator_radius} height="0.15" color="rgba(242, 63, 23, 1)" position={`0.0 0.0 -0.075`} rotation={`90 0 0`} visible={indicator_visibility}></a-cylinder>
                        {/* J6 */}
                        <a-entity j_id="6" id={`${robotId}_arm_left_j6`} gltf-model={`#${robotId}_arm_left_j6`} position={`0.038 0 0`} rotation={`0 0 ${-theta6_left}`} 
                          ><a-cylinder radius={indicator_radius} height="0.15" color="rgba(23, 242, 38, 1)" position={`0.075 0 0.0`} rotation={`0 0 90`} visible={indicator_visibility}></a-cylinder>
                          {/* J7 */}
                          <a-entity j_id="7" id={`${robotId}_arm_left_j7`} gltf-model={`#${robotId}_arm_left_j7`} position={`0.046 0.0 0.0`} rotation={`0 ${theta7_left} 0`} 
                            ><a-cylinder radius={indicator_radius} height="0.15" color="rgba(10, 41, 241, 1)" position={`0.075 0.0 0.0`} rotation={`0 0 90`} visible={indicator_visibility}></a-cylinder>
                              {/* Left Hand */}
                              <a-entity j_id="hand_left_palm" id={`${robotId}_hand_left_palm`} gltf-model={`#${robotId}_hand_left_palm`} position={`0.0415 0.0 0.003`} rotation={`0 0 0`} 
                              >
                                {/* Left Hand Thumb */}
                                <a-entity j_id="hand_left_thumb_0" id={`${robotId}_hand_left_thumb_0`} gltf-model={`#${robotId}_hand_left_thumb_0`} position={`0.0255 0.0 0.0`} rotation={`0 0 ${theta_tool_left[0][0]}`} 
                                >
                                  <a-entity j_id="hand_left_thumb_1" id={`${robotId}_hand_left_thumb_1`} gltf-model={`#${robotId}_hand_left_thumb_1`} position={`-0.0025 0.0 0.0193`} rotation={`0 ${theta_tool_left[0][1]} 0`} 
                                  >
                                    <a-entity j_id="hand_left_thumb_2" id={`${robotId}_hand_left_thumb_2`} gltf-model={`#${robotId}_hand_left_thumb_2`} position={`0.00 0.0 0.0458`} rotation={`0 ${theta_tool_left[0][2]} 0`} 
                                    >
                                    </a-entity>
                                  </a-entity>
                                </a-entity>
                                {/* Left Hand Index */}
                                <a-entity j_id="hand_left_index_0" id={`${robotId}_hand_left_index_0`} gltf-model={`#${robotId}_hand_left_index_0`} position={`0.07771 0.02848 -0.00159`} rotation={`0 ${-theta_tool_left[1][0]} 0`} 
                                >
                                  <a-entity j_id="hand_left_index_1" id={`${robotId}_hand_left_index_1`} gltf-model={`#${robotId}_hand_left_index_1`} position={`0.0458 0.0 0.0`} rotation={`0 ${-theta_tool_left[1][1]} 0`} 
                                  >
                                  </a-entity>
                                </a-entity>
                                {/* Left Hand Middle */}
                                <a-entity j_id="hand_left_middle_0" id={`${robotId}_hand_left_middle_0`} gltf-model={`#${robotId}_hand_left_middle_0`} position={`0.07771 -0.02848 -0.00159`} rotation={`0 ${-theta_tool_left[2][0]} 0`} 
                                >
                                  <a-entity j_id="hand_left_middle_1" id={`${robotId}_hand_left_middle_1`} gltf-model={`#${robotId}_hand_left_middle_1`} position={`0.0458 0.0 0.0`} rotation={`0 ${-theta_tool_left[2][1]} 0`} 
                                  >
                                  </a-entity>
                                </a-entity>
                            </a-entity>

                          </a-entity>
                              {/* J7 Indocator*/}
                                <a-ring radius-inner="0.12" radius-outer="0.15" theta-start={rad2deg(joint_limits_left[7].min)} theta-length={rad2deg(joint_limits_left[7].max) - rad2deg(joint_limits_left[7].min)} color="rgba(232, 253, 118, 1)" 
                                        position={`0.046 0 0`} rotation="90 0 0" opacity={opacity} side="double" visible={indicator_visibility}></a-ring>
                        </a-entity>
                          {/* J6 Indocator*/}
                            <a-ring radius-inner="0.12" radius-outer="0.15" theta-start={rad2deg(joint_limits_left[6].min)} theta-length={rad2deg(joint_limits_left[6].max) - rad2deg(joint_limits_left[6].min)} color="rgba(232, 253, 118, 1)" 
                                    position={`0.038 0.0 0.0`} rotation="0 0 0" opacity={opacity} side="double" visible={indicator_visibility}></a-ring>
                      </a-entity>
                        {/* J5 Indocator*/}
                          <a-ring radius-inner="0.12" radius-outer="0.15" theta-start={rad2deg(joint_limits_left[5].min)} theta-length={rad2deg(joint_limits_left[5].max) - rad2deg(joint_limits_left[5].min)} color="rgba(232, 253, 118, 1)" 
                                  position={`0.1 -0.010 0.00189`} rotation="0 90 0" opacity={opacity} side="double" visible={indicator_visibility}></a-ring>
                    </a-entity>
                      {/* J4 Indocator*/}
                        <a-ring radius-inner="0.12" radius-outer="0.15" theta-start={rad2deg(joint_limits_left[4].min)} theta-length={rad2deg(joint_limits_left[4].max) - rad2deg(joint_limits_left[4].min)} color="rgba(232, 253, 118, 1)" 
                                position={`0.01578 -0.08052 0.0`} rotation="0 0 -30" opacity={opacity} side="double" visible={indicator_visibility}></a-ring>
                  </a-entity>
                    {/* J3 Indocator*/}
                      <a-ring radius-inner="0.12" radius-outer="0.15" theta-start={rad2deg(joint_limits_left[3].min)} theta-length={rad2deg(joint_limits_left[3].max) - rad2deg(joint_limits_left[3].min)} color="rgba(232, 253, 118, 1)" 
                              position={`0 -0.1032 0.00624`} rotation={`90 0 0`} opacity={opacity} side="double" visible={indicator_visibility}></a-ring>
                </a-entity>
                  {/* J2 Indocator*/}
                    <a-ring radius-inner="0.12" radius-outer="0.15" theta-start={rad2deg(joint_limits_left[2].min)} theta-length={rad2deg(joint_limits_left[2].max) - rad2deg(joint_limits_left[2].min)} color="rgba(232, 253, 118, 1)" 
                            position={`0.0 -0.01383 0.038`} rotation="0 90 -16" opacity={opacity} side="double" visible={indicator_visibility}></a-ring>
              </a-entity>
                {/* J1 Indocator*/}
                  <a-ring radius-inner="0.12" radius-outer="0.15" theta-start={rad2deg(joint_limits_left[1].min)} theta-length={rad2deg(joint_limits_left[1].max) - rad2deg(joint_limits_left[1].min)} color="rgba(232, 253, 118, 1)" 
                          position={'0.00396 0.24778 -0.1'} rotation="16 0 90" opacity={opacity} side="double" visible={indicator_visibility}></a-ring>
            </a-entity>
          </a-entity>
        </a-entity>
      </a-entity>
        
        
        {/* <a-text 
          value={robotId}
          position="0 0.7 0"
          rotation="0 0 0"
          color="white"
          align="center"
          scale="0.2 0.2 0.2"
        ></a-text> */}
    </>
  );
};


const Select_Robot = (props) => {
  const {
    robotNameList, 
    robotName, 
    theta_body, 
    theta_tool,
    theta_body_left,
    theta_tool_left,
    theta_body_cam,
    // Other props
    ...rotateProps
  } = props;
  // console.log("robotprops:", props);

  const visibletable = robotNameList.map(() => false);
  const findindex = robotNameList.findIndex((e) => e === robotName);
  if (findindex >= 0) {
    visibletable[findindex] = true;
  }

  return (
    <>
      <G1_Body 
        visible={visibletable[0]}
        theta_body={theta_body}
        theta_tool={theta_tool}
        joint_limits_right={props.joint_limits_right}
        theta_body_left={theta_body_left}
        theta_tool_left={theta_tool_left}
        joint_limits_left={props.joint_limits_left}
        theta_body_cam={theta_body_cam}
        position={props.position_right} 
        rotation="0 0 0"
        robotId="body"
        indicator_visibility={props.indicator}
        {...rotateProps}
      />
    </>
  );
};

export { Select_Robot };