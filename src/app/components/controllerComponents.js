let registered = false;
export default function controllerComponents(options) {
  if (registered) return;
  registered = true;

  const {
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

    // HMD
    set_controller_object_cam,
  } = options;
  
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

        set_controller_object_cam(this.hmdProxy);
        // console.log('HMD Position:', this.hmdProxy.position);
        // console.log('HMD Rotation:', this.hmdProxy.quaternion);
      }
    }
  });
}