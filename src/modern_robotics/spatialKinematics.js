const mr = require('./modern_robotics_core.js');

const STATE_CODES = {
  NORMAL: 0x00,
  IK_FAILED: 0x01,
  VELOCITY_LIMIT: 0x02,
  JOINT_LIMIT: 0x03,
};

function getAxisAngleFromQuatDiff(q_curr, q_init) {
    const q_rel = new THREE.Quaternion().copy(q_init).invert().premultiply(q_curr);
    const w_rel = q_rel.w;
    const s = Math.sqrt(1 - w_rel* w_rel);
    if (s > 1e-6) {
        const phi = 2 * Math.acos(w_rel);
        const axis = [q_rel.x / s, q_rel.y / s, q_rel.z / s];
        return { axis, phi };
    } else {
        return { axis: [0, 0, 1], phi: 0 };
    }
  }

function ScrewAxisToRMatrix(axis, phi) {
    const [nx, ny, nz] = axis;
    const s = Math.sin(phi);
    const c = Math.cos(phi);
    const v = 1 - c;

    // R = I*cos(phi) + [axis]_x*sin(phi) + axis*axis^T*(1-cos(phi))
    return [
        [nx * nx * v + c,      nx * ny * v - nz * s,  nx * nz * v + ny * s],
        [nx * ny * v + nz * s, ny * ny * v + c,       ny * nz * v - nx * s],
        [nx * nz * v - ny * s, ny * nz * v + nx * s,  nz * nz * v + c     ]
    ];
}


function IK_joint_limit(T_sd, M, Slist, jointLimits, theta_body) {
  let thetalist_sol, ik_success;
  const max_joint_vel = 50; // rad/s
  let error_code = STATE_CODES.NORMAL;
  const qmin = jointLimits.map(j => j.min);
  const qmax = jointLimits.map(j => j.max);

  [thetalist_sol, ik_success] = mr.IKinSpaceNull(Slist, M, T_sd, theta_body, qmin, qmax, 1e-6, 1e-6);

  if (!ik_success) {
    console.warn("IK failed");
    return { new_theta_body: theta_body, error_code: STATE_CODES.IK_FAILED };
  }

  // Clamping
  let isAtLimit = false;
  const n = theta_body.length;
  const delta_theta = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    let clamped = Math.max(qmin[i], Math.min(qmax[i], thetalist_sol[i]));
    if (clamped === qmin[i] || clamped === qmax[i]) isAtLimit = true;
    delta_theta[i] = clamped - theta_body[i];
  }
  
  let scale = 1.0;
  if (isAtLimit) {
    scale = 0.2; 
    error_code = STATE_CODES.JOINT_LIMIT;
  }

  // Update
  const new_theta_body = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    new_theta_body[i] = theta_body[i] + delta_theta[i] * scale;
  }

  return { new_theta_body: Array.from(new_theta_body), error_code };
}

function IK_joint_velocity_limit(T_sd, M, Slist, jointLimits, theta_body, dt) {
  let thetalist_sol, ik_success;
  const max_joint_vel = 50; // rad/s
  let error_code = STATE_CODES.NORMAL;
  const qmin = jointLimits.map(j => j.min);
  const qmax = jointLimits.map(j => j.max);

  [thetalist_sol, ik_success] = mr.IKinSpaceNull(Slist, M, T_sd, theta_body, qmin, qmax, 1e-6, 1e-6);

  if (!ik_success) {
    console.warn("IK failed");
    return { new_theta_body: theta_body, error_code: STATE_CODES.IK_FAILED };
  }

  // Clamping
  let isAtLimit = false;
  const n = theta_body.length;
  const delta_theta = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    let clamped = Math.max(qmin[i], Math.min(qmax[i], thetalist_sol[i]));
    if (clamped === qmin[i] || clamped === qmax[i]) isAtLimit = true;
    delta_theta[i] = clamped - theta_body[i];
  }

  // Velocity Scaling
  let total_delta = 0;
  for (let i = 0; i < n; i++) total_delta += delta_theta[i] * delta_theta[i];
  const total_vel = Math.sqrt(total_delta) / dt;
  if (total_vel > max_joint_vel) {
    scale = max_joint_vel / total_vel;
    error_code = STATE_CODES.VELOCITY_LIMIT;
    console.warn("Velocity Limit Reached");
  } 
  
  let scale = 1.0;
  if (isAtLimit) {
    scale = 0.2; 
    error_code = STATE_CODES.JOINT_LIMIT;
  }

  // Update
  const new_theta_body = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    new_theta_body[i] = theta_body[i] + delta_theta[i] * scale;
  }

  return { new_theta_body: Array.from(new_theta_body), error_code };
}

module.exports = {
  getAxisAngleFromQuatDiff,
  ScrewAxisToRMatrix,
  IK_joint_limit,
  IK_joint_velocity_limit,
};