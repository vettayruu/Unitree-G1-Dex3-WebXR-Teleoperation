import React from 'react';

export default function HandControllerLayout(props) {
  const {
    showMenu,
  } = props;

  return (
    <>
        {/* -------------- VR Controller -------------*/}
        {/* <a-entity oculus-touch-controls="hand: right" vr-controller-right visible="true"></a-entity> */}
        {/* <a-entity oculus-touch-controls="hand: left" vr-controller-left visible="true"></a-entity> */}

        <a-entity id="hand-offset-left" position="0.00 -0.685 0.31">
          <a-entity 
            hand-tracking-controls="hand: left; modelStyle: mesh" 
            vr-hand-as-controller={`hand: left; showMenu: ${showMenu}`}
          ></a-entity>
        </a-entity>

        <a-entity id="hand-offset-right" position="-0.005 -0.685 0.301">
          <a-entity 
            hand-tracking-controls="hand: right; modelStyle: mesh" 
            vr-hand-as-controller={`hand: right; showMenu: ${showMenu}`}
          ></a-entity>
        </a-entity>

        <a-entity vr-controller-hmd></a-entity>
        
        {/* Show Controller Laser Pointer for Right Hand Only (for menu interaction) */}
        {showMenu && (
          <a-entity 
            oculus-touch-controls="hand: right"
            laser-controls="hand: right" 
            raycaster="objects: .raycastable"
          ></a-entity>
        )}
    </>
  );
}