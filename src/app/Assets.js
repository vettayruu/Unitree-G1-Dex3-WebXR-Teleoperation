import React from 'react';

const robotAssets = {
  agilex_piper: [
    { id: "base", src: "/agilex_piper/base_link_lite.glb" },
    { id: "j1", src: "/agilex_piper/link1_lite.glb" },
    { id: "j2", src: "/agilex_piper/link2_lite.glb" },
    { id: "j3", src: "/agilex_piper/link3_lite.glb" },
    { id: "j4", src: "/agilex_piper/link4_lite.glb" },
    { id: "j5", src: "/agilex_piper/link5_lite.glb" },
    { id: "j6", src: "/agilex_piper/link6_lite.glb" },
    { id: "j6_1", src: "/agilex_piper/link7_lite.glb" },
    { id: "j6_2", src: "/agilex_piper/link8_lite.glb" },
  ],
  jaka_zu_5: [
    { id: "base", src: "/jaka_zu_5/JAKA_Zu_5_BASE.gltf" },
    { id: "j1", src: "/jaka_zu_5/JAKA_Zu_5_J1.gltf" },
    { id: "j2", src: "/jaka_zu_5/JAKA_Zu_5_J2.gltf" },
    { id: "j3", src: "/jaka_zu_5/JAKA_Zu_5_J3.gltf" },
    { id: "j4", src: "/jaka_zu_5/JAKA_Zu_5_J4.gltf" },
    { id: "j5", src: "/jaka_zu_5/JAKA_Zu_5_J5.gltf" },
    { id: "j6", src: "/jaka_zu_5/JAKA_Zu_5_J6.gltf" },
  ],
  myCobot280: [
    { id: "base", src: "/myCobot280/link0.glb" },
    { id: "j1", src: "/myCobot280/link1.glb" },
    { id: "j2", src: "/myCobot280/link2.glb" },
    { id: "j3", src: "/myCobot280/link3.glb" },
    { id: "j4", src: "/myCobot280/link4.glb" },
    { id: "j5", src: "/myCobot280/link5.glb" },
    { id: "j6", src: "/myCobot280/link6.glb" },
    { id: "cam_mount_1", src: "/myCobot280/zedm_mount_1.glb" },
    { id: "cam_mount_2", src: "/myCobot280/zedm_mount_2.glb" },
    { id: "cam", src: "/myCobot280/zedm.glb" },
  ],
  unitree_g1_arm_left: [
    { id: "head", src: "/unitree_g1/head.glb" },
    { id: "torso", src: "/unitree_g1/torso.glb" },
    { id: "j1", src: "/unitree_g1/left_shoulder_pitch.glb" },
    { id: "j2", src: "/unitree_g1/left_shoulder_roll.glb" },
    { id: "j3", src: "/unitree_g1/left_shoulder_yaw.glb" },
    { id: "j4", src: "/unitree_g1/left_elbow.glb" },
    { id: "j5", src: "/unitree_g1/left_wrist_roll.glb" },
    { id: "j6", src: "/unitree_g1/left_wrist_pitch.glb" },
    { id: "j7", src: "/unitree_g1/left_wrist_yaw.glb" },
    { id: "palm", src: "/unitree_g1/left_hand_palm.glb" },
    { id: "thumb_0", src: "/unitree_g1/left_hand_thumb_0.glb" },
    { id: "thumb_1", src: "/unitree_g1/left_hand_thumb_1.glb" },
    { id: "thumb_2", src: "/unitree_g1/left_hand_thumb_2.glb" },
    { id: "index_0", src: "/unitree_g1/left_hand_index_0.glb" },
    { id: "index_1", src: "/unitree_g1/left_hand_index_1.glb" },
    { id: "middle_0", src: "/unitree_g1/left_hand_middle_0.glb" },
    { id: "middle_1", src: "/unitree_g1/left_hand_middle_1.glb" },
  ],
  unitree_g1_arm_right: [
    { id: "head", src: "/unitree_g1/head.glb" },
    { id: "torso", src: "/unitree_g1/torso.glb" },
    { id: "j1", src: "/unitree_g1/right_shoulder_pitch.glb" },
    { id: "j2", src: "/unitree_g1/right_shoulder_roll.glb" },
    { id: "j3", src: "/unitree_g1/right_shoulder_yaw.glb" },
    { id: "j4", src: "/unitree_g1/right_elbow.glb" },
    { id: "j5", src: "/unitree_g1/right_wrist_roll.glb" },
    { id: "j6", src: "/unitree_g1/right_wrist_pitch.glb" },
    { id: "j7", src: "/unitree_g1/right_wrist_yaw.glb" },
    { id: "palm", src: "/unitree_g1/right_hand_palm.glb" },
    { id: "thumb_0", src: "/unitree_g1/right_hand_thumb_0.glb" },
    { id: "thumb_1", src: "/unitree_g1/right_hand_thumb_1.glb" },
    { id: "thumb_2", src: "/unitree_g1/right_hand_thumb_2.glb" },
    { id: "index_0", src: "/unitree_g1/right_hand_index_0.glb" },
    { id: "index_1", src: "/unitree_g1/right_hand_index_1.glb" },
    { id: "middle_0", src: "/unitree_g1/right_hand_middle_0.glb" },
    { id: "middle_1", src: "/unitree_g1/right_hand_middle_1.glb" },
  ],

  unitree_g1_dex3: [
    { id: "head", src: "/unitree_g1/head.glb" },
    { id: "torso", src: "/unitree_g1/torso.glb" },
    { id: "waist_yaw", src: "/unitree_g1/waist_yaw.glb" },
    { id: "waist_roll", src: "/unitree_g1/waist_roll.glb" },
    { id: "arm_left_j1", src: "/unitree_g1/left_shoulder_pitch.glb" },
    { id: "arm_left_j2", src: "/unitree_g1/left_shoulder_roll.glb" },
    { id: "arm_left_j3", src: "/unitree_g1/left_shoulder_yaw.glb" },
    { id: "arm_left_j4", src: "/unitree_g1/left_elbow.glb" },
    { id: "arm_left_j5", src: "/unitree_g1/left_wrist_roll.glb" },
    { id: "arm_left_j6", src: "/unitree_g1/left_wrist_pitch.glb" },
    { id: "arm_left_j7", src: "/unitree_g1/left_wrist_yaw.glb" },
    { id: "arm_right_j1", src: "/unitree_g1/right_shoulder_pitch.glb" },
    { id: "arm_right_j2", src: "/unitree_g1/right_shoulder_roll.glb" },
    { id: "arm_right_j3", src: "/unitree_g1/right_shoulder_yaw.glb" },
    { id: "arm_right_j4", src: "/unitree_g1/right_elbow.glb" },
    { id: "arm_right_j5", src: "/unitree_g1/right_wrist_roll.glb" },
    { id: "arm_right_j6", src: "/unitree_g1/right_wrist_pitch.glb" },
    { id: "arm_right_j7", src: "/unitree_g1/right_wrist_yaw.glb" },
    { id: "hand_right_palm", src: "/unitree_g1/right_hand_palm.glb" },
    { id: "hand_right_thumb_0", src: "/unitree_g1/right_hand_thumb_0.glb" },
    { id: "hand_right_thumb_1", src: "/unitree_g1/right_hand_thumb_1.glb" },
    { id: "hand_right_thumb_2", src: "/unitree_g1/right_hand_thumb_2.glb" },
    { id: "hand_right_index_0", src: "/unitree_g1/right_hand_index_0.glb" },
    { id: "hand_right_index_1", src: "/unitree_g1/right_hand_index_1.glb" },
    { id: "hand_right_middle_0", src: "/unitree_g1/right_hand_middle_0.glb" },
    { id: "hand_right_middle_1", src: "/unitree_g1/right_hand_middle_1.glb" },
    { id: "hand_left_palm", src: "/unitree_g1/left_hand_palm.glb" },
    { id: "hand_left_thumb_0", src: "/unitree_g1/left_hand_thumb_0.glb" },
    { id: "hand_left_thumb_1", src: "/unitree_g1/left_hand_thumb_1.glb" },
    { id: "hand_left_thumb_2", src: "/unitree_g1/left_hand_thumb_2.glb" },
    { id: "hand_left_index_0", src: "/unitree_g1/left_hand_index_0.glb" },
    { id: "hand_left_index_1", src: "/unitree_g1/left_hand_index_1.glb" },
    { id: "hand_left_middle_0", src: "/unitree_g1/left_hand_middle_0.glb" },
    { id: "hand_left_middle_1", src: "/unitree_g1/left_hand_middle_1.glb" },
  ],

  unitree_g1_arm_left_body: [
    { id: "head", src: "/unitree_g1/head.glb" },
    { id: "torso", src: "/unitree_g1/torso.glb" },
    { id: "waist_yaw", src: "/unitree_g1/waist_yaw.glb" },
    { id: "waist_roll", src: "/unitree_g1/waist_roll.glb" },
    { id: "arm_left_j1", src: "/unitree_g1/left_shoulder_pitch.glb" },
    { id: "arm_left_j2", src: "/unitree_g1/left_shoulder_roll.glb" },
    { id: "arm_left_j3", src: "/unitree_g1/left_shoulder_yaw.glb" },
    { id: "arm_left_j4", src: "/unitree_g1/left_elbow.glb" },
    { id: "arm_left_j5", src: "/unitree_g1/left_wrist_roll.glb" },
    { id: "arm_left_j6", src: "/unitree_g1/left_wrist_pitch.glb" },
    { id: "arm_left_j7", src: "/unitree_g1/left_wrist_yaw.glb" },
    { id: "hand_left_palm", src: "/unitree_g1/left_hand_palm.glb" },
    { id: "hand_left_thumb_0", src: "/unitree_g1/left_hand_thumb_0.glb" },
    { id: "hand_left_thumb_1", src: "/unitree_g1/left_hand_thumb_1.glb" },
    { id: "hand_left_thumb_2", src: "/unitree_g1/left_hand_thumb_2.glb" },
    { id: "hand_left_index_0", src: "/unitree_g1/left_hand_index_0.glb" },
    { id: "hand_left_index_1", src: "/unitree_g1/left_hand_index_1.glb" },
    { id: "hand_left_middle_0", src: "/unitree_g1/left_hand_middle_0.glb" },
    { id: "hand_left_middle_1", src: "/unitree_g1/left_hand_middle_1.glb" },
  ],

};


const Assets = ({ robot_assets }) => {
  if (!robot_assets || robot_assets.length === 0) {
    console.warn("No robots provided in robot_assets.");
    return null;
  }

  return (
    <a-assets>
      {robot_assets.map(({ robotId, robot_model }) => {
        if (!robot_model) {
          console.warn(`No robot_model defined for robotId: ${robotId}`);
          return null;
        }

        const assets = robotAssets[robot_model];
        if (!assets) {
          console.warn(`No assets found for robot model: ${robot_model}`);
          return null;
        }

        return assets.map(({ id, src }) => (
          <a-asset-items key={`${robotId}_${id}`} id={`${robotId}_${id}`} src={src}></a-asset-items>
        ));
      })}
    </a-assets>
  );
};

export default Assets;