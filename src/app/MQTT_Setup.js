import { useEffect, useRef } from 'react';
import { connectMQTT, mqttclient, idtopic, subscribeMQTT, publishMQTT, codeType } from '../lib/MetaworkMQTT'

export default function MQTT_Setup({
  // MQTT Client and Topics
  props,
  requestRobot,
  robotID: setRobotID,
  MQTT_DEVICE_TOPIC,
  MQTT_CTRL_TOPIC,
  MQTT_ROBOT_STATE_TOPIC,

  // Robot State
  robot_state: setRobotState,

}) {

  const robotIDRef = useRef(null);

  useEffect(() => {
    // connect to MQTT broker  
    if (typeof window.mqttClient === 'undefined') {
      window.mqttClient = connectMQTT(requestRobot);
      window.mqttClient.on('connect', () => {
        console.log('MQTT connected!');
        subscribeMQTT(MQTT_DEVICE_TOPIC); // Request Permission
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
      
      if (topic === MQTT_DEVICE_TOPIC) {
        if (data.type != undefined) {
          console.log("Robot Requested!")
          console.log("Type:", data.type);
          console.log("devId:", data.devId);
          robotIDRef.current = data.devId;
          setRobotID(data.devId);
          subscribeMQTT(MQTT_ROBOT_STATE_TOPIC + data.devId);
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

  };

  window.mqttClient.on('message', handler);

  // Unregister on page unload
  const handleBeforeUnload = () => {
    if (mqttclient != undefined) {
      publishMQTT(
        "mgr/unregister", 
        JSON.stringify({ 
          time: Date.now(),
          devId: idtopic 
        }),
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
