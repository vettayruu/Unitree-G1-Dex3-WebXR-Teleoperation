import * as React from 'react';
import Sora from "sora-js-sdk";

// WebRTC setup (change to your signaling URL and channel IDs)
const signalingUrl = 'wss://sora2.uclab.jp/signaling'; 
 
const recv_channel_1 = 'sora_liust_left';
const recv_channel_2 = 'sora_liust_right';
const recv_channel_3 = 'sora_liust_sub';

const send_channel_1 = 'sora_liust_vr_left';
const send_channel_2 = 'sora_liust_vr_right';

export const soraConfig = {
  signalingUrl: 'wss://sora2.uclab.jp/signaling',
  recv_channel_1: 'sora_liust_left',
  recv_channel_2: 'sora_liust_right',
  recv_channel_3: 'sora_liust_sub',
  send_channel_1: 'sora_liust_vr_left',
  send_channel_2: 'sora_liust_vr_right'
};

const sora = Sora.connection(signalingUrl);

// Receive video streams
export function WebRTC_Video_Recv({ onVideoStream1, onVideoStream2, onVideoStream3 }) {
  React.useEffect(() => {
    const options = {
      role: 'recvonly',
      multistream: false,
      video: { codecType: 'VP8', resolution: '720p', bitrate: 5000 },
      audio: false,
    };

    // Webcam 1 (Stereo Left)
    const recvonly_webcam1 = sora.recvonly(recv_channel_1, options);
    recvonly_webcam1.on('track', event => {
      if (event.track.kind === 'video') {
        const mediaStream = new MediaStream();
        mediaStream.addTrack(event.track);
        if (onVideoStream1) onVideoStream1(mediaStream);
      }
    });
    recvonly_webcam1.connect();

    // Webcam 2 (Stereo Right)
    const recvonly_webcam2 = sora.recvonly(recv_channel_2, options);
    recvonly_webcam2.on('track', event => {
      if (event.track.kind === 'video') {
        const mediaStream = new MediaStream();
        mediaStream.addTrack(event.track);
        if (onVideoStream2) onVideoStream2(mediaStream);
      }
    });
    recvonly_webcam2.connect();

    // Webcam 3 (External Sub Camera)
    const recvonly_webcam3 = sora.recvonly(recv_channel_3, options);
    recvonly_webcam3.on('track', event => {
      if (event.track.kind === 'video') {
        const mediaStream = new MediaStream();
        mediaStream.addTrack(event.track);
        if (onVideoStream3) onVideoStream3(mediaStream);
      }
    });
    recvonly_webcam3.connect();

    // Cleanup function
    return () => {
      recvonly_webcam1.disconnect();
      recvonly_webcam2.disconnect();
      recvonly_webcam3.disconnect();
    };
  }, [onVideoStream1, onVideoStream2, onVideoStream3]);

  return null; 
}

