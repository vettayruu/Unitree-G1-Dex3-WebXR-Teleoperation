import { useEffect } from 'react';
import { connectMQTT, mqttclient, idtopic, subscribeMQTT, publishMQTT, codeType } from '../lib/MetaworkMQTT'

export default function MQTT_Sub({
  // MQTT Client and Topics
  props,
  requestRobot,
  robotIDRef,
  MQTT_DEVICE_TOPIC,
  MQTT_CTRL_TOPIC,
  MQTT_ROBOT_STATE_TOPIC,

  // Right Arm
  thetaBodyMQTT,
  thetaToolMQTT,
  thetaBodyFeedback,
  robot_state,

  // Left Arm
  thetaBodyLeftMQTT,
  thetaToolLeftMQTT,
  thetaBodyLeftFeedback,
  robot_state_left,

  // Cam Arm
  thetaBodyCamMQTT,
  thetaBodyCamFeedback,
  robot_state_cam

}) {
  useEffect(() => {
  // connect to MQTT broker  
  if (typeof window.mqttClient === 'undefined') {
    window.mqttClient = connectMQTT(requestRobot);
    window.mqttClient.on('connect', () => {
      subscribeMQTT(MQTT_DEVICE_TOPIC);
      subscribeMQTT(MQTT_CTRL_TOPIC + idtopic);
      subscribeMQTT(MQTT_ROBOT_STATE_TOPIC + idtopic);
    });
  }

  // define the joint handler for incoming messages
  const handler = (topic, message) => {
    let data;
    // console.log("Recived MQTT Message:", topic, message.toString());
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

    /* Robot State Subscription */
    if (!props.viewer && topic === MQTT_ROBOT_STATE_TOPIC + robotIDRef.current) {
      /* Right Arm */
      if (data.state != undefined) {
        console.log("Right Arm State:", data.state);
        robot_state(data.state);
      }
      if (data.model != undefined) {
        console.log("Right Arm Model:", data.model);
      }
      if (data.joint_feedback != undefined) {
        thetaBodyFeedback(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(data.joint_feedback)) {
            return data.joint_feedback;
          }
          // console.log("From:", topic, "Recive Right Arm Joint Feedback:", data.joint_feedback);
          return prev;
        });
      }
      if (data.tool != undefined) {
        // console.log("Right Arm Current Tool Action:", data.tool);
      }
    
      /* Left Arm */
      if (data.state_left != undefined) {
          console.log("Left Arm State:", data.state_left);
          robot_state_left(data.state_left);
        }
      if (data.model_left != undefined) {
          console.log("Left Arm Model:", data.model_left);
        }
      if (data.joint_feedback_left != undefined) {
        thetaBodyLeftFeedback(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(data.joint_feedback_left)) {
            return data.joint_feedback_left;
          }
          // console.log("From:", topic, "Recive Left Arm Joint Feedback Left:", data.joint_feedback_left);
          return prev;
        });
      }
      if (data.tool_left != undefined) {
        // console.log("Left Arm Current Tool Action:", data.tool_left);
      }

      /* Cam Arm */
      if (data.state_cam != undefined) {
        console.log("Cam Arm State:", data.state_cam);
        robot_state_cam(data.state_cam);
      }
      if (data.model_cam != undefined) {
        console.log("Cam Arm Model:", data.model_cam);
      }
      if (data.joint_feedback_cam != undefined) {
        thetaBodyCamFeedback(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(data.joint_feedback_cam)) {
            return data.joint_feedback_cam;
          }
          // console.log("From:", topic, "Recive Cam Arm Joint Feedback:", data.joint_feedback_cam);
          return prev;
        });
      }
      
    }
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
