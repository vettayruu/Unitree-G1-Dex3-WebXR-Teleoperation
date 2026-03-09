import { useEffect } from 'react';
import { connectMQTT, mqttclient, idtopic, subscribeMQTT, publishMQTT, codeType } from '../lib/MetaworkMQTT'

export default function MQTT_Setup({
  // MQTT Client and Topics
  props,
  requestRobot,
  robotIDRef,
  MQTT_DEVICE_TOPIC,
  MQTT_CTRL_TOPIC,
  MQTT_ROBOT_STATE_TOPIC,

  // Robot State
  robot_state: setRobotState,

}) {
  useEffect(() => {
    // connect to MQTT broker  
    if (typeof window.mqttClient === 'undefined') {
      window.mqttClient = connectMQTT(requestRobot);
      window.mqttClient.on('connect', () => {
        console.log('MQTT connected!');
        subscribeMQTT(MQTT_DEVICE_TOPIC);
        subscribeMQTT(MQTT_CTRL_TOPIC + idtopic);
        subscribeMQTT(MQTT_ROBOT_STATE_TOPIC + idtopic);
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
        if (data.devId != undefined) {
          robotIDRef.current = data.devId;
          subscribeMQTT(MQTT_CTRL_TOPIC + data.devId);
          subscribeMQTT(MQTT_ROBOT_STATE_TOPIC + data.devId);
        }
        return;
    }

    /* Robot State Subscription */
    if (!props.viewer && topic === MQTT_ROBOT_STATE_TOPIC + robotIDRef.current) {
        setRobotState(data);
    } 

    /* Viewer Subscription */
    // if (props.viewer && topic === MQTT_CTRL_TOPIC + robotIDRef.current) {
    //   /* Right Arm */
    //   if (data.joint != undefined) {
    //     thetaBodyMQTT(prev => {
    //       if (JSON.stringify(prev) !== JSON.stringify(data.joint)) {
    //         return data.joint;
    //       }
    //       console.log("Time:", data.time, "From:", topic, "Send Joint Body Right:", data.joint);
    //       return prev;
    //     });
    //   }
    //   if (data.tool != undefined) {
    //     thetaToolMQTT(prev => {
    //       if (JSON.stringify(prev) !== JSON.stringify(data.tool)) {
    //         return data.tool;
    //       }
    //       // console.log("Time:", data.time, "From:", topic, "Send Joint Tool:", data.tool);
    //       return prev;
    //     });
    //   }

    //   /* Left Arm */
    //   if (data.joint_left != undefined) {
    //     thetaBodyLeftMQTT(prev => {
    //       if (JSON.stringify(prev) !== JSON.stringify(data.joint_left)) {
    //         return data.joint_left;
    //       }
    //       // console.log("Time:", data.time, "From:", topic, "Send Joint Body Left:", data.joint_left);
    //       return prev;
    //     });
    //   }
    //   if (data.tool_left != undefined) {
    //     thetaToolLeftMQTT(prev => {
    //       if (JSON.stringify(prev) !== JSON.stringify(data.tool_left)) {
    //         return data.tool_left;
    //       }
    //       // console.log("Time:", data.time, "From:", topic, "Send Joint Tool Left:", data.tool_left);
    //       return prev;
    //     });
    //   }

    //   /* Cam Arm */
    //   if (data.cam != undefined) {
    //     thetaBodyCamMQTT(prev => {
    //       if (JSON.stringify(prev) !== JSON.stringify(data.cam)) {
    //         return data.cam;
    //       }
    //       console.log("Time:", data.time, "From:", topic, "Send Joint Body Cam:", data.cam);
    //       return prev;
    //     });
    //   }
    // }

  };

  window.mqttClient.on('message', handler);

  const handleBeforeUnload = () => {
    if (mqttclient != undefined) {
      publishMQTT("mgr/unregister", JSON.stringify({ 
        time: Date.now(),
        devId: idtopic 
      }));
    }
  };
  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    window.mqttClient.off('message', handler);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}, []);}
