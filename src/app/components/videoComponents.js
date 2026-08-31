let registered = false;
export default function videoComponents(options) {
  if (registered) return;
  registered = true;

  const {
  } = options;
  
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

  AFRAME.registerComponent('stereo-video', {
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

  AFRAME.registerComponent('stereo-split', {
    schema: {
      // --- 核心参数 ---
      eye: { type: 'string', default: 'left' },
      videoId: { type: 'string', default: '' },

      // --- 几何体类型 ---
      // 您可以保留这个，以便在 'plane', 'cylinder', 'sphere' 之间切换
      geometryType: { type: 'string', default: 'sphere' }, 

      // --- 通用参数 ---
      radius: { type: 'number', default: 100 },
      
      // --- 球面 (sphere) 参数 ---
      segmentsWidth: { type: 'number', default: 64 },
      segmentsHeight: { type: 'number', default: 64 },
      phiStart: { type: 'number', default: 0 },
      phiLength: { type: 'number', default: 360 },
      thetaStart: { type: 'number', default: 0 },
      thetaLength: { type: 'number', default: 180 },

      // --- 平面 (plane) 参数 (备用) ---
      width: { type: 'number', default: 1 },
      height: { type: 'number', default: 1 },
    },

    init: function () {
      const videoEl = document.getElementById(this.data.videoId);
      if (!videoEl || videoEl.tagName !== 'VIDEO') {
        console.warn('Video element not found or invalid:', this.data.videoId);
        return;
      }

      this.videoEl = videoEl;
      this.videoEl.setAttribute('crossorigin', 'anonymous');
      this.videoEl.setAttribute('playsinline', 'true');
      this.videoEl.play();

      const texture = new THREE.VideoTexture(this.videoEl);
      texture.colorSpace = THREE.SRGBColorSpace;

      // 根据 eye 设置纹理的 repeat 和 offset
      if (this.data.eye === 'left') {
        texture.repeat.set(0.5, 1);
        texture.offset.set(0, 0);
      } else if (this.data.eye === 'right') {
        texture.repeat.set(0.5, 1);
        texture.offset.set(0.5, 0);
      }

      this.el.setAttribute('material', {
        shader: 'flat',
        src: texture,
        side: 'double' // 对于球面或曲面，'double' 或 'back' 通常是必须的
      });

      this.updateGeometry();
      this.updateLayer();
    },

    update: function (oldData) {
      // 如果几何体相关参数变化，则更新几何体
      // (这里简单处理，每次update都更新)
      this.updateGeometry();
      this.updateLayer();
    },

    updateGeometry: function () {
      const data = this.data;
      let geometryParams;

      switch (data.geometryType) {
        case 'sphere':
          geometryParams = {
            primitive: 'sphere',
            radius: data.radius,
            segmentsWidth: data.segmentsWidth,
            segmentsHeight: data.segmentsHeight,
            phiStart: data.phiStart,
            phiLength: data.phiLength,
            thetaStart: data.thetaStart,
            thetaLength: data.thetaLength,
          };
          break;
        
        // 这里可以保留其他几何体类型作为备用
        case 'plane':
        default:
          geometryParams = {
            primitive: 'plane',
            width: data.width,
            height: data.height,
          };
          break;
      }
      
      this.el.setAttribute('geometry', geometryParams);
    },

    updateLayer: function () {
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
}
