"use client";
import * as React from 'react'
import "./web_interface.css";
import { userUUID, MQTT_BROKER_URL } from '../lib/MetaworkMQTT'
import { soraConfig } from '../lib/WebRTC_Sora';

function rad2deg(rad) {
    if (Array.isArray(rad)) {
        return rad.map(r => rad2deg(r));
    }
    return rad * (180 / Math.PI);
}

function deg2rad(deg) {
    if (Array.isArray(deg)) {
        return deg.map(d => deg2rad(d));
    }
    return deg * (Math.PI / 180);
}

function JointAngleTable({ title, thetas, names }) {
  return (
    <table className="table table-sm joint-angle-table">
      <thead>
        <tr>
          <th colSpan={2}>{title}</th>
        </tr>
      </thead>
      <tbody>
        {thetas.map((theta, idx) => (
          <tr key={idx}>
            <td>{names?.[idx] ?? `joint_${idx}`}</td>
            <td>{rad2deg(theta).toFixed(2)}°</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const RIGHT_ARM_JOINT_NAMES = [
  '0.N/A',
  '1.Shoulder_Pitch',
  '2.Shoulder_Roll',
  '3.Shoulder_Yaw',
  '4.Elbow',
  '5.Wrist_Roll',
  '6.Wrist_Pitch',
  '7.Wrist_Yaw',
];

const LEFT_ARM_JOINT_NAMES = [
  '0.N/A',
  '1.Shoulder_Pitch',
  '2.Shoulder_Roll',
  '3.Shoulder_Yaw',
  '4.Elbow',
  '5.Wrist_Roll',
  '6.Wrist_Pitch',
  '7.Wrist_Yaw',
];

const TORSO_JOINT_NAMES = ['1.Waist_Yaw', '2.Waist_Pitch', '3.Waist_Roll'];

export default function WebInterface(props) {
  return (
    <>
      <div className="mqtt-broker">
        MQTT Broker URL: <span>{MQTT_BROKER_URL}</span> \n
        Time Offset: <span>{props.time_offset} ms</span>
      </div>

      <div className="user-uuid">
        USER ID: <span>{userUUID}</span>
      </div>

      <div className="webrtc-channel">
        WebRTC Signaling Url: <span>{soraConfig.signalingUrl}</span><br/>
        Recv Channel 1 (G1 VRCam): <span>{soraConfig.G1_VRCAM_CHANNEL}</span><br/>
      </div>

      <div className="robot-id">
        Robot ID: <span> {props.robotID} </span>
      </div>

      <div className="request-robot">
        <button onClick={props.requestRobot}>
          Request Robot
        </button>
      </div>

      <div className="unrequest-robot">
        <button onClick={props.unrequestRobot}>
          Release Robot
        </button>
      </div>

      <div className="right-arm joint-angle-panel">
        <JointAngleTable title="Right Arm" thetas={props.theta_body} names={RIGHT_ARM_JOINT_NAMES} />
      </div>
      <div className="left-arm joint-angle-panel">
        <JointAngleTable title="Left Arm" thetas={props.theta_body_left} names={LEFT_ARM_JOINT_NAMES} />
      </div>
      <div className="torso joint-angle-panel">
        <JointAngleTable title="Torso" thetas={props.theta_body_cam} names={TORSO_JOINT_NAMES} />
      </div>
    </>
    )
  }