let registered = false;
export default function sceneComponents(options) {
  if (registered) return;
  registered = true;

  const {
    // Camera
    setViewCamPose,
    vrModeRef,
    props,
    onXRFrameMQTT,

  } = options;
  
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
}
