import React from 'react';

export default function VideoView(props) {
  const {
    showVideo,
    setVrcamPosition,
    setVrcamRotation,
  } = props;

  const [timenow, now] = React.useState(Date.now());
  // Webcam Stream
  React.useEffect(() => {
    if (props.webcamStream1 && props.showVideo) {
      const videoEl = document.getElementById('stereoVideo');
      if (videoEl && videoEl.srcObject !== props.webcamStream1) {
        videoEl.srcObject = props.webcamStream1;
        // videoEl.play();
        videoEl.play().catch(error => {
          console.warn("Video play interrupted, likely due to component unmount:", error);
        });
      }
    }
  }, [props.webcamStream1, props.showVideo, timenow]);

  React.useEffect(() => {
    if (showVideo) {
      setVrcamPosition("0 -0.035 -0.0")
      setVrcamRotation("42.5 0 0")
    } else {
      setVrcamPosition("0 -0.15 -0.3")
      setVrcamRotation("0 0 0")
    }
  }, [showVideo]);

  /*---------------------- Scene Render -----------------------*/
  return (
    <>
        {showVideo && (
        <a-entity
          stereo-split="
            eye: left; 
            videoId: stereoVideo;
            geometryType: sphere;
            radius: 100;
            segmentsWidth: 64;
            segmentsHeight: 64;
            phiStart: 9.3;
            phiLength: 160;
            thetaStart: 30;
            thetaLength: 130;
          "
          position="-0.30 10.0 10.0"
          scale="-1 1 1"
          rotation="0 180 0"
        ></a-entity>)}

        {showVideo && (
        <a-entity
          stereo-split="
            eye: right; 
            videoId: stereoVideo;
            geometryType: sphere;
            radius: 100;
            segmentsWidth: 64;
            segmentsHeight: 64;
            phiStart: 10.7; 
            phiLength: 160;
            thetaStart: 30;
            thetaLength: 130;
          "
          position="0.30 10.0 10.0"
          scale="-1 1 1"
          rotation="0 180 0"
        ></a-entity>)}
    </>
  );
}