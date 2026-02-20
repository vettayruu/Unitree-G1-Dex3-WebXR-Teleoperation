const mr = require('./modern_robotics_core.js');

const STATE_CODES = {
  NORMAL: 0x00,
  IK_FAILED: 0x01,
  VELOCITY_LIMIT: 0x02,
  JOINT_LIMIT: 0x03,
};

/**
 * Calculate relative rotation matrix between current and initial rotation
 * @param {Array<Array<number>>} currentR - Current rotation matrix (3x3)
 * @param {Array<Array<number>>} initialR - Initial rotation matrix (3x3)
 * @param {string} mode - Calculation mode: 'inSpace' or 'inBody'
 * @returns {Array<Array<number>>} - Relative rotation matrix (3x3)
 */
function calculateRelativeRotationMatrix (currentR, initialR, mode) {
  if (!initialR) {
    // If no initial matrix, return identity matrix
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
  }

  // Calculate transpose of initial rotation matrix
  const initialR_T = [
    [initialR[0][0], initialR[1][0], initialR[2][0]],
    [initialR[0][1], initialR[1][1], initialR[2][1]],
    [initialR[0][2], initialR[1][2], initialR[2][2]]
  ];

  const relativeR = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];

  if (mode === 'inSpace') {
    // Calculate R_relative = R_current * R_initial^T (Space frame reference)
    // Matrix multiplication: R_current * R_initial^T
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        relativeR[i][j] = 
          currentR[i][0] * initialR_T[0][j] +
          currentR[i][1] * initialR_T[1][j] +
          currentR[i][2] * initialR_T[2][j];
      }
    }
  } else if (mode === 'inBody') {
    // Calculate R_relative = R_initial^T * R_current (Body frame reference)
    // Matrix multiplication: R_initial^T * R_current
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        relativeR[i][j] = 
          initialR_T[i][0] * currentR[0][j] +
          initialR_T[i][1] * currentR[1][j] +
          initialR_T[i][2] * currentR[2][j];
      }
    }
  } else {
    throw new Error(`Invalid mode: ${mode}. Use 'inSpace' or 'inBody'.`);
  }

  return relativeR;
}


/**
 * Convert rotation matrix to screw axis representation
 * @param {Array<Array<number>>} relativeR - Relative rotation matrix (3x3)
 * @returns {Array} - [omega_hat, theta] where omega_hat is unit axis vector and theta is rotation angle
 */
function relativeRMatrixtoScrewAxis(relativeR) {
    // Calculate so(3) matrix using MatrixLog3
    const so3mat = mr.MatrixLog3(relativeR);
    
    // Extract omega_theta vector from so(3) matrix
    const omega_theta = mr.so3ToVec(so3mat);
    
    // Calculate magnitude (theta) using JavaScript array operations
    const theta = Math.sqrt(
        omega_theta[0] * omega_theta[0] + 
        omega_theta[1] * omega_theta[1] + 
        omega_theta[2] * omega_theta[2]
    );
    
    let omega_hat;
    
    if (theta < 1e-6) {
        // If theta is very small, return zero vector
        omega_hat = [0, 0, 0];
    } else {
        // Normalize omega_theta to get unit axis vector
        omega_hat = [
            omega_theta[0] / theta,
            omega_theta[1] / theta,
            omega_theta[2] / theta
        ];
    }
    
    return [omega_hat, theta];
}

/**
 * Convert screw axis and angle to relative rotation matrix
 * @param {Array<number>} omega_hat - Unit axis vector [x, y, z]
 * @param {number} theta - Rotation angle in radians
 * @returns {Array<Array<number>>} - Relative rotation matrix (3x3)
 */
function ScrewAxisToRelativeRMatrix(omega_hat, theta) {
    // Create omega_theta vector by multiplying unit axis with angle
    const omega_theta = [
        omega_hat[0] * theta,
        omega_hat[1] * theta,
        omega_hat[2] * theta
    ];
    
    // Convert omega_theta vector to so(3) matrix
    const so3mat = mr.VecToso3(omega_theta);
    // Convert so(3) matrix to rotation matrix using MatrixExp3
    const R_relative = mr.MatrixExp3(so3mat);
    
    return R_relative;
}

