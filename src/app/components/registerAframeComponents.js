import controllerComponents from './controllerComponents'; 
import sceneComponents from './sceneComponents'; 
import collisionComponents from './collisionComponents'; 
import videoComponents from './videoComponents'; 
import uiComponents from './uiComponents'; 
import debugComponents from './debugComponents'; 
import handTrackingComponents from './handTrackingComponents'; 

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
    setThumbMiddleRight,
    setIndexMetaRight,
    setMiddleMetaRight,
    setThumbIndexInterRight,

    // HMD
    set_controller_object_cam,

    // Left Hand
    setThumbIndexLeft,
    setThumbMiddleLeft,
    setIndexMetaLeft,
    setMiddleMetaLeft,
    setThumbIndexInterLeft,

    // Menu
    setShowMenu,
    setHmdControl,
    setShowVideo,
    // setControlMode,
    setShowModel,
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

  controllerComponents(options)
  sceneComponents(options)
  collisionComponents(options)
  videoComponents(options)
  uiComponents(options)
  debugComponents(options)
  handTrackingComponents(options)

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

  /*------------------------------ UI ------------------------------*/
  AFRAME.registerGeometry('rounded-rect', {
    schema: {
      width: {type: 'number', default: 1},
      height: {type: 'number', default: 1},
      radius: {type: 'number', default: 0.05}
    },
    init: function (data) {
      const { width: w, height: h, radius: r } = data;
      const shape = new THREE.Shape();
      const x = -w / 2;
      const y = -h / 2;

      shape.moveTo(x, y + r);
      shape.lineTo(x, y + h - r);
      shape.quadraticCurveTo(x, y + h, x + r, y + h);
      shape.lineTo(x + w - r, y + h);
      shape.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
      shape.lineTo(x + w, y + r);
      shape.quadraticCurveTo(x + w, y, x + w - r, y);
      shape.lineTo(x + r, y);
      shape.quadraticCurveTo(x, y, x, y + r);

      this.geometry = new THREE.ShapeGeometry(shape);
    }
  });

  AFRAME.registerComponent('rounded-rect-border', {
    schema: {
      width: {type: 'number', default: 1},
      height: {type: 'number', default: 1},
      radius: {type: 'number', default: 0.05},
      color: {type: 'color', default: '#ffffff'},
      opacity: {type: 'number', default: 1}
    },
    init: function () {
      this.buildBorder();
    },
    update: function () {
      this.buildBorder();
    },
    buildBorder: function () {
      const data = this.data;
      const w = data.width, h = data.height, r = Math.min(data.radius, w / 2, h / 2);
      const x = -w / 2, y = -h / 2;

      const shape = new THREE.Shape();
      shape.moveTo(x, y + r);
      shape.lineTo(x, y + h - r);
      shape.quadraticCurveTo(x, y + h, x + r, y + h);
      shape.lineTo(x + w - r, y + h);
      shape.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
      shape.lineTo(x + w, y + r);
      shape.quadraticCurveTo(x + w, y, x + w - r, y);
      shape.lineTo(x + r, y);
      shape.quadraticCurveTo(x, y, x, y + r);

      const points = shape.getPoints(32); // 32段分辨率，圆角够平滑
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: data.color,
        transparent: data.opacity < 1,
        opacity: data.opacity
      });

      this.el.removeObject3D('border');
      const line = new THREE.LineLoop(geometry, material);
      line.position.z = 0.001; // 避免和底面 z-fighting
      line.raycast = () => {};
      this.el.setObject3D('border', line);
    },
    remove: function () {
      this.el.removeObject3D('border');
    }
  });

  AFRAME.registerComponent('hand-tracking-laser', {
    schema: {
      hand: {type: 'string', default: 'right'}
    },
    init: function () {
      this.raycaster = null;
      this.line = null;
      this.pinchStarted = false;
      this.currentIntersection = null;

      // 创建激光线的可视化对象
      const material = new THREE.LineBasicMaterial({ color: '#4CC3D9' });
      const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      this.lineObj = new THREE.Line(geometry, material);
      this.lineObj.raycast = () => {}; // 激光线本身不参与射线检测
      this.el.sceneEl.object3D.add(this.lineObj);

      // 监听捏合手势（WebXR Hand Input 标准事件）
      this.el.addEventListener('pinchstarted', this.onPinchStarted.bind(this));
      this.el.addEventListener('pinchended', this.onPinchEnded.bind(this));
    },

    onPinchStarted: function () {
      this.pinchStarted = true;
      if (this.currentIntersection) {
        // 模拟触发标准 click 事件，让 onClick 监听器正常工作
        this.currentIntersection.object.el.dispatchEvent(new Event('click'));
      }
    },

    onPinchEnded: function () {
      this.pinchStarted = false;
    },

    tick: function () {
      const handEl = this.el;
      const indexTip = handEl.components['hand-tracking-controls'] &&
                        handEl.components['hand-tracking-controls'].bones &&
                        handEl.components['hand-tracking-controls'].bones['index-finger-tip'];

      if (!indexTip) return;

      // 用食指指尖位置和指向作为激光起点和方向
      const origin = new THREE.Vector3();
      indexTip.getWorldPosition(origin);

      const direction = new THREE.Vector3(0, 0, -1);
      direction.applyQuaternion(indexTip.getWorldQuaternion(new THREE.Quaternion()));

      if (!this.raycaster) {
        this.raycaster = new THREE.Raycaster();
      }
      this.raycaster.set(origin, direction);
      this.raycaster.far = 10;

      // 只检测 .raycastable 元素
      const targets = Array.from(document.querySelectorAll('.raycastable'))
        .map(el => el.object3D)
        .filter(Boolean);

      const intersects = this.raycaster.intersectObjects(targets, true);
      this.currentIntersection = intersects.length > 0 ? intersects[0] : null;

      // 更新激光线的可视化长度
      const points = [
        origin,
        this.currentIntersection
          ? this.currentIntersection.point
          : origin.clone().add(direction.multiplyScalar(2))
      ];
      this.lineObj.geometry.setFromPoints(points);
    },

    remove: function () {
      if (this.lineObj) {
        this.el.sceneEl.object3D.remove(this.lineObj);
      }
    }
  });

}