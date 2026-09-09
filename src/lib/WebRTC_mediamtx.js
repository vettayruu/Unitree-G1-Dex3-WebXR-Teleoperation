import React from 'react';
const channelId = 'g1-vr180'; 
const whepUrl = `https://192.168.207.161/vrstream/${channelId}/whep`;


export function WebRTC_G1_VRCam({ onVideoStream1 }) {
  React.useEffect(() => {
    let pc = null;

    const startWhepSession = async () => {
      try {
        pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' } 
          ]
        });

        pc.addTransceiver('video', { direction: 'recvonly' });

        pc.ontrack = (event) => {
          if (event.track.kind === 'video') {
            const mediaStream = event.streams[0] || new MediaStream([event.track]);
            if (onVideoStream1) {
              onVideoStream1(mediaStream);
            }
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const response = await fetch(whepUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/sdp'
          },
          body: offer.sdp
        });

        if (!response.ok) {
          throw new Error(`MediaMTX WHEP Handshake Failed, HTTP status: ${response.status}`);
        }

        const answerSdp = await response.text();
        await pc.setRemoteDescription({
          type: 'answer',
          sdp: answerSdp
        });

      } catch (err) {
        console.error("MediaMTX WHEP connection failed:", err);
      }
    };

    startWhepSession();

    return () => {
      if (pc) {
        pc.close();
        pc = null;
      }
    };
  }, [onVideoStream1]);

  return null;
}