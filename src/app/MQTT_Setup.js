import { useEffect, useRef } from 'react';
import { connectMQTT, mqttclient, userUUID, subscribeMQTT, publishMQTT, Topic } from '../lib/MetaworkMQTT'

export default function MQTT_Setup({
  props,
  robotID: currentRobotID,   
  setRobotID,                
  btpActionMsg: setBtpActionMsg,
  robot_state: setRobotState,
  scanData: setScanData,

}) {

  const robotIDRef = useRef(null);

  useEffect(() => {
    robotIDRef.current = currentRobotID;
  }, [currentRobotID]);

  useEffect(() => {
    // connect to MQTT broker  
    if (typeof window.mqttClient === 'undefined') {
      window.mqttClient = connectMQTT();
      window.mqttClient.on('connect', () => {
        console.log('MQTT connected!');
        subscribeMQTT(Topic.DEVICE + userUUID); // Request Permission
      });
    }

    // define the joint handler for incoming messages
    const handler = (topic, message) => {
      let data;
      try {
        data = JSON.parse(message.toString());
      } catch (e) {
        console.warn("MQTT error:", message.toString());
        return;
      }
      
      if (topic === Topic.DEVICE + userUUID) {
        if (data.type != undefined) {
          console.log("Robot Requested!")
          console.log("Type:", data.type);
          console.log("devId:", data.devId);

          // Store robotID in ref and state
          robotIDRef.current = data.devId;
          setRobotID(data.devId);

          // Subscribe to robot state and scan topics
          subscribeMQTT(Topic.ROBOT_STATE + data.devId);
          subscribeMQTT(Topic.ROBOT_SCAN + data.devId);

        } else if (data.type == undefined){
          console.warn("Robot Request Failed. No Robot Available.")
          setRobotID(null);
        }
        return;
      }

      /* Robot State Subscription */
      if (!props.viewer && topic === Topic.ROBOT_STATE + robotIDRef.current) {
          setRobotState(data);
      }
      
      if (!props.viewer && topic === Topic.ROBOT_SCAN + robotIDRef.current) {
          setScanData(data);
          console.log("Received Scan Data:", data);
      }

  };

  window.mqttClient.on('message', handler);

  // Unregister on page unload
  const handleBeforeUnload = () => {
    if (mqttclient != undefined) {

      publishMQTT(Topic.DEVICE + robotIDRef.current, JSON.stringify({ controller: "browser", devId: userUUID + "-unregister" }), 1)
      robotIDRef.current = null;
      
      // Unregister
      publishMQTT(
        Topic.UNREGISTER, 
        JSON.stringify({ time: Date.now(), devId: userUUID }),
        1
      );
      
    }
  };
  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    window.mqttClient.off('message', handler);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}, []);}
