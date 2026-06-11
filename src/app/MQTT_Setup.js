import { useEffect, useRef } from 'react';
import { connectMQTT, mqttclient, idtopic, subscribeMQTT, publishMQTT, codeType, version } from '../lib/MetaworkMQTT'
import { MQTT_REGISTER_TOPIC, MQTT_UNREGISTER_TOPIC, MQTT_DEVICE_TOPIC, MQTT_CTRL_TOPIC, MQTT_ROBOT_STATE_TOPIC, MQTT_ROBOT_SCAN_TOPIC} from '../lib/MetaworkMQTT';

export default function MQTT_Setup({
  // MQTT Client and Topics
  props,
  requestRobot,
  robotID: setRobotID,
  btpActionMsg: setBtpActionMsg,

  // Robot State
  robot_state: setRobotState,
  scan_data: setScanData,

}) {

  const robotIDRef = useRef(null);
  const SAP_WT_TOPIC = "sap/matching/I55834";

  useEffect(() => {
    // connect to MQTT broker  
    if (typeof window.mqttClient === 'undefined') {
      // window.mqttClient = connectMQTT(requestRobot);
      window.mqttClient = connectMQTT();
      window.mqttClient.on('connect', () => {
        console.log('MQTT connected!');
        subscribeMQTT(MQTT_DEVICE_TOPIC + idtopic); // Request Permission
        // subscribeMQTT(SAP_WT_TOPIC); // Subscribe to BTP Action Topic
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
      
      if (topic === MQTT_DEVICE_TOPIC + idtopic) {
        if (data.type != undefined) {
          console.log("Robot Requested!")
          console.log("Type:", data.type);
          console.log("devId:", data.devId);

          // Store robotID in ref and state
          robotIDRef.current = data.devId;
          setRobotID(data.devId);

          // Subscribe to robot state and scan topics
          subscribeMQTT(MQTT_ROBOT_STATE_TOPIC + data.devId);
          subscribeMQTT(MQTT_ROBOT_SCAN_TOPIC + data.devId);

        } else if (data.type == undefined){
          console.warn("Robot Request Failed. No Robot Available.")
          setRobotID(null);
        }
        return;
      }

      /* Robot State Subscription */
      if (!props.viewer && topic === MQTT_ROBOT_STATE_TOPIC + robotIDRef.current) {
          setRobotState(data);
      }
      
      if (!props.viewer && topic === MQTT_ROBOT_SCAN_TOPIC + robotIDRef.current) {
          setScanData(data);
          console.log("Received Scan Data:", data);
      }

      if (topic === SAP_WT_TOPIC) {
        console.log("Message from BTP Action:", data);
        setBtpActionMsg(data);
        return;
      }

  };

  window.mqttClient.on('message', handler);

  // Unregister on page unload
  const handleBeforeUnload = () => {
    if (mqttclient != undefined) {

      publishMQTT(MQTT_DEVICE_TOPIC + robotIDRef.current, JSON.stringify({ controller: "browser", devId: idtopic + "-unregister" }), 1)
      robotIDRef.current = null;
      
      // Unregister
      publishMQTT(
        MQTT_UNREGISTER_TOPIC, 
        JSON.stringify({ time: Date.now(), devId: idtopic }),
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
