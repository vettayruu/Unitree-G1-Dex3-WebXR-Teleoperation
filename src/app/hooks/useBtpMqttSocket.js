import 'aframe'
import * as React from 'react'
import { idtopic, publishMQTT, subscribeMQTT } from '../../lib/MetaworkMQTT'
import { MQTT_DEVICE_TOPIC, MQTT_ROBOT_STATE_TOPIC, MQTT_ROBOT_SCAN_TOPIC  } from '../../lib/MetaworkMQTT';
import { io } from 'socket.io-client';
import {performTimeSync} from '../../lib/timeSync.js';

/* ============================= Static Global Variables ==========================================*/
const mr = require('../../modern_robotics/modern_robotics_core.js');

/* ============================= Main Component ==========================================*/
export default function useBtpMqttSocket(props) {
  const {
    setTimeOffset, timeOffsetRef,
    // Right Arm
    M_right, Slist_right,
    // Left Arm
    M_left, Slist_left,
    // Menu
    robotID, setRobotID,
    // Control Parameters
    setThetaBody, setThetaTool, setThetaBodyLeft,
    setThetaToolLeft, setThetaBodyCam, robot_state, setRobotState,
    // Get message from BTP Action by WebSocket
    setBTPActionMsg,
    // MQTT
    robotRequested, setRobotRequested
  } = props

  /*------------------------ Get message from BTP Action by WebSocket ---------------------------*/
  const socketRef = React.useRef(null);

  React.useEffect(() => {
    const wsurl = 'https://liust.local/ws';
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
}
