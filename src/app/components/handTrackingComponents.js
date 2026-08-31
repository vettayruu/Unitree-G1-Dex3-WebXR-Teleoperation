let registered = false;
export default function handTrackingComponents(options) {
  if (registered) return;
  registered = true;

  const {
    // Right Controller
    set_controller_object,
    set_trigger_on,
    // Left Controller
    set_controller_object_left,
    set_trigger_on_left,
    // Right Hand
    setThumbIndexRight,
    setThumbMiddleRight,
    setIndexMetaRight,
    setMiddleMetaRight,
    setThumbIndexInterRight,
    // Left Hand
    setThumbIndexLeft,
    setThumbMiddleLeft,
    setIndexMetaLeft,
    setMiddleMetaLeft,
    setThumbIndexInterLeft,
    // Menu
    setShowMenu,
  } = options;
  
  AFRAME.registerComponent('vr-hand-as-controller', {
    schema: {
      hand: { type: 'string', default: 'right' },
      showMenu: { type: 'boolean', default: false },
    },

    remove: function () {
      if (this.laserLine) {
        this.el.sceneEl.object3D.remove(this.laserLine);
      }
    },

    getJointPose: function(jointName) {
      return this.jointObjects[jointName];
    },

    init: function () {
      this.jointObjects = {
        wrist: new THREE.Object3D(),
        thumbTip: new THREE.Object3D(),
        indexTip: new THREE.Object3D(),
        indexInter: new THREE.Object3D(),
        indexMeta: new THREE.Object3D(),
        middleTip: new THREE.Object3D(),
        middleMeta: new THREE.Object3D(),
        pinkyTip: new THREE.Object3D(),
      };

      this.menuGestureState = {
        isGestureActive: false,       // 当前手势是否激活
        gestureStartTime: 0,          // 手势开始时间
        lastToggleTime: 0,            // 上次切换菜单的时间
        HOLD_DURATION: 600,           // 需要保持手势的时间（毫秒）
        COOLDOWN_DURATION: 1000,      // 冷却时间，防止误触发
      };

      const laserMaterial = new THREE.LineBasicMaterial({ color: '#4CC3D9' });
      const laserGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1)
      ]);
      this.laserLine = new THREE.Line(laserGeometry, laserMaterial);
      this.laserLine.raycast = () => {};
      this.laserLine.visible = false;
      this.el.sceneEl.object3D.add(this.laserLine);

      this.raycaster = new THREE.Raycaster();
      this.wasPinching = false;
      this.currentIntersection = null;

      this.forwardVector = new THREE.Vector3(0, 0, -1);

      // ✅ 新增:平滑后的方向四元数,初始值可以先设成单位四元数
      this.smoothedWristQuaternion = new THREE.Quaternion();
      this.smoothingInitialized = false;

      // ✅ 平滑系数,0~1之间,越小越平滑(但延迟越大),越大越跟手(但抖动越明显)
      this.smoothingFactor = 0.25;

      // ✅ 捏合开始时锁定的方向,用于避免触发瞬间的抖动
      this.lockedDirectionOnPinch = null;

      // ✅ 新增:向内偏移15度的固定旋转偏移
      // "向内"通常是绕 Y 轴(左右转向)旋转,左手和右手偏移方向相反
      const offsetAngleDeg = 10;
      const offsetAngleRad = THREE.MathUtils.degToRad(offsetAngleDeg);
      
      // 右手向内偏移(比如向左转15度,朝身体中线方向) -> 用负角度
      // 左手向内偏移(比如向右转15度,朝身体中线方向) -> 用正角度
      const sign = -1;
      
      this.laserOffsetQuaternion = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        offsetAngleRad * sign
        );
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
        const indexInterPose = frame.getJointPose(hand.get('index-finger-phalanx-intermediate'), refSpace);
        const middleTipPose = frame.getJointPose(hand.get('middle-finger-tip'), refSpace);
        const middleMetaPose = frame.getJointPose(hand.get('middle-finger-metacarpal'), refSpace);
        const pinkyTipPose = frame.getJointPose(hand.get('pinky-finger-tip'), refSpace);

        if (!wristPose || !thumbTipPose || !indexTipPose || !indexMetaPose || !middleTipPose || !middleMetaPose || !pinkyTipPose) {
          return; 
        }

        // Update joint positions and orientations
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

        const { position: pIndexInter, orientation: qIndexInter } = indexInterPose.transform;
        this.jointObjects.indexInter.position.set(pIndexInter.x, pIndexInter.y, pIndexInter.z);
        this.jointObjects.indexInter.quaternion.set(qIndexInter.x, qIndexInter.y, qIndexInter.z, qIndexInter.w);

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
        const dIndexTipMeta = this.jointObjects.indexTip.position.distanceTo(this.jointObjects.indexMeta.position);

        const dThumbMiddle = this.jointObjects.thumbTip.position.distanceTo(this.jointObjects.middleTip.position);
        const dMiddleTipMeta = this.jointObjects.middleTip.position.distanceTo(this.jointObjects.middleMeta.position);

        const dThumbIndexInter = this.jointObjects.thumbTip.position.distanceTo(this.jointObjects.indexInter.position);
        
        let thumbIndexTipRatio = 0;
        let thumbMiddleRatio = 0;
        let indexMetaRatio = 0;
        let middleMetaRatio = 0;
        let thumbIndexInterRatio = 0;

        if (dThumbIndex < 0.018) {
          thumbIndexTipRatio = 1;
        } else if (dThumbIndex > 0.09) {
          thumbIndexTipRatio = 0;
        } else {
          thumbIndexTipRatio = 1 - (dThumbIndex - 0.018) / (0.09 - 0.018);
        }

        if (dIndexTipMeta < 0.07) {
          indexMetaRatio = 1;
        } else if (dIndexTipMeta > 0.14) {
          indexMetaRatio = 0;
        } else {
          indexMetaRatio = 1 - (dIndexTipMeta - 0.07) / (0.14 - 0.07);
        }

        if (dThumbMiddle < 0.02) {
          thumbMiddleRatio = 1;
        } else if (dThumbMiddle > 0.095) {
          thumbMiddleRatio = 0;
        } else {
          thumbMiddleRatio = 1 - (dThumbMiddle - 0.02) / (0.095 - 0.02);
        }
        
        if (dMiddleTipMeta < 0.07) {
          middleMetaRatio = 1;
        } else if (dMiddleTipMeta > 0.15) {
          middleMetaRatio = 0;
        } else {
          middleMetaRatio = 1 - (dMiddleTipMeta - 0.07) / (0.15 - 0.07);
        }

        if (dThumbIndexInter < 0.010) {
          thumbIndexInterRatio = 1;
        } else if (dThumbIndexInter > 0.10) {
          thumbIndexInterRatio = 0;
        } else {
          thumbIndexInterRatio = 1 - (dThumbIndexInter - 0.010) / (0.10 - 0.010);
        }

        // Hand Trigger
        const angleIndex = this.jointObjects.indexTip.quaternion.angleTo(this.jointObjects.indexMeta.quaternion);
        const angleMiddle = this.jointObjects.middleTip.quaternion.angleTo(this.jointObjects.middleMeta.quaternion);

        const isIndexOpen = angleIndex < 0.5;
        const isMiddleOpen = angleMiddle < 0.5;

        const isTriggered = !(isIndexOpen && isMiddleOpen);

        const dThumbPinky = this.jointObjects.thumbTip.position.distanceTo(this.jointObjects.pinkyTip.position);
        const currentTime = performance.now();
        const state = this.menuGestureState;

        const isGestureDetected = dThumbPinky < 0.028; //m

        if (isGestureDetected) {
          if (!state.isGestureActive) {
            state.isGestureActive = true;
            state.gestureStartTime = currentTime;
          } else {
            const holdDuration = currentTime - state.gestureStartTime;
            const timeSinceLastToggle = currentTime - state.lastToggleTime;
            
            if (holdDuration >= state.HOLD_DURATION && 
                timeSinceLastToggle >= state.COOLDOWN_DURATION &&
                !state.hasTriggered) { 
              
              setShowMenu((prev) => {
                return !prev;
              });
              
              state.lastToggleTime = currentTime;
              state.hasTriggered = true; 
            }
          }
        } else {
          if (state.isGestureActive) {            
            state.isGestureActive = false;
            state.hasTriggered = false;
          }
        }

        // Update
        if (this.data.hand === 'right') {
          set_trigger_on(isTriggered);
          set_controller_object(this.jointObjects.wrist);
          setThumbIndexRight(Math.max(0, Math.min(1, thumbIndexTipRatio)));
          setThumbMiddleRight(Math.max(0, Math.min(1, thumbMiddleRatio)));
          setIndexMetaRight(Math.max(0, Math.min(1, indexMetaRatio)));
          setMiddleMetaRight(Math.max(0, Math.min(1, middleMetaRatio)));
          setThumbIndexInterRight(Math.max(0, Math.min(1, thumbIndexInterRatio)));
        } else {
          set_trigger_on_left(isTriggered);
          set_controller_object_left(this.jointObjects.wrist);
          setThumbIndexLeft(Math.max(0, Math.min(1, thumbIndexTipRatio)));
          setThumbMiddleLeft(Math.max(0, Math.min(1, thumbMiddleRatio)));
          setIndexMetaLeft(Math.max(0, Math.min(1, indexMetaRatio)));
          setMiddleMetaLeft(Math.max(0, Math.min(1, middleMetaRatio)));
          setThumbIndexInterLeft(Math.max(0, Math.min(1, thumbIndexInterRatio)));
        }

        // ✅ 对手腕旋转做平滑处理(四元数球面插值)
        if (!this.data.showMenu) {
          this.laserLine.visible = false;
          this.currentIntersection = null;
          this.wasPinching = false; // 顺便重置捏合状态，避免菜单关闭期间残留的捏合状态影响下次打开
          // 直接 return，跳过后面激光计算和点击判定的逻辑，节省性能
          // 注意：如果 tick 后面还有别的逻辑（比如你的手势检测、setThumbIndexRight 等），
          // 不要直接 return，而是用 if/else 包裹激光这部分，让其他逻辑继续执行
        } else {
          // 平滑处理
          if (!this.smoothingInitialized) {
            this.smoothedWristQuaternion.copy(this.jointObjects.wrist.quaternion);
            this.smoothingInitialized = true;
          } else {
            this.smoothedWristQuaternion.slerp(this.jointObjects.wrist.quaternion, this.smoothingFactor);
          }

          // ✅ 先复制平滑后的手腕朝向,再叠加固定偏移(相乘顺序决定了偏移是"局部坐标系"还是"世界坐标系"下的旋转)
          const finalQuaternion = this.smoothedWristQuaternion.clone().multiply(this.laserOffsetQuaternion);

          const direction = this.forwardVector.clone()
            .applyQuaternion(finalQuaternion)
            .normalize();

          const parentOffset = new THREE.Vector3();
          if (this.el.parentEl && this.el.parentEl.object3D) {
            this.el.parentEl.object3D.getWorldPosition(parentOffset);
          }

          const origin = this.jointObjects.wrist.position.clone().add(parentOffset);

          this.laserLine.visible = true;
          this.raycaster.set(origin, direction);
          this.raycaster.far = 10;

          const targets = Array.from(document.querySelectorAll('.raycastable'))
            .map(el => el.object3D)
            .filter(Boolean);

          const intersects = this.raycaster.intersectObjects(targets, true);
          this.currentIntersection = intersects.length > 0 ? intersects[0] : null;

          const endPoint = this.currentIntersection
            ? this.currentIntersection.point
            : origin.clone().add(direction.clone().multiplyScalar(2));

          this.laserLine.geometry.setFromPoints([origin, endPoint]);
          this.laserLine.geometry.attributes.position.needsUpdate = true;

          // ✅ 捏合触发判定:在"刚进入捏合"的那一帧,使用当前已经平滑过的 intersection 结果
          const isPinching = dThumbIndex < 0.018;
          if (isPinching && !this.wasPinching && this.currentIntersection) {
            this.currentIntersection.object.el.dispatchEvent(new Event('click', { bubbles: true, composed: true }));
          }
          this.wasPinching = isPinching;
        }
      }
    },
  });

  // Hand Tracking with Laser Pointer. Not stable yet, so commented out for now.

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