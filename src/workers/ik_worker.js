import * as mr from '../modern_robotics/modern_robotics_core.js'; // 确保路径正确

// 定义状态码（Worker 内部需要独立定义或 import）
const STATE_CODES = {
  NORMAL: 0,
  IK_FAILED: 1,
  VELOCITY_LIMIT: 2,
  JOINT_LIMIT: 3
};

self.onmessage = function (e) {
  const { T_sd, M, Slist, Blist, jointLimits, theta_body, VR_Control_Mode, dt } = e.data;

  // 调用你之前的 IK 函数逻辑
  const result = calculateIK(T_sd, M, Slist, Blist, jointLimits, theta_body, VR_Control_Mode, dt);

  // 返回结果
  self.postMessage(result);
};

// 将 IK 主函数放入此处
function calculateIK(T_sd, M, Slist, Blist, jointLimits, theta_body, VR_Control_Mode, dt) {
  // ... 把你提供的 IK_joint_velocity_limit 逻辑粘贴在这里 ...
  // 注意：内部调用的 mr.IKinBody 等确保正常引用
  let thetalist_sol, ik_success;
    const max_joint_vel = 50.0; // rad/s
    let error_code = STATE_CODES.NORMAL;
    const qmin = jointLimits.map(j => j.min);
    const qmax = jointLimits.map(j => j.max);
  
    // 1. 选择 IK 模式 (直接传入预设的 qmin, qmax 避免 map)
    if (VR_Control_Mode === 'inBody') {
      [thetalist_sol, ik_success] = mr.IKinBody(Blist, M, T_sd, theta_body, 1e-4, 1e-4);
    } else {
      // 空间模式使用我们优化过的 NullSpace 版本
      [thetalist_sol, ik_success] = mr.IKinSpaceNull(Slist, M, T_sd, theta_body, qmin, qmax, 1e-3, 1e-3);
    }
  
    if (!ik_success) {
      console.warn("IK failed");
      return { new_theta_body: theta_body, error_code: STATE_CODES.IK_FAILED };
    }
  
    // 2. 关节位置限幅与限位检查 (Clamping)
    let isAtLimit = false;
    const n = theta_body.length;
    const delta_theta = new Float64Array(n);
  
    for (let i = 0; i < n; i++) {
      // 限制在安全范围内
      let clamped = Math.max(qmin[i], Math.min(qmax[i], thetalist_sol[i]));
      if (clamped === qmin[i] || clamped === qmax[i]) isAtLimit = true;
      delta_theta[i] = clamped - theta_body[i];
    }
  
    // 3. 速度缩放 (Velocity Scaling)
    // 计算总位移的模长，判断是否超速
    let total_delta = 0;
    for (let i = 0; i < n; i++) total_delta += delta_theta[i] * delta_theta[i];
    const total_vel = Math.sqrt(total_delta) / dt;
  
    let scale = 1.0;
    if (total_vel > max_joint_vel) {
      scale = max_joint_vel / total_vel;
      error_code = STATE_CODES.VELOCITY_LIMIT;
      console.warn("Velocity Limit Reached");
    } else if (isAtLimit) {
      // 如果触碰限位，给予一个缓冲衰减，而不是生硬停下
      scale = 0.5; 
      error_code = STATE_CODES.JOINT_LIMIT;
    }
  
    // 4. 计算最终姿态 (单次循环完成)
    const new_theta_body = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      new_theta_body[i] = theta_body[i] + delta_theta[i] * scale;
    }
  
    return { new_theta_body: Array.from(new_theta_body), error_code };
  
}