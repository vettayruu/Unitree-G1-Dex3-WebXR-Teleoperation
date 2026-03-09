"use client";
import mqtt from 'mqtt'
import package_info from '../../package.json' // load version
import {userUUID} from './cookie_id';

export const codeType = package_info.name; // software name
export const version = package_info.version; // version number
export const robotid = package_info.customInfo.robotid; // request robot id, currently same as codeType, but can be different in the future
console.log("Code Type:", codeType);
console.log("Version:", version);
console.log("Request Robot ID:", robotid);

// global private variable
export var mqttclient = null;
export var idtopic = userUUID;

// const MQTT_BROKER_URL = "wss://sora2.uclab.jp/mqws"; // For Nagoya-U UCLab Development
const MQTT_BROKER_URL = "wss://192.168.197.36:8333"; // For Local Development, change to your broker address

export const connectMQTT = (callback) => {
    if (mqttclient == null) {
        const client = new mqtt.connect(MQTT_BROKER_URL, {protocolVersion: 5}); 
        client.on("connect", () => {
            console.log("MQTT Connected", client);

            const date = new Date();
            var devType = "browser";
            if(window.location.pathname.endsWith("/viewer/")) {
                devType = "robot";
            }
            const info = {
                date: date.toLocaleString(),
                device: {
                    //browser: navigator.appName,
                    //version: navigator.appVersion,
                    agent: navigator.userAgent,
                    //platform: navigator.platform,
                    cookie: navigator.cookieEnabled
                },
                devType: devType,
                codeType: codeType,
                version: version,
                devId: userUUID
            }
            // this is Metawork-MQTT protocol
            client.publish('mgr/register', JSON.stringify(info)) // for other devices.// maybe retransmit each 10seconds
            client.subscribe('dev/'+userUUID, {noLocal: true}, (err, granted) => {
                if (!err) {
                    console.log('MQTT Subscribe Granted',  granted);
                } else {
                    console.error('MQTT Subscription error: ', err);
                }
            });
            callback && callback(client);

        });
        client.on('error', function (err) {
            console.error('MQTT Connection error: ');
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

export const publishMQTT = (topic, msg) => {
    mqttclient.publish(topic, msg);
}