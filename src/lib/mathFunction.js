function roundArray(arr, decimals = 8) {
  const factor = Math.pow(10, decimals);
  return arr.map(v => Math.round(v * factor) / factor);
}

function roundScalar(v, decimals = 8) {
  const factor = Math.pow(10, decimals);
  return Math.round(v * factor) / factor;
}


function getAxisAngleFromQuatDiff(q_curr, q_init) {
    // 1. 计算相对四元数 Q_rel = Q_curr * inv(Q_init)
    // THREE.js 中：q_rel = q_curr * q_init.inverse()
    const q_rel = new THREE.Quaternion().copy(q_init).invert().premultiply(q_curr);
    
    // 2. 提取角度 theta = 2 * acos(w)
    const w = Math.max(-1, Math.min(1, q_rel.w));
    const theta = 2 * Math.acos(w);
    
    // 3. 提取单位轴 (x, y, z) / sin(theta/2)
    const s = Math.sqrt(1 - w * w);
    
    if (s > 1e-6) {
        const axis = [q_rel.x / s, q_rel.y / s, q_rel.z / s];
        return { axis, theta };
    } else {
        return { axis: [0, 0, 1], theta: 0 };
    }
  }

function ScrewAxisToRMatrix(axis, theta) {
    const [nx, ny, nz] = axis;
    const s = Math.sin(theta);
    const c = Math.cos(theta);
    const v = 1 - c; // versine of theta

    // 罗德里格斯公式直接构造矩阵分量
    // R = I*cos(theta) + [axis]_x*sin(theta) + axis*axis^T*(1-cos(theta))
    return [
        [nx * nx * v + c,      nx * ny * v - nz * s,  nx * nz * v + ny * s],
        [nx * ny * v + nz * s, ny * ny * v + c,       ny * nz * v - nx * s],
        [nx * nz * v - ny * s, ny * nz * v + nx * s,  nz * nz * v + c     ]
    ];
}

export { 
    roundArray, roundScalar, 
    getAxisAngleFromQuatDiff, ScrewAxisToRMatrix 
};
