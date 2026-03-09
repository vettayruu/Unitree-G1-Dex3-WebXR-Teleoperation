let registered = false;
export default function registerAframeComponents(options) {
  if (registered) return;
  registered = true;

  const {
    set_rendered,
    robotChange,

    // Right Controller
    set_controller_object,
    set_trigger_on,
    set_grip_on,
    set_button_a_on,
    set_button_b_on,
    setThumbstickRight,
    setThumbstickDownRight,

    // Left Controller
    set_controller_object_left,
    set_trigger_on_left,
    set_grip_on_left,
    set_button_x_on,
    set_button_y_on,
    setThumbstickLeft,
    setThumbstickDownLeft,

    // Right Hand
    setThumbIndexRight,
    setMiddleWristRight,

    // HMD
    set_controller_object_cam,

    // Left Hand
    setThumbIndexLeft,
    setMiddleWristLeft,

    // Menu
    setShowMenu,
    setControlMode,
    setLeftArmMode,
    setIndicator,
    setShareControl,
    setWholeBodyControl,

    // Collision Check
    collision,
    setCollision,
    
    // Camera
    setViewCamPose,
    vrModeRef,
    props,
    onXRFrameMQTT,

  } = options;
  
  // set rendered state after a short delay to ensure the scene is ready
  setTimeout(() => set_rendered(true), 16.67); // ~ 60 FPS

  /* ========================== Robot Model ========================= */
  AFRAME.registerComponent('robot-click', {
    init: function () {
      this.el.addEventListener('click', () => {
        robotChange();
        console.log('robot-click');
      });
    }
  });

  AFRAME.registerComponent('model-opacity', {
    schema: {
      opacity: { type: 'number', default: 0.5 },
    },
    init: function () {
      this.el.addEventListener('model-loaded', this.update.bind(this));
    },
    update: function () {
      var mesh = this.el.getObject3D('mesh');
      var data = this.data;
      if (!mesh) {
        return;
      }
      mesh.traverse(function (node) {
        if (node.isMesh) {
          node.material.opacity = data.opacity;
          node.material.transparent = data.opacity < 1.0;
          node.material.needsUpdate = true;
        }
      });
    },
  });


  /* ========================== VR Controller ========================= */
  AFRAME.registerComponent('vr-controller-right', {
    schema: { type: 'string', default: '' },
    init: function () {
      // Trigger 
      this.el.addEventListener('triggerdown', () => set_trigger_on(true));
      this.el.addEventListener('triggerup', () => set_trigger_on(false));

      // Gripper
      this.el.addEventListener('gripdown', () => set_grip_on(true));
      this.el.addEventListener('gripup', () => set_grip_on(false));

      // A/B
      this.el.addEventListener('abuttondown', () => set_button_a_on(true));
      this.el.addEventListener('abuttonup', () => set_button_a_on(false));
      this.el.addEventListener('bbuttondown', () => set_button_b_on(true));
      this.el.addEventListener('bbuttonup', () => set_button_b_on(false));

      this.el.addEventListener('thumbstickdown', () => setThumbstickDownRight(true));
      this.el.addEventListener('thumbstickmoved', (event) => {
        const { x, y } = event.detail; 
        setThumbstickRight([x, y]);
      });

      set_controller_object(this.el.object3D);

    },
    tick: function () {
      set_controller_object(this.el.object3D);
    }
  });

  AFRAME.registerComponent('vr-controller-left', {
    schema: { type: 'string', default: '' },
    init: function () {
      // Trigger 
      this.el.addEventListener('triggerdown', () => set_trigger_on_left(true));
      this.el.addEventListener('triggerup', () => set_trigger_on_left(false));

      // Gripper
      this.el.addEventListener('gripdown', () => set_grip_on_left(true));
      this.el.addEventListener('gripup', () => set_grip_on_left(false));

      // X/Y
      this.el.addEventListener('xbuttondown', () => set_button_x_on(true));
      this.el.addEventListener('xbuttonup', () => set_button_x_on(false));
      this.el.addEventListener('ybuttondown', () => set_button_y_on(true));
      this.el.addEventListener('ybuttonup', () => set_button_y_on(false));

      this.el.addEventListener('thumbstickdown', () => setThumbstickDownLeft(true));
      this.el.addEventListener('thumbstickmoved', (event) => {
      const { x, y } = event.detail; 
      setThumbstickLeft([x, y]);
      });

      set_controller_object_left(this.el.object3D);
    },
    tick: function () {
      set_controller_object_left(this.el.object3D);
    }
  });


  AFRAME.registerComponent('vr-controller-hmd', {
    init: function () {
      this.hmdProxy = new THREE.Object3D();
    },

    tick: function () {
      const xr = this.el.sceneEl.renderer.xr;
      const frame = this.el.sceneEl.frame;
      
      if (!frame || !xr.enabled) return;

      // 获取参考空间
      const refSpace = xr.getReferenceSpace();
      // 'viewer' 是 WebXR 标准中代表头显的专用名称
      const viewerPose = frame.getViewerPose(refSpace);

      if (viewerPose) {
        // viewerPose 包含多个 view（通常左右眼各一个）
        // 但它的 transform 属性代表了头部的中心位置
        const pose = viewerPose.transform;

        this.hmdProxy.position.set(pose.position.x, pose.position.y, pose.position.z);
        this.hmdProxy.quaternion.set(pose.orientation.x, pose.orientation.y, pose.orientation.z, pose.orientation.w);
        // this.hmdProxy.updateMatrixWorld();

        // 同步到你的逻辑中
        set_controller_object_cam(this.hmdProxy);
        // console.log('HMD Position:', this.hmdProxy.position);
        // console.log('HMD Rotation:', this.hmdProxy.quaternion);
      }
    }
  });


  AFRAME.registerComponent('jtext', {
    schema: {
      text: { type: 'string', default: '' },
      width: { type: 'number', default: 1 },
      height: { type: 'number', default: 0.12 },
      color: { type: 'string', default: 'black' },
      background: { type: 'string', default: 'white' },
      border: { type: 'string', default: 'black' }
    },
    init: function () {
      const el = this.el;
      const data = this.data;
      const bg = document.createElement('a-plane');
      bg.setAttribute('width', data.width);
      bg.setAttribute('height', data.height);
      bg.setAttribute('color', data.background);
      bg.setAttribute('position', '0 0 0.01');
      bg.setAttribute('opacity', '0.8');
      const text = document.createElement('a-entity');
      text.setAttribute('troika-text', {
        value: data.text,
        align: 'center',
        color: data.color,
        fontSize: 0.05,
        maxWidth: data.width * 0.9,
        font: "BIZUDPGothic-Bold.ttf",
      });
      text.setAttribute('position', '0 0 0.01');
      this.text = text;
      el.appendChild(bg);
      el.appendChild(text);
    },
    update: function (oldData) {
      const data = this.data;
      this.text.setAttribute('troika-text', {
        value: data.text,
        align: 'center',
        color: data.color,
        fontSize: 0.05,
        maxWidth: data.width * 0.95,
        font: "BIZUDPGothic-Bold.ttf",
      });
      this.text.setAttribute('position', '0 0 0.01');
    }
  });

  // Start animation in VR scene
  AFRAME.registerComponent('scene', {
    init: function () {
      this.el.addEventListener('enter-vr', () => {
        vrModeRef.current = true;
        console.log('enter-vr');

        const xrSession = this.el.renderer.xr.getSession();

        if (xrSession) {
          // --- Request VR FPS ---
          this.optimizeFPS(xrSession);

          if (!props.viewer) {
            xrSession.requestAnimationFrame(onXRFrameMQTT);
          }
        }

        setViewCamPose([0, -0.7, 0.3, 0, 0, 0]);
      });

      this.el.addEventListener('exit-vr', () => {
        vrModeRef.current = false;
        console.log('exit-vr');
      });
    },

    optimizeFPS: function (session) {
      if (session.supportedFrameRates) {
        // Quest 3 FPS [60, 72, 80, 90, 120]. Note: higher fps usually cause overheating and battery drain.
        const targetFPS = 60; 
        
        // Find max supported FPS (if 72 is not supported, fall back to highest available)
        const maxSupported = Math.max(...session.supportedFrameRates);
        const finalTarget = session.supportedFrameRates.includes(targetFPS) ? targetFPS : maxSupported;

        session.updateTargetFrameRate(finalTarget)
          .then(() => {
            console.log(`🚀 FPS Request Success: Target FPS ${finalTarget}Hz (Current FPS: ${session.frameRate}Hz)`);
          })
          .catch((err) => {
            console.warn('❌ FPS Request Failed:', err);
          });
      } else {
        console.log('ℹ️ Current Environment does not support WebXR Frame Rate API');
      }

      // ✅ 降低渲染分辨率（减少 GPU 负载）
      const renderer = this.el.renderer;
      const xr = renderer.xr;
      
      // 设置分辨率缩放比例（0.5-1.0，越小性能越好但画质越差）
      const resolutionScale = 0.7; // 推荐 0.7-0.9，Quest 3 默认是 1.0
      
      if (xr && xr.enabled) {
        // WebXR 的分辨率缩放
        const baseLayer = session.renderState.baseLayer;
        if (baseLayer) {
          const currentWidth = baseLayer.framebufferWidth;
          const currentHeight = baseLayer.framebufferHeight;
          
          session.updateRenderState({
            baseLayer: new XRWebGLLayer(session, renderer.getContext(), {
              framebufferScaleFactor: resolutionScale
            })
          });
          
          console.log(`📐 分辨率缩放: ${(resolutionScale * 100).toFixed(0)}% (${currentWidth}x${currentHeight} → ${Math.floor(currentWidth * resolutionScale)}x${Math.floor(currentHeight * resolutionScale)})`);
        }
      }
      
      // ✅ 设置 A-Frame 渲染器的像素比率（备用方案）
      renderer.setPixelRatio(resolutionScale);
    }
  });


  /* ========================== Collision Check ========================= */
  AFRAME.registerComponent('joint-collision-check', {
    schema: {
      target: { type: 'selector' },
      xPad: { type: 'number', default: 0 },
      yPad: { type: 'number', default: 0 },
      zPad: { type: 'number', default: 0 }
    },

    init: function () {
      if (!this.data.target) {
        console.error('Target not specified or invalid for joint-collision-check component');
        return;
      }

      this.targetEl = this.data.target;
      if (!this.targetEl) {
        console.error(`Target entity not found: ${this.data.target}`);
        return;
      }
    },

    tick: function () {
      const meshA = this.el.getObject3D('mesh');
      const meshB = this.data.target?.getObject3D('mesh');
      if (!meshA || !meshB) return;

      meshA.updateMatrixWorld();
      meshB.updateMatrixWorld();

      const padding = new THREE.Vector3(this.data.xPad, this.data.yPad, this.data.zPad);

      const boxA = new THREE.Box3().setFromObject(meshA).expandByVector(padding);
      const boxB = new THREE.Box3().setFromObject(meshB).expandByVector(padding);

      if (boxA.intersectsBox(boxB)) {
        setCollision(true); 
        console.warn(`🚨 Collision：${this.el.id} and ${this.data.target.id}`);
      } else {
        setCollision(false);
      }
    }
  });

  AFRAME.registerComponent('show-collision-box', {
    schema: {
      xPad: { type: 'number', default: 0 },
      yPad: { type: 'number', default: 0 },
      zPad: { type: 'number', default: 0 },
      color: { type: 'color', default: '#00ff00' },
      opacity: { type: 'number', default: 0.5 } 
    },

    init: function () {
      this.helper = null;

      this.el.addEventListener('model-loaded', () => {
        const mesh = this.el.getObject3D('mesh');
        if (!mesh) return;

        mesh.updateMatrixWorld(true);
        const padding = new THREE.Vector3(this.data.xPad, this.data.yPad, this.data.zPad);
        const box = new THREE.Box3().setFromObject(mesh).expandByVector(padding);

        this.helper = new THREE.Box3Helper(box, new THREE.Color(this.data.color));
        this.helper.material.transparent = true;
        this.helper.material.opacity = this.data.opacity;

        this.el.sceneEl.object3D.add(this.helper);
      });
    },

    tick: function () {
      if (!this.helper) return;
      const mesh = this.el.getObject3D('mesh');
      if (!mesh) return;

      mesh.updateMatrixWorld(true);
      const padding = new THREE.Vector3(this.data.xPad, this.data.yPad, this.data.zPad);
      const box = new THREE.Box3().setFromObject(mesh).expandByVector(padding);

      this.helper.box.copy(box);
    }
  });
  

  AFRAME.registerComponent('follow-camera', {
    schema: {
      offset: { type: 'vec3', default: { x: 0, y: 0, z: -1 } } // Offset relative to the camera
    },
    tick: function () {
      const cameraEl = this.el.sceneEl.camera.el; // Get the camera entity
      if (!cameraEl) return;

      // Get the camera's world position and rotation
      const cameraWorldPosition = new THREE.Vector3();
      const cameraWorldRotation = new THREE.Euler();
      cameraEl.object3D.getWorldPosition(cameraWorldPosition);
      cameraEl.object3D.getWorldRotation(cameraWorldRotation);

      // Apply the offset relative to the camera's position
      const offset = new THREE.Vector3(this.data.offset.x, this.data.offset.y, this.data.offset.z);
      offset.applyEuler(cameraWorldRotation); // Rotate the offset based on the camera's rotation
      const newPosition = cameraWorldPosition.add(offset);

      // Update the position and rotation of the entity
      this.el.object3D.position.copy(newPosition);
      this.el.object3D.rotation.copy(cameraWorldRotation);
    }
  });

  /* ========================== Stereo Image ========================= */
  AFRAME.registerComponent('stereo-plane', {
    schema: {
      eye: { type: 'string', default: 'left' }, // 'left', 'right', or 'both'
      videoId: { type: 'string', default: '' }  // ID of the <video> element
    },
    init() {
      const videoEl = document.getElementById(this.data.videoId);
      if (!videoEl || videoEl.tagName !== 'VIDEO') {
        console.warn('Video element not found or invalid:', this.data.videoId);
        return;
      }

      this.videoEl = videoEl;
      this.videoEl.setAttribute('crossorigin', 'anonymous');
      this.videoEl.setAttribute('playsinline', 'true');
      this.videoEl.play();

      this.el.setAttribute('material', {
        shader: 'flat',
        src: this.videoEl
      });

      this.el.setAttribute('geometry', {
        primitive: 'plane',
        // width: 2.5,
        // height: 2
      });

      // this.el.setAttribute('position', '0 1.0 0.5');
    },
    update() {
      const mesh = this.el.getObject3D('mesh');
      if (!mesh) return;

      switch (this.data.eye) {
        case 'left':
          mesh.layers.set(1);
          break;
        case 'right':
          mesh.layers.set(2);
          break;
        default:
          mesh.layers.set(0); // both
      }
    }
  });

  AFRAME.registerComponent('stereo-curvedvideo', {
    schema: {
      eye: { type: 'string', default: 'left' }, // left / right / both
      videoId: { type: 'string' }
    },
    init: function () {
      const videoEl = document.getElementById(this.data.videoId);
      if (!videoEl || videoEl.tagName !== 'VIDEO') {
        console.warn('Video element not found:', this.data.videoId);
        return;
      }

      this.videoEl = videoEl;
      this.videoEl.setAttribute('crossorigin', 'anonymous');
      this.videoEl.setAttribute('playsinline', 'true');
      this.videoEl.play();

      this.el.addEventListener('model-loaded', () => {
        const mesh = this.el.getObject3D('mesh');
        if (!mesh) return;

        mesh.traverse((node) => {
          if (node.isMesh) {
            node.material = new THREE.MeshBasicMaterial({
              map: new THREE.VideoTexture(this.videoEl),
              side: THREE.DoubleSide
            });
          }
        });
      });

      const mesh = this.el.getObject3D('mesh');
      if (mesh) {
        mesh.traverse((node) => {
          if (node.isMesh) {
            node.material = new THREE.MeshBasicMaterial({
              map: new THREE.VideoTexture(this.videoEl),
              side: THREE.DoubleSide
            });
          }
        });
      }
    },
    update: function () {
      const mesh = this.el.getObject3D('mesh');
      if (!mesh) return;

      switch (this.data.eye) {
        case 'left':
          mesh.layers.set(1);
          break;
        case 'right':
          mesh.layers.set(2);
          break;
        default:
          mesh.layers.set(0);
      }
    }
  });

  AFRAME.registerComponent('stereo-spherevideo', {
    schema: {
      eye: { type: 'string', default: 'left' }, // 'left', 'right', or 'both'
      videoId: { type: 'string', default: '' }  // ID of the <video> element
    },
    init: function () {
      const videoEl = document.getElementById(this.data.videoId);
      if (!videoEl || videoEl.tagName !== 'VIDEO') {
        console.warn('Video element not found:', this.data.videoId);
        return;
      }

      this.videoEl = videoEl;
      this.videoEl.setAttribute('crossorigin', 'anonymous');
      this.videoEl.setAttribute('playsinline', 'true');
      this.videoEl.play();

      // Set hemisphere geometry
      this.el.setAttribute('geometry', {
        primitive: 'sphere',
        radius: 50, 
        segmentsWidth: 64,
        segmentsHeight: 32,
        thetaStart: 45, 
        thetaLength: 75,
        phiStart: 185,
        phiLength: 145
      });

      this.el.setAttribute('material', {
        shader: 'flat',
        src: new THREE.VideoTexture(this.videoEl),
        side: 'double' 
      });
    },
    update: function () {
      const mesh = this.el.getObject3D('mesh');
      if (!mesh) return;

      switch (this.data.eye) {
        case 'left':
          mesh.layers.set(1);
          break;
        case 'right':
          mesh.layers.set(2);
          break;
        default:
          mesh.layers.set(0); // both
      }
    }
  });
  
  /* Menu */
  AFRAME.registerComponent('highlight', {
  init: function () {
    var buttonEls = this.buttonEls = this.el.querySelectorAll('.menu-button');
    var backgroundEl = document.querySelector('#background');
    this.groups = [
      ['button1', 'button2'],
      ['button3', 'button4'],
      ['button5', 'button6'],
      ['button7', 'button8'],
      ['button9', 'button10']
    ];
    window.menuActiveBtnIds = window.menuActiveBtnIds || ['button1', 'button3', 'button6', 'button8', 'button10'];
    const activeBtnIds = window.menuActiveBtnIds;
    this.activeBtns = [null, null, null, null, null];

    this.onClick = this.onClick.bind(this);
    this.onMouseEnter = this.onMouseEnter.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.reset = this.reset.bind(this);

    for (let groupIdx = 0; groupIdx < this.groups.length; ++groupIdx) {
      const btnId = activeBtnIds[groupIdx];
      const el = document.getElementById(btnId);
      if (el) {
        el.setAttribute('material', 'color', '#00ff00');
        this.activeBtns[groupIdx] = el;
      }
    }
    for (var i = 0; i < buttonEls.length; ++i) {
      if (!activeBtnIds.includes(buttonEls[i].id)) {
        buttonEls[i].setAttribute('material', 'color', 'white');
      }
      buttonEls[i].addEventListener('mouseenter', this.onMouseEnter);
      buttonEls[i].addEventListener('mouseleave', this.onMouseLeave);
      buttonEls[i].addEventListener('click', this.onClick);
    }
    backgroundEl.addEventListener('click', this.reset);
  },

  getGroupIndex: function (btnId) {
    for (let i = 0; i < this.groups.length; ++i) {
      if (this.groups[i].includes(btnId)) return i;
    }
    return -1;
  },

  onClick: function (evt) {
    const btnId = evt.target.id;
    const groupIdx = this.getGroupIndex(btnId);
    if (groupIdx === -1) return;
    for (const id of this.groups[groupIdx]) {
      const el = document.getElementById(id);
      if (el) el.setAttribute('material', 'color', 'white');
    }
    evt.target.setAttribute('material', 'color', '#00ff00');
    this.activeBtns[groupIdx] = evt.target;
    window.menuActiveBtnIds[groupIdx] = btnId;
    this.el.addState('clicked');
  },

  onMouseEnter: function (evt) {
    const btnId = evt.target.id;
    const groupIdx = this.getGroupIndex(btnId);
    if (groupIdx === -1) return;
    if (evt.target !== this.activeBtns[groupIdx]) {
      evt.target.setAttribute('material', 'color', '#046de7');
    }
  },

  onMouseLeave: function (evt) {
    const btnId = evt.target.id;
    const groupIdx = this.getGroupIndex(btnId);
    if (groupIdx === -1) return;
    if (evt.target !== this.activeBtns[groupIdx]) {
      evt.target.setAttribute('material', 'color', 'white');
    }
  },

  reset: function () {
    // 不重置 window.menuActiveBtnIds，只重置显示
    for (let i = 0; i < this.groups.length; ++i) {
      for (const id of this.groups[i]) {
        const el = document.getElementById(id);
        if (el) el.setAttribute('material', 'color', 'white');
      }
      this.activeBtns[i] = null;
    }
    this.el.removeState('clicked');
  }
});

  AFRAME.registerComponent('button-action', {
    init: function () {
      // Select all menu buttons
      const buttonEls = document.querySelectorAll('.menu-button');
      for (let i = 0; i < buttonEls.length; ++i) {
        buttonEls[i].addEventListener('click', (evt) => {
          const btnId = evt.currentTarget.id;
          if (btnId === "button1") {
            setControlMode("inSpace");
          } else if (btnId === "button2") {
            setControlMode("inBody");
          } else if (btnId === "button3") {
            setLeftArmMode("free");
          } else if (btnId === "button4") {
            setLeftArmMode("assist");
          } else if (btnId === "button5") {
            setIndicator("true");
          } else if (btnId === "button6") {
            setIndicator("false");
          } else if (btnId === "button7") {
            setShareControl(true);
          } else if (btnId === "button8") {
            setShareControl(false);
          } else if (btnId === "button9") {
            setWholeBodyControl(true);
          } else if (btnId === "button10") {
            setWholeBodyControl(false);
          }
        });
      }
    }
  });

  AFRAME.registerComponent('fps-counter', {
    schema: {
      for90fps: { default: true },
      updateInterval: { default: 10 } // 每 N 帧更新一次
    },

    init: function () {
      this.el.setAttribute('text', {
        align: 'center',
        side: 'double',
        color: 'green',
        value: '-- fps',
        width: 2
      });
      
      this.frameCount = 0;
      this.frameDuration = 0;
      this.currentFPS = 0;
      this.fpsHistory = []; // ✅ 记录历史帧率，用于计算平均值
      this.maxHistoryLength = 30;
    },

    tick: function (t, dt) {
      this.frameCount++;
      this.frameDuration += dt;

      // ✅ 每隔 N 帧计算一次 FPS
      if (this.frameCount >= this.data.updateInterval) {
        const fps = 1000 / (this.frameDuration / this.frameCount);
        this.currentFPS = fps;

        // ✅ 平滑 FPS 显示（移动平均）
        this.fpsHistory.push(fps);
        if (this.fpsHistory.length > this.maxHistoryLength) {
          this.fpsHistory.shift();
        }
        const avgFPS = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;

        // ✅ 根据 FPS 动态调整颜色
        let color = 'green';
        if (this.data.for90fps) {
          if (avgFPS < 85) { color = 'yellow'; }
          if (avgFPS < 80) { color = 'orange'; }
          if (avgFPS < 75) { color = 'red'; }
        } else {
          if (avgFPS < 55) { color = 'yellow'; }
          if (avgFPS < 45) { color = 'orange'; }
          if (avgFPS < 30) { color = 'red'; }
        }

        // ✅ 一次性更新文本和颜色（减少 DOM 操作）
        this.el.setAttribute('text', {
          value: `${avgFPS.toFixed(0)} fps`,
          color: color
        });

        // 重置计数器
        this.frameCount = 0;
        this.frameDuration = 0;
      }
    },

    // ✅ 新增：外部可获取当前 FPS
    getFPS: function () {
      return this.currentFPS;
    }
  });

  // ----- Hand Tracking -----
  // WebXR Hand 25 Joints checke https://developers.meta.com/horizon/documentation/web/webxr-hands/
  // 0     ["wrist"],
  // 1-4   ["thumb-metacarpal", "thumb-phalanx-proximal", "thumb-phalanx-distal", "thumb-tip"],
  // 5-9   ["index-finger-metacarpal", "index-finger-phalanx-proximal", "index-finger-phalanx-intermediate", "index-finger-phalanx-distal", "index-finger-tip"],
  // 10-14 ["middle-finger-metacarpal", "middle-finger-phalanx-proximal", "middle-finger-phalanx-intermediate", "middle-finger-phalanx-distal", "middle-finger-tip"],
  // 15-19 ["ring-finger-metacarpal", "ring-finger-phalanx-proximal", "ring-finger-phalanx-intermediate", "ring-finger-phalanx-distal", "ring-finger-tip"],
  // 20-24 ["pinky-finger-metacarpal", "pinky-finger-phalanx-proximal", "pinky-finger-phalanx-intermediate", "pinky-finger-phalanx-distal", "pinky-finger-tip"]
  AFRAME.registerComponent('vr-hand-as-controller', {
  schema: {
    hand: { type: 'string', default: 'right' },
  },

  init: function () {
    this.jointObjects = {
      wrist: new THREE.Object3D(),
      thumbTip: new THREE.Object3D(),
      indexTip: new THREE.Object3D(),
      indexMeta: new THREE.Object3D(),
      middleTip: new THREE.Object3D(),
      middleMeta: new THREE.Object3D(),
      pinkyTip: new THREE.Object3D(),
    };

    // ✅ 添加菜单手势状态管理
    this.menuGestureState = {
      isGestureActive: false,       // 当前手势是否激活
      gestureStartTime: 0,          // 手势开始时间
      lastToggleTime: 0,            // 上次切换菜单的时间
      HOLD_DURATION: 500,           // 需要保持手势的时间（毫秒）
      COOLDOWN_DURATION: 1000,      // 冷却时间，防止误触发
    };
  },

  getJointPose: function(jointName) {
    return this.jointObjects[jointName];
  },
  
  tick: function () {
    const sceneEl = this.el.sceneEl;
    const frame = sceneEl.frame;
    const renderer = sceneEl.renderer;

    if (!frame || !renderer.xr.enabled) return;

    const session = renderer.xr.getSession();
    if (!session) return;

    const inputSource = Array.from(session.inputSources).find(
      s => s.hand && s.handedness === this.data.hand
    );

    if (inputSource) {
      const refSpace = renderer.xr.getReferenceSpace();
      const hand = inputSource.hand;

      // Get poses for hand joints
      const wristPose = frame.getJointPose(hand.get('wrist'), refSpace);
      const thumbTipPose = frame.getJointPose(hand.get('thumb-tip'), refSpace);
      const indexTipPose = frame.getJointPose(hand.get('index-finger-tip'), refSpace);
      const indexMetaPose = frame.getJointPose(hand.get('index-finger-metacarpal'), refSpace);
      const middleTipPose = frame.getJointPose(hand.get('middle-finger-tip'), refSpace);
      const middleMetaPose = frame.getJointPose(hand.get('middle-finger-metacarpal'), refSpace);
      const pinkyTipPose = frame.getJointPose(hand.get('pinky-finger-tip'), refSpace);

      if (!wristPose || !thumbTipPose || !indexTipPose || !indexMetaPose || !middleTipPose || !middleMetaPose || !pinkyTipPose) {
        return; 
      }

      // Update joint positions and orientations
      // ...existing code...
      const { position: pWrist, orientation: qWrist } = wristPose.transform;
      this.jointObjects.wrist.position.set(pWrist.x, pWrist.y, pWrist.z);
      this.jointObjects.wrist.quaternion.set(qWrist.x, qWrist.y, qWrist.z, qWrist.w);

      const { position: pThumb, orientation: qThumb } = thumbTipPose.transform;
      this.jointObjects.thumbTip.position.set(pThumb.x, pThumb.y, pThumb.z);
      this.jointObjects.thumbTip.quaternion.set(qThumb.x, qThumb.y, qThumb.z, qThumb.w);

      const { position: pIndexTip, orientation: qIndexTip } = indexTipPose.transform;
      this.jointObjects.indexTip.position.set(pIndexTip.x, pIndexTip.y, pIndexTip.z);
      this.jointObjects.indexTip.quaternion.set(qIndexTip.x, qIndexTip.y, qIndexTip.z, qIndexTip.w);

      const { position: pIndexMeta, orientation: qIndexMeta } = indexMetaPose.transform;
      this.jointObjects.indexMeta.position.set(pIndexMeta.x, pIndexMeta.y, pIndexMeta.z);
      this.jointObjects.indexMeta.quaternion.set(qIndexMeta.x, qIndexMeta.y, qIndexMeta.z, qIndexMeta.w);

      const { position: pMiddleTip, orientation: qMiddleTip } = middleTipPose.transform;
      this.jointObjects.middleTip.position.set(pMiddleTip.x, pMiddleTip.y, pMiddleTip.z);
      this.jointObjects.middleTip.quaternion.set(qMiddleTip.x, qMiddleTip.y, qMiddleTip.z, qMiddleTip.w);

      const { position: pMiddleMeta, orientation: qMiddleMeta } = middleMetaPose.transform;
      this.jointObjects.middleMeta.position.set(pMiddleMeta.x, pMiddleMeta.y, pMiddleMeta.z);
      this.jointObjects.middleMeta.quaternion.set(qMiddleMeta.x, qMiddleMeta.y, qMiddleMeta.z, qMiddleMeta.w);

      const { position: pPinkyTip, orientation: qPinkyTip } = pinkyTipPose.transform;
      this.jointObjects.pinkyTip.position.set(pPinkyTip.x, pPinkyTip.y, pPinkyTip.z);
      this.jointObjects.pinkyTip.quaternion.set(qPinkyTip.x, qPinkyTip.y, qPinkyTip.z, qPinkyTip.w);

      // Retargeting
      const dThumbIndex = this.jointObjects.thumbTip.position.distanceTo(this.jointObjects.indexTip.position);
      const dMiddleTipMeta = this.jointObjects.middleTip.position.distanceTo(this.jointObjects.middleMeta.position);
      
      let thumbRatio = 0;
      let middleRatio = 0;
      if (dThumbIndex < 0.02) {
        thumbRatio = 1;
      } else if (dThumbIndex > 0.08) {
        thumbRatio = 0;
      } else {
        thumbRatio = 1 - (dThumbIndex - 0.02) / (0.08 - 0.02);
      }
      
      if (dMiddleTipMeta < 0.07) {
        middleRatio = 1;
      } else if (dMiddleTipMeta > 0.14) {
        middleRatio = 0;
      } else {
        middleRatio = 1 - (dMiddleTipMeta - 0.07) / (0.14 - 0.07);
      }

      // Hand Trigger
      const angleIndex = this.jointObjects.indexTip.quaternion.angleTo(this.jointObjects.indexMeta.quaternion);
      const angleMiddle = this.jointObjects.middleTip.quaternion.angleTo(this.jointObjects.middleMeta.quaternion);

      const isIndexOpen = angleIndex < 0.5;
      const isMiddleOpen = angleMiddle < 0.5;

      const isTriggered = !(isIndexOpen && isMiddleOpen);

      // ✅ 优化后的菜单手势检测（拇指-小指触碰）
      const dThumbPinky = this.jointObjects.thumbTip.position.distanceTo(this.jointObjects.pinkyTip.position);
      const currentTime = performance.now();
      const state = this.menuGestureState;

      // 检测手势是否满足触发条件
      const isGestureDetected = dThumbPinky < 0.03; // 3.0cm 触发距离

      if (isGestureDetected) {
        if (!state.isGestureActive) {
          // 手势刚开始
          state.isGestureActive = true;
          state.gestureStartTime = currentTime;
          console.log('👆 拇指-小指手势开始');
        } else {
          // 手势持续中，检查是否达到触发时长
          const holdDuration = currentTime - state.gestureStartTime;
          const timeSinceLastToggle = currentTime - state.lastToggleTime;
          
          if (holdDuration >= state.HOLD_DURATION && 
              timeSinceLastToggle >= state.COOLDOWN_DURATION &&
              !state.hasTriggered) { // 防止长按期间重复触发
            
            // ✅ 自动切换菜单状态
            setShowMenu((prev) => {
              console.log(`🎯 菜单自动切换: ${prev ? 'OFF' : 'ON'} (按住 ${holdDuration.toFixed(0)}ms)`);
              return !prev;
            });
            
            state.lastToggleTime = currentTime;
            state.hasTriggered = true; // 标记已触发
          }
        }
      } else {
        // 手势结束
        if (state.isGestureActive) {
          const holdDuration = currentTime - state.gestureStartTime;
          
          if (!state.hasTriggered) {
            console.log(`❌ 手势时间不足: ${holdDuration.toFixed(0)}ms (需要 ${state.HOLD_DURATION}ms)`);
          }
          
          state.isGestureActive = false;
          state.hasTriggered = false; // 重置触发标记
        }
      }

      // Update
      if (this.data.hand === 'right') {
        set_trigger_on(isTriggered);
        set_controller_object(this.jointObjects.wrist);
        setThumbIndexRight(Math.max(0, Math.min(1, thumbRatio)));
        setMiddleWristRight(Math.max(0, Math.min(1, middleRatio)));
      } else {
        set_trigger_on_left(isTriggered);
        set_controller_object_left(this.jointObjects.wrist);
        setThumbIndexLeft(Math.max(0, Math.min(1, thumbRatio)));
        setMiddleWristLeft(Math.max(0, Math.min(1, middleRatio)));
      }
    }
  },
});

  AFRAME.registerComponent('finger-distance-visualizer', {
    schema: {
      hand: { type: 'string', default: 'right' },
      jointA: { type: 'string', default: 'thumbTip' }, // 改为使用 jointObjects 的键名
      jointB: { type: 'string', default: 'indexTip' },
      color: { type: 'string', default: '#00FF00' }
    },

    init: function () {
      // 1. 创建线条（用于显示距离路径）
      this.geometry = new THREE.BufferGeometry();
      this.material = new THREE.LineBasicMaterial({ color: this.data.color, depthTest: false });
      this.line = new THREE.Line(this.geometry, this.material);
      this.el.sceneEl.object3D.add(this.line);

      // 2. 创建文本（用于显示具体数值）
      this.textEl = document.createElement('a-entity');
      this.textEl.setAttribute('text', {
        value: '',
        align: 'center',
        color: this.data.color,
        width: 0.5
      });
      this.el.sceneEl.appendChild(this.textEl);

      this.tempVecA = new THREE.Vector3();
      this.tempVecB = new THREE.Vector3();

      // 3. 查找对应的 vr-hand-as-controller 组件
      this.handController = null;
    },

    tick: function () {
      // 懒加载：首次查找 hand controller
      if (!this.handController) {
        const handEntities = document.querySelectorAll('[vr-hand-as-controller]');
        for (let i = 0; i < handEntities.length; i++) {
          const handComp = handEntities[i].components['vr-hand-as-controller'];
          if (handComp && handComp.data.hand === this.data.hand) {
            this.handController = handComp;
            break;
          }
        }
        
        // 如果还没找到，跳过本帧
        if (!this.handController) return;
      }

      // 从 vr-hand-as-controller 获取关节对象
      const jointA = this.handController.jointObjects[this.data.jointA];
      const jointB = this.handController.jointObjects[this.data.jointB];

      if (jointA && jointB && jointA.position && jointB.position) {
        // 检查位置是否有效（不为零向量，表示已更新）
        if (jointA.position.lengthSq() > 0 && jointB.position.lengthSq() > 0) {
          this.tempVecA.copy(jointA.position);
          this.tempVecB.copy(jointB.position);

          // 更新线条顶点
          this.geometry.setFromPoints([this.tempVecA, this.tempVecB]);
          this.line.visible = true;

          // 更新文本位置和内容 (放在线条中间)
          const dist = this.tempVecA.distanceTo(this.tempVecB);
          this.textEl.setAttribute('visible', true);
          this.textEl.object3D.position.lerpVectors(this.tempVecA, this.tempVecB, 0.5);
          this.textEl.object3D.position.y += 0.02; // 稍微向上偏移防止重叠
          this.textEl.setAttribute('text', 'value', (dist * 100).toFixed(1) + ' cm');
          
          return;
        }
      }
      
      // 如果没追踪到，隐藏
      this.line.visible = false;
      this.textEl.setAttribute('visible', false);
    }
  });

  // 新增：显示关节角度的可视化组件
  AFRAME.registerComponent('finger-angle-visualizer', {
    schema: {
      hand: { type: 'string', default: 'right' },
      jointA: { type: 'string', default: 'indexTip' },
      jointB: { type: 'string', default: 'indexMeta' },
      color: { type: 'string', default: '#FFFF00' }
    },

    init: function () {
      // 创建文本显示角度
      this.textEl = document.createElement('a-entity');
      this.textEl.setAttribute('text', {
        value: '',
        align: 'center',
        color: this.data.color,
        width: 0.3
      });
      this.el.sceneEl.appendChild(this.textEl);

      this.handController = null;
    },

    tick: function () {
      // 懒加载 hand controller
      if (!this.handController) {
        const handEntities = document.querySelectorAll('[vr-hand-as-controller]');
        for (let i = 0; i < handEntities.length; i++) {
          const handComp = handEntities[i].components['vr-hand-as-controller'];
          if (handComp && handComp.data.hand === this.data.hand) {
            this.handController = handComp;
            break;
          }
        }
        if (!this.handController) return;
      }

      const jointA = this.handController.jointObjects[this.data.jointA];
      const jointB = this.handController.jointObjects[this.data.jointB];

      if (jointA && jointB && jointA.quaternion && jointB.quaternion) {
        if (jointA.position.lengthSq() > 0 && jointB.position.lengthSq() > 0) {
          // 计算四元数角度差
          const angle = jointA.quaternion.angleTo(jointB.quaternion);
          const angleDegrees = THREE.MathUtils.radToDeg(angle);

          // 显示在两个关节中间
          this.textEl.object3D.position.lerpVectors(jointA.position, jointB.position, 0.5);
          this.textEl.object3D.position.y += 0.03;
          this.textEl.setAttribute('text', 'value', `${angleDegrees.toFixed(1)}°`);
          this.textEl.setAttribute('visible', true);
          return;
        }
      }
      
      this.textEl.setAttribute('visible', false);
    }
  });
}