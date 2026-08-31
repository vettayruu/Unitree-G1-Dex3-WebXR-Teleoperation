let registered = false;
export default function debugComponents(options) {
  if (registered) return;
  registered = true;

  const {
  } = options;
  
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

}