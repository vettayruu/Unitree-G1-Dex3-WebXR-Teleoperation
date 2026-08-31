"use client";
import mqtt from 'mqtt'
import package_info from '../../package.json' // load version
import {userUUID} from './cookie_id';

// export const codeType = package_info.name; // software name
export const codeType = package_info.customInfo.type; 
export const version = package_info.version; // version number
console.log("Robot Type:", codeType);

// global private variable
export var mqttclient = null;
export var idtopic = userUUID;
export const currentIP = typeof window !== 'undefined' ? window.location.hostname : '';
console.log("Current IP:", currentIP);

const MQTT_BROKER_URL = "wss://sora2.uclab.jp/mqws"; // For Nagoya-U UCLab Development
// const MQTT_BROKER_URL = "wss://santolina/mqtt"; // For Local Development, change to your broker address
// const MQTT_BROKER_URL = "wss://133.6.254.50/mqtt"; // For Internet Development, change to your broker address
// const MQTT_BROKER_URL = "wss://liust.local/mqtt";

export var mqttBrokerURL = MQTT_BROKER_URL;

export const MQTT_REGISTER_TOPIC = 'sap/register';
export const MQTT_UNREGISTER_TOPIC = 'sap/unregister';
export const MQTT_REQUEST_TOPIC = "sap/request";
export const MQTT_UNREQUEST_TOPIC = "sap/unrequest";
export const MQTT_DEVICE_TOPIC = 'sap/dev/'
export const MQTT_CTRL_TOPIC = 'control/'
export const MQTT_ROBOT_STATE_TOPIC = 'robot/'
export const MQTT_ROBOT_SCAN_TOPIC = 'scan/'
export const MQTT_ROBOT_DATA_TOPIC = 'data/'

export const connectMQTT = (callback) => {
    if (mqttclient == null) {
        const client = new mqtt.connect(MQTT_BROKER_URL, {
            protocolVersion: 5,

        });

        client.on("connect", () => {
            console.log("MQTT Connected", client);

            const date = new Date();
            // var devType = "browser";
            // if(window.location.pathname.endsWith("/viewer/")) {
            //     devType = "robot";
            // }
            const info = {
                date: date.toLocaleString(),
                // device: {
                //     //browser: navigator.appName,
                //     //version: navigator.appVersion,
                //     agent: navigator.userAgent,
                //     //platform: navigator.platform,
                //     cookie: navigator.cookieEnabled
                // },
                devType: "browser",
                type: codeType,
                version: version,
                devId: userUUID,
                optStr: "available"
            }

            // Register device info to MQTT manager. 
            client.publish(MQTT_REGISTER_TOPIC, JSON.stringify(info)) 

            // Subscribe to the device topic to receive robotID
            client.subscribe(MQTT_DEVICE_TOPIC+ userUUID, {noLocal: true}, (err, granted) => {
                if (!err) {
                    console.log('MQTT Subscribe Granted',  granted);
                } else {
                    console.error('MQTT Subscription error: ', err);
                }
            });
            callback && callback(client);

        });
        client.on('error', function (err) {
            console.error('MQTT Connection error: ', err);
        });
        mqttclient = client;
    }
    return mqttclient
}

export const subscribeMQTT = (topic) => {
    if (mqttclient == null) {
        console.error('MQTT client not connected!');
        return;
    }
    mqttclient.subscribe(topic, {noLocal: true}, (err, granted) => {
        if (!err) {
            console.log('MQTT Subscribe topics', topic, granted);
        } else {
            console.error('MQTT Subscription error: ', err);
        }
    });
}

export const publishMQTT = (topic, msg, qos) => {
    mqttclient.publish(topic, msg, {qos: qos});
}