function calculateSpatialVelocity(T_current, T_target, dt, mode) {
  // T_sd^(-1) * T_target
  const T_current_inv = mr.TransInv(T_current);
  let relative_T;
  if (mode === 'inBody') {
    // Calculate relative transform T_sd^(-1) * T_target
    relative_T = mr.matDot(T_current_inv, T_target);
  } else if (mode === 'inSpace') {
    // Calculate relative transform T_target * T_sd^(-1)
    relative_T = mr.matDot(T_target, T_current_inv);
  } else {
    throw new Error(`Invalid mode: ${mode}. Use 'inSpace' or 'inBody'.`);
  }
  
  // Calculate matrix logarithm (Lie algebra)
  const se3_matrix = mr.MatrixLog6(relative_T);
  
  // Extract 6D vector from skew-symmetric matrix
  const V_d_raw = mr.se3ToVec(se3_matrix);
  
  // Scale to actual velocity (divide by time step)
  const V_d = V_d_raw.map(v => v / dt);
  
  return V_d;
}

/**
 * 每一帧调用的控制函数
 * @param {Object} controller - 手柄对象 (包含 position 和 quaternion)
 * @param {Boolean} isTriggerOn - 按钮状态
 */
function updateRobotIK(controller, isTriggerOn ) {
  // --- 1. 运行条件检查 ---
  // 不再需要依赖数组，每一帧手动判断
  if (!rendered || !vrMode || showMenu || shareControl) return;

  if (isTriggerOn) {
    const { position: p_raw, quaternion: q_raw } = controller;

    // --- 2. 初始帧处理 (锚点锁定) ---
    if (!lastVRPos) {
      lastVRPos = [p_raw.x, p_raw.y, p_raw.z];
      lastQuat = q_raw.clone(); 
      return;
    }

    // --- A. 计算位移增量 ---
    const pos_diff_world = mr.three2world([
      p_raw.x - lastVRPos[0],
      p_raw.y - lastVRPos[1],
      p_raw.z - lastVRPos[2]
    ]);
    
    // 更新位置锚点
    lastVRPos[0] = p_raw.x;
    lastVRPos[1] = p_raw.y;
    lastVRPos[2] = p_raw.z;

    // --- B. 直接从四元数计算旋转轴和角度 ---
    const { axis, theta } = getAxisAngleFromQuatDiff(q_raw, lastQuat);
    
    // 更新姿态锚点
    lastQuat.copy(q_raw);

    // --- C. 计算机械臂目标位姿 ---
    const p_scale = 1.0;
    const R_scale = 1.0;
    
    const newP = [
      position_ee[0] + pos_diff_world[0] * p_scale,
      position_ee[1] + pos_diff_world[1] * p_scale,
      position_ee[2] + pos_diff_world[2] * p_scale
    ];

    let newT;
    if (VR_Control_Mode === 'inSpace') {
      const axis_world = [-axis[2], -axis[0], axis[1]]; 
      const R_rel = ScrewAxisToRMatrixOptimized(axis_world, theta * R_scale); 
      newT = mr.RpToTrans(numeric.dot(R_rel, R_ee), newP);
    } else {
      const R_rel = ScrewAxisToRMatrixOptimized(axis, theta * R_scale); 
      newT = mr.RpToTrans(numeric.dot(R_ee, R_rel), newP);
    }

    // --- D. 执行 IK (如果集成了 WASM，这里直接同步调用) ---
    // 摆脱了 React State，这里直接更新变量并驱动模型
    const result = IK_joint_velocity_limit(
      newT, M_right, Slist_right, Blist_right, 
      joint_limits_right, 
      currentThetaBody, VR_Control_Mode, dt
    );

    currentThetaBody = result.new_theta_body;
    
    // 驱动视图渲染（例如 A-Frame 或 Three.js 的直接操作）
    robotModel.updateJoints(currentThetaBody);

  } else {
    // --- 重置状态 ---
    if (lastVRPos) {
      lastVRPos = null;
      lastQuat = null;
    }
  }
}

/**
 * Inverse Kinematics with Joint Velocity Limit
 * @param {Array<number>} T_sd // Target end-effector pose
 * @param {Object} robotParams // Robot parameters including M, Slist, Blist, jointLimits, jointInitial
 * @param {Array<number>} theta_body // Current joint angles, and also used as initial guess
 * @param {string} VR_Control_Mode // VR control mode: 'inSpace' or 'inBody'
 * @returns {Array<number>} { new_theta_body, error_code }   // Return new joint angles and error code of IK
 */