// Send video streams (Video Only)
export function WebRTC_Video_Send({ VR_Left_Stream, VR_Right_Stream }) {
  const leftConnectionRef = React.useRef(null);
  const rightConnectionRef = React.useRef(null);
  const leftSoraRef = React.useRef(null);
  const rightSoraRef = React.useRef(null);

  React.useEffect(() => {
    console.log('🔄 Initializing VR video send connections...');

    const options = {
      multistream: false,
      video: { codecType: 'VP8', resolution: '720p', bitrate: 5000 },
      audio: false,
    };

    // VR Left Eye Stream
    if (VR_Left_Stream) {
      console.log('📹 Connecting VR Left Eye stream...');
      
      // Sora connection
      leftSoraRef.current = Sora.connection(signalingUrl, true);
      const sendonly_vr_left = leftSoraRef.current.sendonly(
        send_channel_1,
        undefined, // metadata
        options
      );

      sendonly_vr_left.on('track', (event) => {
        console.log('✅ VR Left Eye track event:', event);
      });

      sendonly_vr_left.on('removetrack', (event) => {
        console.log('🔌 VR Left Eye removetrack:', event);
      });

      sendonly_vr_left.connect(VR_Left_Stream).then(() => {
        console.log('✅ VR Left Eye connected');
      }).catch(err => {
        console.error('❌ VR Left Eye connection failed:', err);
      });

      leftConnectionRef.current = sendonly_vr_left;
    }

    // VR Right Eye Stream
    if (VR_Right_Stream) {
      console.log('📹 Connecting VR Right Eye stream...');
      
      // Sora connection
      rightSoraRef.current = Sora.connection(signalingUrl, true);
      const sendonly_vr_right = rightSoraRef.current.sendonly(
        send_channel_2,
        undefined, // metadata
        options
      );

      sendonly_vr_right.on('track', (event) => {
        console.log('✅ VR Right Eye track event:', event);
      });

      sendonly_vr_right.on('removetrack', (event) => {
        console.log('🔌 VR Right Eye removetrack:', event);
      });

      sendonly_vr_right.connect(VR_Right_Stream).then(() => {
        console.log('✅ VR Right Eye connected');
      }).catch(err => {
        console.error('❌ VR Right Eye connection failed:', err);
      });

      rightConnectionRef.current = sendonly_vr_right;
    }

    // Cleanup function
    return () => {
      console.log('🛑 Cleaning up VR video send connections...');
      if (leftConnectionRef.current) {
        leftConnectionRef.current.disconnect();
        leftConnectionRef.current = null;
      }
      if (rightConnectionRef.current) {
        rightConnectionRef.current.disconnect();
        rightConnectionRef.current = null;
      }
      leftSoraRef.current = null;
      rightSoraRef.current = null;
    };
  }, [VR_Left_Stream, VR_Right_Stream]);

  return null;
}

