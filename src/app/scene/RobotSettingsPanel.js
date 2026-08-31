import React from 'react';

export default function RobotSettingsPanel(props) {
  const {
    setShowRobotSetting,
    botton_width,
    font_path
  } = props;

  return (
    <>
        {/* Robot Setting */}
        <a-entity id="setting" position="-0.8 0.2 -1.0" rotation="0 37 0" highlight button-action>
          <a-entity
            geometry="primitive: rounded-rect; width: 0.95; height: 0.80; radius: 0.065"
            rounded-rect-border={`width: 0.95; height: 0.80; radius: 0.065; color: #b8b8b8`}
            material="color: #222222; opacity: 1.0; shader: flat"
            position="-0.035 0.23 0"
          ></a-entity>

          <a-entity id="close-button" position="0.358 0.55 0.01" onClick={() => setShowRobotSetting(false)} class="raycastable">
            <a-circle
              radius="0.053"
              material="opacity: 0.9; transparent: true; shader: flat"
              class="raycastable"
              position="0 0 -0.001"
            ></a-circle>

            <a-circle
              radius="0.056"
              src={"/close.png"}
              material="transparent: true; shader: flat"
              position="0 0 0"
            ></a-circle>
          </a-entity>

          <a-entity id="robot-setting-content" position="-0.0 -0.035 0.01">

            <a-text value="Robot Setting" align="center" color="#fff" width="1.5" position="-0.025 0.56 0.01" font={font_path}></a-text>

            {/* Button 1 */}
            <a-entity id="button1" position="-0.25 0.4 0.01" class="raycastable menu-button"
              geometry={`primitive: rounded-rect; width: ${botton_width}; height: 0.18; radius: 0.04`}
              material="color: white; opacity: 0.95"
            ><a-text value="HMD Control \n Off" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>
            
            {/* Button 2 */}
            <a-entity id="button2" position="0.18 0.4 0.01" class="raycastable menu-button"
              geometry={`primitive: rounded-rect; width: ${botton_width}; height: 0.18; radius: 0.04`}
              material="color: white; opacity: 0.95"
            ><a-text value="HMD Control \n On" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>
            
            {/* Button 3 */}
            <a-entity id="button3" position="-0.25 0.2 0.01" class="raycastable menu-button"
              geometry={`primitive: rounded-rect; width: ${botton_width}; height: 0.18; radius: 0.04`}
              material="color: white; opacity: 0.95"
            ><a-text value="Show Video \n Off" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>

            {/* Button 4 */}
            <a-entity id="button4" position="0.18 0.2 0.01" class="raycastable menu-button"
              geometry={`primitive: rounded-rect; width: ${botton_width}; height: 0.18; radius: 0.04`}
              material="color: white; opacity: 0.95"
            ><a-text value="Show Video \n On" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>

            {/* Button 5 */}
            <a-entity id="button5" position="-0.25 0.0 0.01" class="raycastable menu-button"
              geometry={`primitive: rounded-rect; width: ${botton_width}; height: 0.18; radius: 0.04`}
              material="color: white; opacity: 0.95"
            ><a-text value="Show Model \n On" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>

            {/* Button 6 */}
            <a-entity id="button6" position="0.18 0.0 0.01" class="raycastable menu-button"
              geometry={`primitive: rounded-rect; width: ${botton_width}; height: 0.18; radius: 0.04`}
              material="color: white; opacity: 0.95"
            ><a-text value="Show Model \n Off" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>

            {/* Button 7,8 Visual Assist */}
            {/* <a-entity id="button7" position="-0.3 -0.2 0.01" class="raycastable menu-button"
              geometry={`primitive: rounded-rect; width: ${botton_width}; height: 0.18; radius: 0.04`}
              material="color: white; opacity: 0.95"
            ><a-text value="Visual Assist \n On" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>

            <a-entity id="button8" position="0.3 -0.2 0.01" class="raycastable menu-button"
              geometry={`primitive: rounded-rect; width: ${botton_width}; height: 0.18; radius: 0.04`}
              material="color: white; opacity: 0.95"
            ><a-text value="Visual Assist \n Off" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity> */}

            {/* Button 9,10 Whole Body Control */}
            {/* <a-entity id="button9" position="-0.3 -0.4 0.01" class="raycastable menu-button"
              geometry={`primitive: rounded-rect; width: ${botton_width}; height: 0.18; radius: 0.04`}
              material="color: white; opacity: 0.95"
            ><a-text value="Whole Body Control \n On" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity>

            <a-entity id="button10" position="0.3 -0.4 0.01" class="raycastable menu-button"
              geometry={`primitive: rounded-rect; width: ${botton_width}; height: 0.18; radius: 0.04`}
              material="color: white; opacity: 0.95"
            ><a-text value="Whole Body Control \n Off" align="center" color="#fff" width="1.0" position="0 0 0.01" font={font_path}></a-text></a-entity> */}
          </a-entity>
        </a-entity>
    </>
  );
}