function IK_joint_velocity_limit(T_sd, M, Slist, Blist, jointLimits, theta_body, VR_Control_Mode, dt) {
  let thetalist_sol, ik_success;
  const max_joint_vel = 50.0; // rad/s
  let error_code = STATE_CODES.NORMAL;
  const qmin = jointLimits.map(j => j.min);
  const qmax = jointLimits.map(j => j.max);

  // 1. 选择 IK 模式 (直接传入预设的 qmin, qmax 避免 map)
  if (VR_Control_Mode === 'inBody') {
    [thetalist_sol, ik_success] = mr.IKinBodyNull(Blist, M, T_sd, theta_body, qmin, qmax, 1e-4, 1e-4);
    // [thetalist_sol, ik_success] = mr.IKinBody(Blist, M, T_sd, theta_body, 1e-4, 1e-4);
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

function IK_joint_velocity(T_sd, M, Slist, Blist, jointLimits, theta_body, VR_Control_Mode, dt) {
  let thetalist_sol, ik_success;
  let error_code = STATE_CODES.NORMAL;
  const qmin = jointLimits.map(j => j.min);
  const qmax = jointLimits.map(j => j.max);

  // 1. 选择 IK 模式 (直接传入预设的 qmin, qmax 避免 map)
  // if (VR_Control_Mode === 'inBody') {
  //   [thetalist_sol, ik_success] = mr.IKinBodyNull(Blist, M, T_sd, theta_body, qmin, qmax, 1e-4, 1e-4);
  //   // [thetalist_sol, ik_success] = mr.IKinBody(Blist, M, T_sd, theta_body, 1e-4, 1e-4);
  // } else {
  //   // 空间模式使用我们优化过的 NullSpace 版本
  //   [thetalist_sol, ik_success] = mr.IKinSpaceNull(Slist, M, T_sd, theta_body, qmin, qmax, 1e-4, 1e-4);
  // }
  [thetalist_sol, ik_success] = mr.IKinSpaceNull(Slist, M, T_sd, theta_body, qmin, qmax, 1e-4, 1e-4);

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
  // const total_vel = Math.sqrt(total_delta) / dt;

  // let scale = 1.0;
  // if (total_vel > max_joint_vel) {
  //   scale = max_joint_vel / total_vel;
  //   error_code = STATE_CODES.VELOCITY_LIMIT;
  //   console.warn("Velocity Limit Reached");
  // } else if (isAtLimit) {
  //   // 如果触碰限位，给予一个缓冲衰减，而不是生硬停下
  //   scale = 0.5; 
  //   error_code = STATE_CODES.JOINT_LIMIT;
  // }
  let scale = 1.0;
  if (isAtLimit) {
    error_code = STATE_CODES.JOINT_LIMIT;
    scale = 0.318; 
    console.warn("Joint Limit Reached");
  }

  // 4. 计算最终姿态 (单次循环完成)
  const new_theta_body = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    new_theta_body[i] = theta_body[i] + delta_theta[i] * scale;
  }

  return { new_theta_body: Array.from(new_theta_body), error_code };
}

function IK_finger(T_sd, M, Slist, theta_body, hand) {
  let thetalist_sol, ik_success;
  let error_code = STATE_CODES.NORMAL;

  let qmin, qmax;
  if (hand === 'right') {
    qmin = 0;
    qmax = mr.deg2rad(90);
  } else {
    qmin =  mr.deg2rad(-90);
    qmax = 0;
  }

  [thetalist_sol, ik_success] = mr.IKinSpace(Slist, M, T_sd, theta_body, 100, 1e-2);

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

  let scale = 1.0;
  if (isAtLimit) {
    error_code = STATE_CODES.JOINT_LIMIT;
    scale = 0.318; 
    console.warn("Joint Limit Reached");
  }

  // 4. 计算最终姿态 (单次循环完成)
  const new_theta_body = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    new_theta_body[i] = theta_body[i] + delta_theta[i] * scale;
  }

  return { new_theta_body: Array.from(new_theta_body), error_code };
}

module.exports = {
    calculateRelativeRotationMatrix,
    relativeRMatrixtoScrewAxis,
    ScrewAxisToRelativeRMatrix,
    calculateSpatialVelocity,
    IK_joint_velocity_limit,
    IK_joint_velocity,
    IK_finger,
    updateRobotIK
};