// Send Video and and Sendrecv Message via DataChannel 
export function WebRTC_Video_Send_Data({ VR_Left_Stream, VR_Right_Stream, controlData, recvData }) {
  const leftConnectionRef = React.useRef(null);
  const rightConnectionRef = React.useRef(null);
  const leftSoraRef = React.useRef(null);
  const rightSoraRef = React.useRef(null);
  const leftDataChannelReadyRef = React.useRef(false);
  const rightDataChannelReadyRef = React.useRef(false);

  const sendControlData = React.useCallback(async (data) => {
    const payload = JSON.stringify(data);
    const encodedData = new TextEncoder().encode(payload);
    
    try {
      if (leftConnectionRef.current && leftDataChannelReadyRef.current) {
        await leftConnectionRef.current.sendMessage('#control', encodedData);
        console.log('📤 Sent via Left DataChannel:', payload);
      }
      
      if (rightConnectionRef.current && rightDataChannelReadyRef.current) {
        await rightConnectionRef.current.sendMessage('#control', encodedData);
        console.log('📤 Sent via Right DataChannel:', payload);
      }
    } catch (err) {
      console.error('❌ Failed to send message:', err);
    }
  }, []);

  // Send Data
  React.useEffect(() => {
    if (controlData) {
      sendControlData(controlData);
    }
  }, [controlData, sendControlData]);

  // Receive Data
  // React.useEffect(() => {
  //   if (recvData) {
  //     sendControlData(recvData);
  //   }
  // }, [recvData]);

  React.useEffect(() => {
    console.log('🔄 Initializing VR video send connections with DataChannel...');

    const options = {
      multistream: false,
      video: { codecType: 'VP8' },
      audio: false,
      dataChannelSignaling: true, // must enable DataChannel signaling
      dataChannels: [
        {
          label: '#control', // label must start with #
          direction: 'sendrecv',
          // maxPacketLifeTime: 60000,
          ordered: true,
        }
      ]
    };

    // VR Left Eye Stream + DataChannel
    if (VR_Left_Stream) {
      console.log('📹 Connecting VR Left Eye stream with DataChannel...');
      
      leftSoraRef.current = Sora.connection(signalingUrl, true);
      const sendrecv_vr_left = leftSoraRef.current.sendrecv(
        send_channel_1,
        undefined,
        options
      );

      sendrecv_vr_left.on('datachannel', (event) => {
        const label = event.label;
        console.log('📡 Left DataChannel opened:', label);
        leftDataChannelReadyRef.current = true;
      });

      sendrecv_vr_left.on('message', (event) => {
        const label = event.label;
        const data = new TextDecoder().decode(event.data);
        console.log('📥 Left DataChannel received:', label, data);
      });

      sendrecv_vr_left.on('track', (event) => {
        console.log('✅ VR Left Eye track event:', event);
      });

      sendrecv_vr_left.connect(VR_Left_Stream).then(() => {
        console.log('✅ VR Left Eye connected');
      }).catch(err => {
        console.error('❌ VR Left Eye connection failed:', err);
      });

      leftConnectionRef.current = sendrecv_vr_left;
    }

    // VR Right Eye Stream + DataChannel
    if (VR_Right_Stream) {
      console.log('📹 Connecting VR Right Eye stream with DataChannel...');
      
      rightSoraRef.current = Sora.connection(signalingUrl, true);
      const sendrecv_vr_right = rightSoraRef.current.sendrecv(
        send_channel_2,
        undefined,
        options
      );

      sendrecv_vr_right.on('datachannel', (event) => {
        const label = event.label;
        console.log('📡 Right DataChannel opened:', label);
        rightDataChannelReadyRef.current = true;
      });

      sendrecv_vr_right.on('message', (event) => {
        const label = event.label;
        const data = new TextDecoder().decode(event.data);
        console.log('📥 Right DataChannel received:', label, data);
      });

      sendrecv_vr_right.on('track', (event) => {
        console.log('✅ VR Right Eye track event:', event);
      });

      sendrecv_vr_right.connect(VR_Right_Stream).then(() => {
        console.log('✅ VR Right Eye connected');
      }).catch(err => {
        console.error('❌ VR Right Eye connection failed:', err);
      });

      rightConnectionRef.current = sendrecv_vr_right;
    }

    return () => {
      console.log('🛑 Cleaning up VR video send connections...');
      
      if (leftConnectionRef.current) {
        leftConnectionRef.current.disconnect();
        leftConnectionRef.current = null;
      }
      if (rightConnectionRef.current) {
        rightConnectionRef.current.disconnect();
        rightConnectionRef.current = null;
      }
      
      leftDataChannelReadyRef.current = false;
      rightDataChannelReadyRef.current = false;
      leftSoraRef.current = null;
      rightSoraRef.current = null;
    };
  }, [VR_Left_Stream, VR_Right_Stream]);

  return null;
}

// Receive Message via DataChannel
export function WebRTC_Data_Recv({ channelId, onControlData }) {
  const connectionRef = React.useRef(null);
  const soraRef = React.useRef(null);

  React.useEffect(() => {
    console.log(`🔄 Initializing data receive connection for channel: ${channelId}...`);

    const options = {
      multistream: false,
      dataChannelSignaling: true,
      dataChannels: [
        {
          label: '#message',
          direction: 'sendrecv',
          ordered: true,
        }
      ]
    };

    soraRef.current = Sora.connection(signalingUrl, true);
    const recvonly = soraRef.current.recvonly(channelId, undefined, options);

    recvonly.on('datachannel', (event) => {
      console.log('📡 DataChannel opened:', event.label);
    });

    recvonly.on('message', (event) => {
      try {
        const data = new TextDecoder().decode(event.data);
        const parsedData = JSON.parse(data);
        console.log('📥 Received control data:', parsedData);
        if (onControlData) onControlData(parsedData);
      } catch (err) {
        console.error('❌ Failed to parse control data:', err);
      }
    });

    recvonly.connect().then(() => {
      console.log('✅ Data receive connected');
    }).catch(err => {
      console.error('❌ Data receive connection failed:', err);
    });

    connectionRef.current = recvonly;

    return () => {
      console.log('🛑 Cleaning up data receive connection...');
      if (connectionRef.current) {
        connectionRef.current.disconnect();
        connectionRef.current = null;
      }
      soraRef.current = null;
    };
  }, [channelId, onControlData]);

  return null;
}

