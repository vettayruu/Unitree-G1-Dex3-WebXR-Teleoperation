import React from 'react';
const channelId = 'g1-vr180'; 
const whepUrl = `https://192.168.207.161/vrstream/${channelId}/whep`;

export const WebRTC_Config = {
  URL: whepUrl,
  CHANNEL: channelId
};

export function WebRTC_G1_VRCam({
  showVideo,
  onVideoStream1
}) {
  React.useEffect(() => {
    let pc = null;
    let stopped = false;

    const startWhepSession = async () => {
      if (!showVideo) {
        console.log("WebRTC video disabled");
        return;
      }

      try {
        console.log("Starting MediaMTX WHEP session...");
        pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        });

        pc.addTransceiver('video', {
          direction: 'recvonly'
        });

        pc.ontrack = (event) => {
          if (stopped) return;

          if (event.track.kind === 'video') {
            const mediaStream =
              event.streams[0] ||
              new MediaStream([event.track]);

            console.log("Received video stream");

            if (onVideoStream1) {
              onVideoStream1(mediaStream);
            }
          }
        };

        pc.onconnectionstatechange = () => {
          console.log(
            "WebRTC connection state:",
            pc?.connectionState
          );
        };

        const offer = await pc.createOffer();

        if (stopped) return;

        await pc.setLocalDescription(offer);

        const response = await fetch(whepUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/sdp'
          },
          body: offer.sdp
        });

        if (!response.ok) {
          throw new Error(
            `MediaMTX WHEP Handshake Failed, HTTP status: ${response.status}`
          );
        }

        const answerSdp = await response.text();

        if (stopped) return;

        await pc.setRemoteDescription({
          type: 'answer',
          sdp: answerSdp
        });

        console.log("MediaMTX WHEP connected");

      } catch (err) {
        if (!stopped) {
          console.error(
            "MediaMTX WHEP connection failed:",
            err
          );
        }
      }
    };

    startWhepSession();

    // Cleanup
    return () => {
      stopped = true;
      console.log("Stopping MediaMTX WHEP session...");
      if (pc) {
        pc.getReceivers().forEach((receiver) => {
          if (receiver.track) {
            receiver.track.stop();
          }
        });
        pc.close();
        pc = null;
      }

      if (onVideoStream1) {
        onVideoStream1(null);
      }
    };

  }, [showVideo, onVideoStream1]);

  return null;
}
