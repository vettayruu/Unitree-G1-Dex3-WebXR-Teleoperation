const numeric = require('numeric'); 
const ml = require('ml-matrix');
// import { Matrix, SVD } from 'ml-matrix';

// *** BASIC HELPER FUNCTIONS ***

/**
 * Determines whether a scalar is small enough to be treated as zero
 * @param {number} z
 * @returns {boolean}
    Example Input:
        z = -1e-7
    Output:
        True
 */
function NearZero(z) {
    return Math.abs(z) < 1e-6;
}

/**
 * Normalizes a vector
 * @param {Array<number>} V A vector
 * @returns {Array<number>} A unit vector pointing in the same direction as z
    Example Input:
        V = [1, 2, 3]
    Output:
        [0.26726124, 0.53452248, 0.80178373]
    
    Example Input:
        V = [0, 0, 0]
    Output:
        [0, 0, 0]
 */
function Normalize(V) {
    const norm = Math.sqrt(V.reduce((sum, v) => sum + v * v, 0));
    if (NearZero(norm)) return V.map(() => 0); 
    return V.map(v => v / norm);
}


/**
 * Computes the Euclidean norm of a vector
 * @param {Array<number>} v A vector
 * @returns {number} The Euclidean norm of v
 * Example Input:
 *   v = [1, 2, 3]
 * Output:
 *   3.7416573867739413
 */
// function Norm(v) {
//     // Computes the Euclidean norm of a vector
//     return Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
// }

function Norm(v) {
    const n = v.length;
    
    // 针对 3 维向量的特殊优化（最常见场景：旋转向量、位置向量）
    if (n === 3) {
        return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    }
    
    // 针对 6 维向量（常用场景：空间速度 Vs）
    if (n === 6) {
        return Math.sqrt(
            v[0] * v[0] + v[1] * v[1] + v[2] * v[2] + 
            v[3] * v[3] + v[4] * v[4] + v[5] * v[5]
        );
    }

    // 通用情况使用原生 for 循环，性能优于 reduce
    let sum = 0;
    for (let i = 0; i < n; i++) {
        sum += v[i] * v[i];
    }
    return Math.sqrt(sum);
}

/**
 * Creates an n x n identity matrix
 * @param {number} n The size of the identity matrix
 * @returns {Array<Array<number>>} An n x n identity matrix
 * Example Input:
 *   n = 3
 * Output:
 *   [
 *     [1, 0, 0],
 *     [0, 1, 0],
 *     [0, 0, 1]
 *   ]
 */
function Eye(n) {
    // Returns an n x n identity matrix
    return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
}

/**
 * Computes the dot product of two matrices A and B
 * @description Computes the matrix product of A and B, where A is m x n and B is n x p
 * @param {Array<Array<number>>} A
 * @param {Array<Array<number>>} B
 * @returns {Array<Array<number>>}
 * @example
 *   A = [
 *     [1, 2],
 *     [3, 4]
 *   ];
 *   B = [
 *     [5, 6],
 *     [7, 8]
 *   ];
 *   Dot(A, B) => [
 *     [19, 22],
 *     [43, 50]
 *   ];
 */
function matDot(A, B) {
    if (Array.isArray(B[0]) === false) {
        B = B.map(x => [x]);
        const matRes = matDot(A, B);
        return matRes.map(row => row[0]);
    }
    const m = A.length;
    const n = A[0].length;
    const p = B[0].length;
    let result = Array.from({ length: m }, () => Array(p).fill(0));
    for (let i = 0; i < m; i++) {
        for (let j = 0; j < p; j++) {
            for (let k = 0; k < n; k++) {
                result[i][j] += A[i][k] * B[k][j];
            }
        }
    }
    return result;
}

function vecMatDot(vec, mat) {
  const result = [];
  for (let j = 0; j < mat[0].length; ++j) {
    let sum = 0;
    for (let i = 0; i < vec.length; ++i) {
      sum += vec[i] * mat[i][j];
    }
    result.push(sum);
  }
  return result;
}

/**
 * @description Adds two matrices A and B element-wise
 * @param {Array<Array<number>>} A
 * @param {Array<Array<number>>} B
 * @returns {Array<Array<number>>} A+B
 * @example
 *   A = [
 *     [1, 2],
 *     [3, 4]
 *   ];
 *   B = [
 *     [5, 6],
 *     [7, 8]
 *   ];
 *   matAdd(A, B) => [
 *     [6, 8],
 *     [10, 12]
 *   ];
 */
function matAdd(A, B) {
    const m = A.length;
    const n = A[0].length;
    let result = [];
    for (let i = 0; i < m; i++) {
        result[i] = [];
        for (let j = 0; j < n; j++) {
            result[i][j] = A[i][j] + B[i][j];
        }
    }
    return result;
}

/**
 * @description Adds multiple matrices element-wise
 * @param  {...Array<Array<number>>} matrices 
 * @returns {Array<Array<number>>} 
 * @example
 *   matAddN(
 *     [
 *       [1, 2],
 *       [3, 4]
 *     ],
 *     [
 *       [5, 6],
 *       [7, 8]
 *     ],
 *     [
 *       [9, 10],
 *       [11, 12]
 *     ]
 *   ) => [
 *     [15, 18],
 *     [21, 24]
 *   ];
 */
function matAddN(...matrices) {
    if (matrices.length === 0) return [];
    const m = matrices[0].length;
    const n = matrices[0][0].length;
    let result = Array.from({ length: m }, (_, i) =>
        Array.from({ length: n }, (_, j) => 0)
    );
    for (const mat of matrices) {
        for (let i = 0; i < m; i++) {
            for (let j = 0; j < n; j++) {
                result[i][j] += mat[i][j];
            }
        }
    }
    return result;
}

/* This was the original version that computed the pseudo-inverse incorrectly. It can not sovle the 6x7 matrix case correctly */
// function matPinv(A) {
//     // SVD-based pseudo-inverse
//     console.log("Computing SVD for matrix:", A);
//     const svd = numeric.svd(A);
//     console.log("SVD:", svd);

//     const U = svd.U;
//     const S = svd.S;
//     const V = svd.V;
//     const tol = 1e-6;
//     // S+ 
//     const S_inv = S.map(s => (Math.abs(s) > tol ? 1 / s : 0));
//     let Splus = numeric.rep([V[0].length, U[0].length], 0);
//     for (let i = 0; i < S_inv.length; i++) {
//         Splus[i][i] = S_inv[i];
//     }
//     // V * S+ * U^T
//     return numeric.dot(numeric.dot(V, Splus), numeric.transpose(U));
// }

/* Fixed version: it can solve the 6x7 matrix case correctly */
// function matPinv(A) {
//     // A: 6×7
//     const AT = numeric.transpose(A); // 7×6
//     const svd = numeric.svd(AT);    // SVD on 7×6
//     // const svd = new ml.SVD(AT); // Using ml-matrix for better stability
//     const U = svd.U;
//     const S = svd.S;
//     const V = svd.V;
//     const tol = 1e-3;
//     // S+ 
//     const S_inv = S.map(s => (Math.abs(s) > tol ? 1 / s : 0));
//     let Splus = numeric.rep([V[0].length, U[0].length], 0);
//     for (let i = 0; i < S_inv.length; i++) {
//         Splus[i][i] = S_inv[i];
//     }
//     // Pseudo-inverse: V * S+ * U^T, then transpose back
//     const pinvT = numeric.dot(numeric.dot(V, Splus), numeric.transpose(U));
//     return numeric.transpose(pinvT); // Return 7×6 → 6×7
// }

function matPinv(A) {
  // A: 2D array
  const mat = new ml.Matrix(A);
  const svd = new ml.SVD(mat);

  const U = svd.leftSingularVectors;
  const S = svd.diagonal;
  const V = svd.rightSingularVectors;

  const tol = 1e-2;
  // S+ (伪逆对角阵)
  const S_inv = S.map(s => (Math.abs(s) > tol ? 1 / s : 0));
  const Splus = ml.Matrix.zeros(V.columns, U.columns);
  for (let i = 0; i < S_inv.length; i++) {
    Splus.set(i, i, S_inv[i]);
  }
  // V * S+ * U^T
  const pinv = V.mmul(Splus).mmul(U.transpose());
  return pinv.to2DArray();
}

function deg2rad(deg) {
    if (Array.isArray(deg)) {
        return deg.map(d => deg2rad(d));
    }
    return deg * (Math.PI / 180);
}

function rad2deg(rad) {
    if (Array.isArray(rad)) {
        return rad.map(r => rad2deg(r));
    }
    return rad * (180 / Math.PI);
}

function worlr2three(v) {
    const R_three = [
        [0, -1, 0],
        [0,  0, 1],
        [-1, 0, 0]
    ]
    return matDot(R_three, v);
}

function three2world(v) {
    const R_three_inv = [
        [0, 0, -1],
        [-1, 0, 0],
        [0, 1, 0]
    ];
    return matDot(R_three_inv, v);
}

function worlr2threeT(T) {
    const T_three = [[0, -1, 0, 0],
                     [0,  0, 1, 0],
                     [-1, 0, 0, 0],
                     [0,  0, 0, 1]];
    return matDot(T_three, T);
}

function three2worldT(T) {  
    const T_three_inv = [
        [0, 0, -1, 0],
        [-1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 1]
    ];
    return matDot(T_three_inv, T);
}

/**
 * Rotation matrix to quaternion [x, y, z, w]
 * @param {Array<Array<number>>} R 3x3 Rotation matrix
 * @returns {Array<number>} [x, y, z, w]
 */
function RotMatToQuaternion(R) {
    const trace = R[0][0] + R[1][1] + R[2][2];
    let x, y, z, w;
    if (trace > 0) {
        let s = 0.5 / Math.sqrt(trace + 1.0);
        w = 0.25 / s;
        x = (R[2][1] - R[1][2]) * s;
        y = (R[0][2] - R[2][0]) * s;
        z = (R[1][0] - R[0][1]) * s;
    } else {
        if (R[0][0] > R[1][1] && R[0][0] > R[2][2]) {
            let s = 2.0 * Math.sqrt(1.0 + R[0][0] - R[1][1] - R[2][2]);
            w = (R[2][1] - R[1][2]) / s;
            x = 0.25 * s;
            y = (R[0][1] + R[1][0]) / s;
            z = (R[0][2] + R[2][0]) / s;
        } else if (R[1][1] > R[2][2]) {
            let s = 2.0 * Math.sqrt(1.0 + R[1][1] - R[0][0] - R[2][2]);
            w = (R[0][2] - R[2][0]) / s;
            x = (R[0][1] + R[1][0]) / s;
            y = 0.25 * s;
            z = (R[1][2] + R[2][1]) / s;
        } else {
            let s = 2.0 * Math.sqrt(1.0 + R[2][2] - R[0][0] - R[1][1]);
            w = (R[1][0] - R[0][1]) / s;
            x = (R[0][2] + R[2][0]) / s;
            y = (R[1][2] + R[2][1]) / s;
            z = 0.25 * s;
        }
    }
    return [x, y, z, w];
}

/**
 * Quaternion [x, y, z, w] to rotation matrix
 * @param {Array<number>} q Quaternion [x, y, z, w]
 * @returns {Array<Array<number>>} 3x3 rotation matrix
 */
function QuaternionToRotMat(q) {
    const [x, y, z, w] = q;
    return [
        [
            1 - 2 * (y * y + z * z),
            2 * (x * y - z * w),
            2 * (x * z + y * w)
        ],
        [
            2 * (x * y + z * w),
            1 - 2 * (x * x + z * z),
            2 * (y * z - x * w)
        ],
        [
            2 * (x * z - y * w),
            2 * (y * z + x * w),
            1 - 2 * (x * x + y * y)
        ]
    ];
}

/**
 * Rotation matrix to Euler angles
 * @param {Array<Array<number>>} R 3x3 rotation matrix
 * @param {string} order Euler angle order, e.g., "XYZ" or "ZYX"
 * @returns {Array<number>} Euler angles in radians
 */
// 预创建结果容器，如果你能确定始终是某个顺序，甚至可以不传 order
const EULER_RESULT = new Float32Array(3);

function RotMatToEuler(R, order = "ZYX", out = EULER_RESULT) {
    // 使用解构赋值拿到矩阵元素，减少属性查找开销
    const r00 = R[0][0], r01 = R[0][1], r02 = R[0][2];
    const r10 = R[1][0], r11 = R[1][1], r12 = R[1][2];
    const r20 = R[2][0], r21 = R[2][1], r22 = R[2][2];

    let x, y, z;

    if (order === "ZYX") {
        const sy = Math.sqrt(r00 * r00 + r10 * r10);
        if (sy > 1e-6) {
            x = Math.atan2(r21, r22);
            y = Math.atan2(-r20, sy);
            z = Math.atan2(r10, r00);
        } else {
            x = Math.atan2(-r12, r11);
            y = Math.atan2(-r20, sy);
            z = 0;
        }
        out[0] = z; out[1] = y; out[2] = x;
    } 
    else if (order === "XYZ") {
        const sy = Math.sqrt(r02 * r02 + r12 * r12);
        if (sy > 1e-6) {
            x = Math.atan2(r12, r22);
            y = Math.atan2(-r02, sy);
            z = Math.atan2(r01, r00);
        } else {
            x = Math.atan2(-r21, r11);
            y = Math.atan2(-r02, sy);
            z = 0;
        }
        out[0] = x; out[1] = y; out[2] = z;
    } 
    else if (order === "ZYZ") {
        const beta = Math.acos(r22);
        const absBeta = Math.abs(beta);
        if (absBeta > 1e-6 && Math.abs(beta - Math.PI) > 1e-6) {
            out[0] = Math.atan2(r12, r02);
            out[1] = beta;
            out[2] = Math.atan2(r21, -r20);
        } else {
            out[0] = 0;
            out[1] = beta;
            out[2] = (absBeta <= 1e-6) ? Math.atan2(r01, r00) : -Math.atan2(r01, r00);
        }
        return out;
    }
    
    return out;
}


/**
 * Euler angles to rotation matrix
 * @param {Array<number>} euler Euler angles in radians
 * @param {string} order Euler angle order, e.g., "XYZ" or "ZYX"
 * @returns {Array<Array<number>>} 3x3 rotation matrix
 */
function EulerToRotMat(euler, order = "ZYX") {
    const [alpha, beta, gamma] = euler;
    function Rz(angle) {
        return [
            [Math.cos(angle), -Math.sin(angle), 0],
            [Math.sin(angle),  Math.cos(angle), 0],
            [0, 0, 1]
        ];
    }
    function Ry(angle) {
        return [
            [ Math.cos(angle), 0, Math.sin(angle)],
            [0, 1, 0],
            [-Math.sin(angle), 0, Math.cos(angle)]
        ];
    }
    function Rx(angle) {
        return [
            [1, 0, 0],
            [0, Math.cos(angle), -Math.sin(angle)],
            [0, Math.sin(angle),  Math.cos(angle)]
        ];
    }

    if (order === "ZYX") {
        // [yaw(Z), pitch(Y), roll(X)]
        return matDot(matDot(Rz(alpha), Ry(beta)), Rx(gamma));
    } else if (order === "XYZ") {
        // [roll(X), pitch(Y), yaw(Z)]
        return matDot(matDot(Rx(alpha), Ry(beta)), Rz(gamma));
    } else if (order === "ZYZ") {
        // [roll(X), pitch(Y), yaw(Z)]
        return matDot(matDot(Rz(alpha), Ry(beta)), Rz(gamma));
    } 
    else {
        throw new Error("Unsupported Euler order: " + order);
    }
}



// *** CHAPTER 3: RIGID-BODY MOTIONS *** (more details on p69-70)
/**
 * Inverts a rotation matrix (i.e., returns its transpose)
 * @param {Array<Array<number>>} R A 3x3 rotation matrix
 * @returns {Array<Array<number>>} The inverse (transpose) of R
 * Example Input:
 *   R = [
 *     [0, 0, 1],
 *     [1, 0, 0],
 *     [0, 1, 0]
 *   ]
 * Output:
 *   [
 *     [0, 1, 0],
 *     [0, 0, 1],
 *     [1, 0, 0]
 *   ]
 */
// function RotInv(R) {
//     // Invert a 3x3 rotation matrix by transposing it
//     if (R.length !== 3 || R[0].length !== 3) {
//         throw new Error("Input must be a 3x3 matrix");
//     }
//     return R[0].map((_, col) => R.map(row => row[col]));
// }
function RotInv(R) {
    // 直接通过索引解构并重新构造
    // R[row][col] -> R[col][row]
    return [
        [R[0][0], R[1][0], R[2][0]],
        [R[0][1], R[1][1], R[2][1]],
        [R[0][2], R[1][2], R[2][2]]
    ];
}

/**
 * Converts a 3-vector to an so(3) (skew-symmetric) matrix
 * @param {Array<number>} omg A 3-vector
 * @returns {Array<Array<number>>} The skew-symmetric matrix of omg
 * Example Input:
 *   omg = [1, 2, 3]
 * Output:
 *   [
 *     [ 0, -3,  2],
 *     [ 3,  0, -1],
 *     [-2,  1,  0]
 *   ]
 */
function VecToso3(omg) {
    return [
        [0,      -omg[2],  omg[1]],
        [omg[2],      0,  -omg[0]],
        [-omg[1], omg[0],      0]
    ];
}

/**
 * Converts an so(3) (skew-symmetric) matrix to a 3-vector
 * @param {Array<Array<number>>} so3mat A 3x3 skew-symmetric matrix
 * @returns {Array<number>} The 3-vector corresponding to so3mat
 * Example Input:
 *   so3mat = [
 *     [ 0, -3,  2],
 *     [ 3,  0, -1],
 *     [-2,  1,  0]
 *   ]
 * Output:
 *   [1, 2, 3]
 */
function so3ToVec(so3mat) {
    return [
        so3mat[2][1],
        so3mat[0][2],
        so3mat[1][0]
    ];
}

/**
 * Converts a 3-vector of exponential coordinates for rotation into axis-angle form
 * @param {Array<number>} expc3 A 3-vector of exponential coordinates for rotation
 * @returns {[Array<number>, number]} [omghat, theta] where omghat is the unit axis, theta is the angle
 * Example Input:
 *   expc3 = [1, 2, 3]
 * Output:
 *   ([0.26726124, 0.53452248, 0.80178373], 3.7416573867739413)
 */
function AxisAng3(expc3) {
    const norm = Norm(expc3);
    if (NearZero(norm)) {
        // If norm is near zero, return zero vector and zero angle
        return [Normalize(expc3), 0];
    }
    const omghat = Normalize(expc3);
    const theta = norm;
    // Return the unit axis and the angle
    return [omghat, theta];
}

/**
 * Computes the matrix exponential of a matrix in so(3) (3.51)
 * @description Rodrigues's formula for computing the matrix exponential of a skew-symmetric matrix
 * @param {Array<Array<number>>} so3mat A 3x3 skew-symmetric matrix
 * @returns {Array<Array<number>>} The matrix exponential of so3mat (a rotation matrix)
 * Example Input:
 *   so3mat = [
 *     [ 0, -3,  2],
 *     [ 3,  0, -1],
 *     [-2,  1,  0]
 *   ]
 * Output:
 *   [
 *     [-0.69492056,  0.71352099,  0.08929286],
 *     [-0.19200697, -0.30378504,  0.93319235],
 *     [ 0.69297817,  0.6313497 ,  0.34810748]
 *   ]
 */
function MatrixExp3(so3mat) {
    const omgtheta = so3ToVec(so3mat);
    const norm = Norm(omgtheta)
    if (NearZero(norm)) {
        // return the identity matrix if the norm is near zero
        return Eye(3);
    } else {
        const theta = norm;
        const omgmat = so3mat.map(row => row.map(val => val / theta));
        // compute omgmat^2
        const omgmat2 = matDot(omgmat, omgmat);
        // compute R = I + sin(theta)*omgmat + (1-cos(theta))*omgmat^2
        const I = Eye(3);
        const sinTerm = omgmat.map(row => row.map(val => Math.sin(theta) * val));
        const cosTerm = omgmat2.map(row => row.map(val => (1 - Math.cos(theta)) * val));
        // R = I + sinTerm + cosTerm
        let R = [];
        R = matAddN(I, sinTerm, cosTerm);
        // return the resulting rotation matrix
        return R;
    }
}

/**
 * Computes the matrix logarithm of a rotation matrix p51
 * @param {Array<Array<number>>} R A 3x3 rotation matrix
 * @returns {Array<Array<number>>} The matrix logarithm of R (a 3x3 skew-symmetric matrix)
 * Example Input:
 *   R = [
 *     [0, 0, 1],
 *     [1, 0, 0],
 *     [0, 1, 0]
 *   ]
 * Output:
 *   [
 *     [0, -1.20919958, 1.20919958],
 *     [1.20919958, 0, -1.20919958],
 *     [-1.20919958, 1.20919958, 0]
 *   ]
 */
// function MatrixLog3(R) {
//     const trace = R[0][0] + R[1][1] + R[2][2];
//     const acosinput = (trace - 1) / 2.0;
//     if (acosinput >= 1) {
//         // log(I) = 0
//         return [
//             [0, 0, 0],
//             [0, 0, 0],
//             [0, 0, 0]
//         ];
//     } else if (acosinput <= -1) {
//         let omg;
//         if (!NearZero(1 + R[2][2])) {
//             omg = [
//                 R[0][2] / Math.sqrt(2 * (1 + R[2][2])),
//                 R[1][2] / Math.sqrt(2 * (1 + R[2][2])),
//                 1
//             ];
//         } else if (!NearZero(1 + R[1][1])) {
//             omg = [
//                 R[0][1] / Math.sqrt(2 * (1 + R[1][1])),
//                 1,
//                 R[2][1] / Math.sqrt(2 * (1 + R[1][1]))
//             ];
//         } else {
//             omg = [
//                 1,
//                 R[1][0] / Math.sqrt(2 * (1 + R[0][0])),
//                 R[2][0] / Math.sqrt(2 * (1 + R[0][0]))
//             ];
//         }
//         omg = Norm(omg);
//         return VecToso3(omg.map(x => Math.PI * x));
//     } else {
//         const theta = Math.acos(acosinput);
//         // (R - R^T) * (theta / (2 * sin(theta)))
//         const R_minus_RT = [
//             [0, R[0][1] - R[1][0], R[0][2] - R[2][0]],
//             [R[1][0] - R[0][1], 0, R[1][2] - R[2][1]],
//             [R[2][0] - R[0][2], R[2][1] - R[1][2], 0]
//         ];
//         const factor = theta / (2 * Math.sin(theta));
//         return R_minus_RT.map(row => row.map(val => factor * val));
//     }
// }

function MatrixLog3(R) {
    const r11 = R[0][0], r12 = R[0][1], r13 = R[0][2];
    const r21 = R[1][0], r22 = R[1][1], r23 = R[1][2];
    const r31 = R[2][0], r32 = R[2][1], r33 = R[2][2];

    const trace = r11 + r21 + r33;
    const acosinput = Math.max(-1, Math.min(1, (trace - 1) / 2.0));

    // Case 1: theta ≈ 0
    if (acosinput >= 0.9999999) {
        return [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    }

    // Case 2: theta ≈ pi (Singularity)
    if (acosinput <= -0.9999999) {
        let v1, v2, v3;
        // 寻找最大的对角元素以提高数值稳定性
        if (r33 > r22 && r33 > r11) {
            const s = Math.sqrt(r33 - r11 - r22 + 1.0) * 2;
            v1 = r13 / s;
            v2 = r23 / s;
            v3 = 0.25 * s;
        } else if (r22 > r11) {
            const s = Math.sqrt(r22 - r11 - r33 + 1.0) * 2;
            v1 = r12 / s;
            v2 = 0.25 * s;
            v3 = r32 / s;
        } else {
            const s = Math.sqrt(r11 - r22 - r33 + 1.0) * 2;
            v1 = 0.25 * s;
            v2 = r21 / s;
            v3 = r31 / s;
        }
        // 归一化并乘上 PI
        const mag = Math.sqrt(v1 * v1 + v2 * v2 + v3 * v3);
        const factor = Math.PI / mag;
        const w1 = v1 * factor, w2 = v2 * factor, w3 = v3 * factor;
        return [[0, -w3, w2], [w3, 0, -w1], [-w2, w1, 0]];
    }

    // Case 3: Normal case
    const theta = Math.acos(acosinput);
    let factor;
    // 小角度泰勒展开，防止 sin(theta) 近似 0
    if (theta < 1e-6) {
        factor = 0.5 * (1 + (theta * theta) / 6.0);
    } else {
        factor = theta / (2 * Math.sin(theta));
    }

    const w1 = (r32 - r23) * factor;
    const w2 = (r13 - r31) * factor;
    const w3 = (r21 - r12) * factor;

    return [
        [0, -w3, w2],
        [w3, 0, -w1],
        [-w2, w1, 0]
    ];
}

/**
 * Converts a rotation matrix and a position vector into a homogeneous transformation matrix
 * @param {Array<Array<number>>} R 3x3 rotation matrix
 * @param {Array<number>} p 3x1 position vector
 * @returns {Array<Array<number>>} 4x4 homogeneous transformation matrix
 * Example Input:
 *   R = [
 *     [1, 0,  0],
 *     [0, 0, -1],
 *     [0, 1,  0]
 *   ]
 *   p = [1, 2, 5]
 * Output:
 *   [
 *     [1, 0,  0, 1],
 *     [0, 0, -1, 2],
 *     [0, 1,  0, 5],
 *     [0, 0,  0, 1]
 *   ]
 */
function RpToTrans(R, p) {
    return [
        [R[0][0], R[0][1], R[0][2], p[0]],
        [R[1][0], R[1][1], R[1][2], p[1]],
        [R[2][0], R[2][1], R[2][2], p[2]],
        [0, 0, 0, 1]
    ];
}

/**
 * Converts a homogeneous transformation matrix into a rotation matrix and position vector
 * @param {Array<Array<number>>} T 4x4 homogeneous transformation matrix
 * @returns {[Array<Array<number>>, Array<number>]} [R, p] where R is 3x3 rotation matrix, p is 3x1 position vector
 * Example Input:
 *   T = [
 *     [1, 0,  0, 0],
 *     [0, 0, -1, 0],
 *     [0, 1,  0, 3],
 *     [0, 0,  0, 1]
 *   ]
 * Output:
 *   [
 *     [
 *       [1, 0,  0],
 *       [0, 0, -1],
 *       [0, 1,  0]
 *     ],
 *     [0, 0, 3]
 *   ]
 */
function TransToRp(T) {
    const R = [
        [T[0][0], T[0][1], T[0][2]],
        [T[1][0], T[1][1], T[1][2]],
        [T[2][0], T[2][1], T[2][2]]
    ];
    const p = [T[0][3], T[1][3], T[2][3]];
    return [R, p];
}

/**
 * Inverts a homogeneous transformation matrix
 * @param {Array<Array<number>>} T 4x4 homogeneous transformation matrix
 * @returns {Array<Array<number>>} The inverse of T
 * Example Input:
 *   T = [
 *     [1, 0,  0, 0],
 *     [0, 0, -1, 0],
 *     [0, 1,  0, 3],
 *     [0, 0,  0, 1]
 *   ]
 * Output:
 *   [
 *     [1,  0, 0,  0],
 *     [0,  0, 1, -3],
 *     [0, -1, 0,  0],
 *     [0,  0, 0,  1]
 *   ]
 */
// function TransInv(T) {
//     const [R, p] = TransToRp(T);
//     // RotInv returns the inverse of a rotation matrix, which is its transpose
//     const Rt = RotInv(R);
//     // -Rt * p
//     const minus_Rt_p = [
//         -(Rt[0][0] * p[0] + Rt[0][1] * p[1] + Rt[0][2] * p[2]),
//         -(Rt[1][0] * p[0] + Rt[1][1] * p[1] + Rt[1][2] * p[2]),
//         -(Rt[2][0] * p[0] + Rt[2][1] * p[1] + Rt[2][2] * p[2])
//     ];
//     return [
//         [Rt[0][0], Rt[0][1], Rt[0][2], minus_Rt_p[0]],
//         [Rt[1][0], Rt[1][1], Rt[1][2], minus_Rt_p[1]],
//         [Rt[2][0], Rt[2][1], Rt[2][2], minus_Rt_p[2]],
//         [0, 0, 0, 1]
//     ];
// }

function TransInv(T) {
    const r11 = T[0][0], r12 = T[0][1], r13 = T[0][2], px = T[0][3];
    const r21 = T[1][0], r22 = T[1][1], r23 = T[1][2], py = T[1][3];
    const r31 = T[2][0], r32 = T[2][1], r33 = T[2][2], pz = T[2][3];

    // 计算 -R^T * p
    const negative_Rt_p_x = -(r11 * px + r21 * py + r31 * pz);
    const negative_Rt_p_y = -(r12 * px + r22 * py + r32 * pz);
    const negative_Rt_p_z = -(r13 * px + r23 * py + r33 * pz);

    return [
        [r11, r21, r31, negative_Rt_p_x],
        [r12, r22, r32, negative_Rt_p_y],
        [r13, r23, r33, negative_Rt_p_z],
        [0,   0,   0,   1]
    ];
}

/**
 * Converts a spatial velocity vector into a 4x4 matrix in se(3)
 * @param {Array<number>} V A 6-vector representing a spatial velocity [w1, w2, w3, v1, v2, v3]
 * @returns {Array<Array<number>>} The 4x4 se(3) matrix representation of V
 * Example Input:
 *   V = [1, 2, 3, 4, 5, 6]
 * Output:
 *   [
 *     [ 0, -3,  2, 4],
 *     [ 3,  0, -1, 5],
 *     [-2,  1,  0, 6],
 *     [ 0,  0,  0, 0]
 *   ]
 */
function VecTose3(V) {
    const omg = [V[0], V[1], V[2]];
    const v = [V[3], V[4], V[5]];
    const so3mat = VecToso3(omg);
    return [
        [so3mat[0][0], so3mat[0][1], so3mat[0][2], v[0]],
        [so3mat[1][0], so3mat[1][1], so3mat[1][2], v[1]],
        [so3mat[2][0], so3mat[2][1], so3mat[2][2], v[2]],
        [0, 0, 0, 0]
    ];
}

/**
 * Converts an se(3) matrix into a spatial velocity 6-vector
 * @param {Array<Array<number>>} se3mat A 4x4 matrix in se(3)
 * @returns {Array<number>} The spatial velocity 6-vector [w1, w2, w3, v1, v2, v3]
 * Example Input:
 *   se3mat = [
 *     [ 0, -3,  2, 4],
 *     [ 3,  0, -1, 5],
 *     [-2,  1,  0, 6],
 *     [ 0,  0,  0, 0]
 *   ]
 * Output:
 *   [1, 2, 3, 4, 5, 6]
 */
function se3ToVec(se3mat) {
    return [
        se3mat[2][1],
        se3mat[0][2],
        se3mat[1][0],
        se3mat[0][3],
        se3mat[1][3],
        se3mat[2][3]
    ];
}

/**
 * Computes the adjoint representation of a homogeneous transformation matrix
 * @param {Array<Array<number>>} T 4x4 homogeneous transformation matrix
 * @returns {Array<Array<number>>} The 6x6 adjoint representation [AdT] of T
 * Example Input:
 *   T = [
 *     [1, 0,  0, 0],
 *     [0, 0, -1, 0],
 *     [0, 1,  0, 3],
 *     [0, 0,  0, 1]
 *   ]
 * Output:
 *   [
 *     [1, 0,  0, 0, 0,  0],
 *     [0, 0, -1, 0, 0,  0],
 *     [0, 1,  0, 0, 0,  0],
 *     [0, 0,  3, 1, 0,  0],
 *     [3, 0,  0, 0, 0, -1],
 *     [0, 0,  0, 0, 1,  0]
 *   ]
 */
// function Adjoint(T) {
//     const [R, p] = TransToRp(T);
//     const zero3 = [
//         [0, 0, 0],
//         [0, 0, 0],
//         [0, 0, 0]
//     ];
//     const p_hat = VecToso3(p);
//     const p_hat_R = matDot(p_hat, R);

//     // 构造6x6矩阵
//     let AdT = Array.from({ length: 6 }, () => Array(6).fill(0));
//     // 左上R
//     for (let i = 0; i < 3; i++)
//         for (let j = 0; j < 3; j++)
//             AdT[i][j] = R[i][j];
//     // 右上0
//     // 左下p_hat*R
//     for (let i = 0; i < 3; i++)
//         for (let j = 0; j < 3; j++)
//             AdT[i + 3][j] = p_hat_R[i][j];
//     // 右下R
//     for (let i = 0; i < 3; i++)
//         for (let j = 0; j < 3; j++)
//             AdT[i + 3][j + 3] = R[i][j];
//     return AdT;
// }

function Adjoint(T) {
    // 假设 T 是 4x4 嵌套数组或平铺数组
    // 直接提取 R 和 p，减少函数调用开销
    const r11 = T[0][0], r12 = T[0][1], r13 = T[0][2], px = T[0][3];
    const r21 = T[1][0], r22 = T[1][1], r23 = T[1][2], py = T[1][3];
    const r31 = T[2][0], r32 = T[2][1], r33 = T[2][2], pz = T[2][3];

    // 预分配或直接返回一维数组（对现代 JS 引擎更友好）
    // 如果必须返回 6x6 嵌套数组，建议如下手动构造：
    return [
        [r11, r12, r13, 0, 0, 0],
        [r21, r22, r23, 0, 0, 0],
        [r31, r32, r33, 0, 0, 0],
        // 下面三行是 [p] * R 的展开计算
        [py*r31 - pz*r21, py*r32 - pz*r22, py*r33 - pz*r23, r11, r12, r13],
        [pz*r11 - px*r31, pz*r12 - px*r32, pz*r13 - px*r33, r21, r22, r23],
        [px*r21 - py*r11, px*r22 - py*r12, px*r23 - py*r13, r31, r32, r33]
    ];
}

/**
 * Takes a parametric description of a screw axis and converts it to a normalized screw axis
 * @param {Array<number>} q A point lying on the screw axis (3-vector)
 * @param {Array<number>} s A unit vector in the direction of the screw axis (3-vector)
 * @param {number} h The pitch of the screw axis
 * @returns {Array<number>} A normalized screw axis [s, q×s + h*s]
 * Example Input:
 *   q = [3, 0, 0]
 *   s = [0, 0, 1]
 *   h = 2
 * Output:
 *   [0, 0, 1, 0, -3, 2]
 */
function ScrewToAxis(q, s, h) {
    // cross q × s
    const q_cross_s = [
        q[1] * s[2] - q[2] * s[1],
        q[2] * s[0] - q[0] * s[2],
        q[0] * s[1] - q[1] * s[0]
    ];
    // h * s
    const h_s = s.map(val => h * val);
    // v = q × s + h * s
    const v = q_cross_s.map((val, i) => val + h_s[i]);
    // Return [s, v]
    return [...s, ...v];
}

/**
 * Converts a 6-vector of exponential coordinates into screw axis-angle form
 * @param {Array<number>} expc6 A 6-vector of exponential coordinates for rigid-body motion (S*theta)
 * @returns {[Array<number>, number]} [S, theta] where S is the normalized screw axis, theta is the distance
 * Example Input:
 *   expc6 = [1, 0, 0, 1, 2, 3]
 * Output:
 *   ([1.0, 0.0, 0.0, 0.26726, 0.53452, 0.80178], 3.74165)
 */
function AxisAng6(expc6) {
    // Normalize the first three elements to get the screw axis
    const norm = Norm(expc6.slice(0, 3));
    if (NearZero(norm)) {
        // If the first three elements are near zero, normalize the last three
        return [Norm(expc6.slice(3, 6)), 0];
    }
    // Normalize the first three elements to get the screw axis
    const S = Norm(expc6.slice(0, 3));
    // Compute the theta value as the norm of the first three elements
    const theta = Norm(expc6.slice(3, 6));
    // Scale the second half of the vector by theta
    const scaledExpc6 = expc6.map((val, i) => (i < 3 ? val / norm : val / theta));
    // Return the normalized screw axis and the theta value
    return [scaledExpc6, theta];
}

/**
 * Computes the matrix exponential of an se(3) representation of exponential coordinates
 * @param {Array<Array<number>>} se3mat A 4x4 matrix in se(3)
 * @returns {Array<Array<number>>} The matrix exponential of se3mat (a 4x4 transformation matrix)
 * Example Input:
 *   se3mat = [
 *     [0, 0, 0, 0],
 *     [0, 0, -1.57079632, 2.35619449],
 *     [0, 1.57079632, 0, 2.35619449],
 *     [0, 0, 0, 0]
 *   ]
 * Output:
 *   [
 *     [1.0, 0.0,  0.0, 0.0],
 *     [0.0, 0.0, -1.0, 0.0],
 *     [0.0, 1.0,  0.0, 3.0],
 *     [0,   0,    0,   1]
 *   ]
 */
// function MatrixExp6(se3mat) {
//     // Extract rotation and translation parts
//     const omgmat = [
//         [se3mat[0][0], se3mat[0][1], se3mat[0][2]],
//         [se3mat[1][0], se3mat[1][1], se3mat[1][2]],
//         [se3mat[2][0], se3mat[2][1], se3mat[2][2]]
//     ];
//     const v = [se3mat[0][3], se3mat[1][3], se3mat[2][3]];
//     const omgtheta = so3ToVec(omgmat);
//     const norm_omg = Norm(omgtheta);

//     if (NearZero(norm_omg)) {
//         // Pure translation case
//         return [
//             [1, 0, 0, v[0]],
//             [0, 1, 0, v[1]],
//             [0, 0, 1, v[2]],
//             [0, 0, 0, 1]
//         ];
//     } else {
//         const theta = AxisAng3(omgtheta)[1];
//         // omgmat / theta
//         const omgmat_unit = omgmat.map(row => row.map(val => val / theta));
//         // Compute rotation part
//         const R = MatrixExp3(omgmat);
//         // Compute translation part
//         // V = I*theta + (1-cos(theta))*omgmat_unit + (theta-sin(theta))*omgmat_unit^2 (3.87)
//         const I = Eye(3);
//         const omgmat_unit2 = matDot(omgmat_unit, omgmat_unit);
//         const Vmat = matAddN(
//             I.map(row => row.map(val => val * theta)),
//             omgmat_unit.map(row => row.map(val => (1 - Math.cos(theta)) * val)),
//             omgmat_unit2.map(row => row.map(val => (theta - Math.sin(theta)) * val))
//         );
//         // Vmat * v
//         const p = [
//             Vmat[0][0] * v[0] + Vmat[0][1] * v[1] + Vmat[0][2] * v[2],
//             Vmat[1][0] * v[0] + Vmat[1][1] * v[1] + Vmat[1][2] * v[2],
//             Vmat[2][0] * v[0] + Vmat[2][1] * v[1] + Vmat[2][2] * v[2]
//         ].map(val => val / theta);

//         // Assemble 4x4 transformation matrix
//         return [
//             [R[0][0], R[0][1], R[0][2], p[0]],
//             [R[1][0], R[1][1], R[1][2], p[1]],
//             [R[2][0], R[2][1], R[2][2], p[2]],
//             [0, 0, 0, 1]
//         ];
//     }
// }

function MatrixExp6(se3mat) {
    // 直接从 se3mat 提取分量，避免多余函数调用
    const o1 = se3mat[2][1], o2 = se3mat[0][2], o3 = se3mat[1][0]; // omega
    const v1 = se3mat[0][3], v2 = se3mat[1][3], v3 = se3mat[2][3]; // velocity v
    
    const thetaSq = o1 * o1 + o2 * o2 + o3 * o3;
    const theta = Math.sqrt(thetaSq);

    // 1. 处理纯平移情况 (theta -> 0)
    if (theta < 1e-6) {
        return [
            [1, 0, 0, v1],
            [0, 1, 0, v2],
            [0, 0, 1, v3],
            [0, 0, 0, 1]
        ];
    }

    // 2. 预计算三角函数
    const s = Math.sin(theta);
    const c = Math.cos(theta);
    const invThetaSq = 1.0 / thetaSq;
    const a = (1 - c) * invThetaSq;
    const b = (theta - s) * (invThetaSq / theta);

    // 3. 计算旋转矩阵 R (直接展开 Rodrigues 公式)
    // R = I + (sin(theta)/theta)*[omg] + ((1-cos(theta))/theta^2)*[omg]^2
    const k = s / theta;
    const R = [
        [1 - a * (o2 * o2 + o3 * o3), a * o1 * o2 - k * o3,     a * o1 * o3 + k * o2],
        [a * o1 * o2 + k * o3,     1 - a * (o1 * o1 + o3 * o3), a * o2 * o3 - k * o1],
        [a * o1 * o3 - k * o2,     a * o2 * o3 + k * o1,     1 - a * (o1 * o1 + o2 * o2)]
    ];

    // 4. 计算位移部分 p (利用叉积简化运算)
    // p = v + a*([omg]x v) + b*([omg]x ([omg]x v))
    const cross_ov = [
        o2 * v3 - o3 * v2,
        o3 * v1 - o1 * v3,
        o1 * v2 - o2 * v1
    ];
    const cross_o_ov = [
        o2 * cross_ov[2] - o3 * cross_ov[1],
        o3 * cross_ov[0] - o1 * cross_ov[2],
        o1 * cross_ov[1] - o2 * cross_ov[0]
    ];

    const p = [
        v1 + a * cross_ov[0] + b * cross_o_ov[0],
        v2 + a * cross_ov[1] + b * cross_o_ov[1],
        v3 + a * cross_ov[2] + b * cross_o_ov[2]
    ];

    return [
        [R[0][0], R[0][1], R[0][2], p[0]],
        [R[1][0], R[1][1], R[1][2], p[1]],
        [R[2][0], R[2][1], R[2][2], p[2]],
        [0, 0, 0, 1]
    ];
}

/**
 * Computes the matrix logarithm of a homogeneous transformation matrix
 * @param {Array<Array<number>>} T A 4x4 matrix in SE(3)
 * @returns {Array<Array<number>>} The matrix logarithm of T (a 4x4 se(3) matrix)
 * Example Input:
 *   T = [
 *     [1, 0,  0, 0],
 *     [0, 0, -1, 0],
 *     [0, 1,  0, 3],
 *     [0, 0,  0, 1]
 *   ]
 * Output:
 *   [
 *     [0, 0, 0, 0],
 *     [0, 0, -1.57079633, 2.35619449],
 *     [0, 1.57079633, 0, 2.35619449],
 *     [0, 0, 0, 0]
 *   ]
 */
// function MatrixLog6(T) {
//     const [R, p] = TransToRp(T);
//     const omgmat = MatrixLog3(R);
//     // Check if omgmat is all zeros
//     const isZeroOmg = omgmat.flat().every(x => NearZero(x));
//     if (isZeroOmg) {
//         // Pure translation case
//         return [
//             [0, 0, 0, T[0][3]],
//             [0, 0, 0, T[1][3]],
//             [0, 0, 0, T[2][3]],
//             [0, 0, 0, 0]
//         ];
//     } else {
//         const theta = Math.acos((R[0][0] + R[1][1] + R[2][2] - 1) / 2.0);
//         // G_inv = I - 0.5*omgmat + (1/theta - 0.5/Math.tan(theta/2)) * omgmat^2 / theta
//         const I = Eye(3);
//         const omgmat2 = matDot(omgmat, omgmat);
//         const tanHalfTheta = Math.tan(theta / 2.0);
//         const coeff = (1.0 / theta - 1.0 / (2 * tanHalfTheta)) / theta;
//         // G_inv = I - 0.5*omgmat + coeff*omgmat2
//         const G_inv = matAddN(
//             I,
//             omgmat.map(row => row.map(val => -0.5 * val)),
//             omgmat2.map(row => row.map(val => coeff * val))
//         );
//         // G_inv * p
//         const v = [
//             G_inv[0][0] * p[0] + G_inv[0][1] * p[1] + G_inv[0][2] * p[2],
//             G_inv[1][0] * p[0] + G_inv[1][1] * p[1] + G_inv[1][2] * p[2],
//             G_inv[2][0] * p[0] + G_inv[2][1] * p[1] + G_inv[2][2] * p[2]
//         ];
//         return [
//             [omgmat[0][0], omgmat[0][1], omgmat[0][2], v[0]],
//             [omgmat[1][0], omgmat[1][1], omgmat[1][2], v[1]],
//             [omgmat[2][0], omgmat[2][1], omgmat[2][2], v[2]],
//             [0, 0, 0, 0]
//         ];
//     }
// }

function MatrixLog6(T) {
    const r11 = T[0][0], r12 = T[0][1], r13 = T[0][2], px = T[0][3];
    const r21 = T[1][0], r22 = T[1][1], r23 = T[1][2], py = T[1][3];
    const r31 = T[2][0], r32 = T[2][1], r33 = T[2][2], pz = T[2][3];

    // 1. 调用 MatrixLog3 并获取 theta
    const omgmat = MatrixLog3([ [r11, r12, r13], [r21, r22, r23], [r31, r32, r33] ]);
    
    // 从矩阵中提取 omg 向量，避免重复调用函数
    const o1 = omgmat[2][1], o2 = omgmat[0][2], o3 = omgmat[1][0];
    const thetaSq = o1 * o1 + o2 * o2 + o3 * o3;
    const theta = Math.sqrt(thetaSq);

    let v;
    if (theta < 1e-6) {
        // 【优化：泰勒展开】处理纯平移或极小旋转，避免分母为 0
        // G_inv 此时近似为 I - 0.5*omgmat + (1/12)*omgmat^2
        v = [px, py, pz]; 
    } else {
        const invThetaSq = 1.0 / thetaSq;
        const halfTheta = theta / 2.0;
        // 【优化：系数计算】
        const coeff = (1.0 - (halfTheta / Math.tan(halfTheta))) * invThetaSq;

        // 【核心优化：合并 G_inv * p 计算】
        // 不需要先算出 G_inv 矩阵，直接计算向量 v = p - 0.5 * omg x p + coeff * omg x (omg x p)
        const cross_op = [
            o2 * pz - o3 * py,
            o3 * px - o1 * pz,
            o1 * py - o2 * px
        ];
        const cross_o_op = [
            o2 * cross_op[2] - o3 * cross_op[1],
            o3 * cross_op[0] - o1 * cross_op[2],
            o1 * cross_op[1] - o2 * cross_op[0]
        ];

        v = [
            px - 0.5 * cross_op[0] + coeff * cross_o_op[0],
            py - 0.5 * cross_op[1] + coeff * cross_o_op[1],
            pz - 0.5 * cross_op[2] + coeff * cross_o_op[2]
        ];
    }

    return [
        [omgmat[0][0], omgmat[0][1], omgmat[0][2], v[0]],
        [omgmat[1][0], omgmat[1][1], omgmat[1][2], v[1]],
        [omgmat[2][0], omgmat[2][1], omgmat[2][2], v[2]],
        [0, 0, 0, 0]
    ];
}

/**
 * Returns a projection of mat into SO(3)
 * @param {Array<Array<number>>} mat A matrix near SO(3) to project to SO(3)
 * @returns {Array<Array<number>>} The closest matrix to mat that is in SO(3)
 * Uses SVD: mat = U * S * V^T, then R = U * V^T. If det(R) < 0, flip last column of U.
 * Example Input:
 *   mat = [
 *     [0.675,  0.150,  0.720],
 *     [0.370,  0.771, -0.511],
 *     [-0.630, 0.619,  0.472]
 *   ]
 * Output:
 *   [
 *     [0.67901136,  0.14894516,  0.71885945],
 *     [0.37320708,  0.77319584, -0.51272279],
 *     [-0.63218672, 0.61642804,  0.46942137]
 *   ]
 */
function ProjectToSO3(mat) {
    // Only applicable when mat is close to SO(3)
    // Requires SVD, here using numeric.js library or custom SVD implementation
    // Assume numeric.svd is available, otherwise need to import SVD library
    const svd = numeric.svd(mat);
    let U = svd.U;
    let V = svd.V;
    // R = U * V^T
    let R = matDot(U, numeric.transpose(V));
    const detR = R[0][0]*(R[1][1]*R[2][2]-R[1][2]*R[2][1])
               - R[0][1]*(R[1][0]*R[2][2]-R[1][2]*R[2][0])
               + R[0][2]*(R[1][0]*R[2][1]-R[1][1]*R[2][0]);
    if (detR < 0) {
        // Flip the last column of U
        for (let i = 0; i < 3; i++) {
            U[i][2] *= -1;
        }
        R = matDot(U, numeric.transpose(V));
    }
    return R;
}

/**
 * Returns a projection of mat into SE(3)
 * @param {Array<Array<number>>} mat A 4x4 matrix to project to SE(3)
 * @returns {Array<Array<number>>} The closest matrix to mat that is in SE(3)
 * Projects a matrix mat to the closest matrix in SE(3) using SVD (for rotation part)
 * Example Input:
 *   mat = [
 *     [0.675,  0.150,  0.720,  1.2],
 *     [0.370,  0.771, -0.511,  5.4],
 *     [-0.630,  0.619,  0.472,  3.6],
 *     [0.003,  0.002,  0.010,  0.9]
 *   ]
 * Output:
 *   [
 *     [0.67901136,  0.14894516,  0.71885945,  1.2 ],
 *     [0.37320708,  0.77319584, -0.51272279,  5.4 ],
 *     [-0.63218672, 0.61642804,  0.46942137,  3.6 ],
 *     [0, 0, 0, 1]
 *   ]
 */
function ProjectToSE3(mat) {
    // Extract rotation and translation parts
    const R = ProjectToSO3([
        [mat[0][0], mat[0][1], mat[0][2]],
        [mat[1][0], mat[1][1], mat[1][2]],
        [mat[2][0], mat[2][1], mat[2][2]]
    ]);
    const p = [mat[0][3], mat[1][3], mat[2][3]];
    return RpToTrans(R, p);
}

/**
 * Returns the Frobenius norm to describe the distance of mat from the SO(3) manifold
 * @param {Array<Array<number>>} mat A 3x3 matrix
 * @returns {number} A quantity describing the distance of mat from the SO(3) manifold
 * If det(mat) <= 0, return a large number (1e9).
 * If det(mat) > 0, return norm(mat^T * mat - I).
 * Example Input:
 *   mat = [
 *     [1.0,  0.0,   0.0],
 *     [0.0,  0.1,  -0.95],
 *     [0.0,  1.0,   0.1]
 *   ]
 * Output:
 *   0.08835
 */
function DistanceToSO3(mat) {
    // Compute determinant
    const det =
        mat[0][0] * (mat[1][1] * mat[2][2] - mat[1][2] * mat[2][1]) -
        mat[0][1] * (mat[1][0] * mat[2][2] - mat[1][2] * mat[2][0]) +
        mat[0][2] * (mat[1][0] * mat[2][1] - mat[1][1] * mat[2][0]);
    if (det <= 0) {
        return 1e9;
    }
    // mat^T * mat
    const matT = mat[0].map((_, col) => mat.map(row => row[col]));
    const prod = matDot(matT, mat);
    // prod - I
    const I = Eye(3);
    const diff = matAdd(prod, I.map(row => row.map(val => -val)));
    // Frobenius norm
    const norm = Math.sqrt(diff.flat().reduce((sum, val) => sum + val * val, 0));
    return norm;
}

/**
 * Returns the Frobenius norm to describe the distance of mat from the SE(3) manifold
 * @param {Array<Array<number>>} mat A 4x4 matrix
 * @returns {number} A quantity describing the distance of mat from the SE(3) manifold
 * Computes the distance from mat to the SE(3) manifold:
 *   - Compute the determinant of matR, the top 3x3 submatrix of mat.
 *   - If det(matR) <= 0, return a large number (1e9).
 *   - If det(matR) > 0, replace the top 3x3 submatrix of mat with matR^T*matR,
 *     and set the first three entries of the fourth column of mat to zero.
 *     Then return norm(mat - I).
 * Example Input:
 *   mat = [
 *     [1.0,  0.0,   0.0,   1.2 ],
 *     [0.0,  0.1,  -0.95,  1.5 ],
 *     [0.0,  1.0,   0.1,  -0.9 ],
 *     [0.0,  0.0,   0.1,   0.98 ]
 *   ]
 * Output:
 *   0.134931
 */
function DistanceToSE3(mat) {
    // Extract the top-left 3x3 submatrix
    const matR = [
        [mat[0][0], mat[0][1], mat[0][2]],
        [mat[1][0], mat[1][1], mat[1][2]],
        [mat[2][0], mat[2][1], mat[2][2]]
    ];
    // Compute determinant
    const det =
        matR[0][0] * (matR[1][1] * matR[2][2] - matR[1][2] * matR[2][1]) -
        matR[0][1] * (matR[1][0] * matR[2][2] - matR[1][2] * matR[2][0]) +
        matR[0][2] * (matR[1][0] * matR[2][1] - matR[1][1] * matR[2][0]);
    if (det <= 0) {
        return 1e9;
    }
    // matR^T * matR
    const matRT = matR[0].map((_, col) => matR.map(row => row[col]));
    const prod = matDot(matRT, matR);
    // Construct new 4x4 matrix
    let newMat = [
        [prod[0][0], prod[0][1], prod[0][2], 0],
        [prod[1][0], prod[1][1], prod[1][2], 0],
        [prod[2][0], prod[2][1], prod[2][2], 0],
        [mat[3][0],  mat[3][1],  mat[3][2],  mat[3][3]]
    ];
    // mat - I
    const I = Eye(4);
    const diff = newMat.map((row, i) => row.map((val, j) => val - I[i][j]));
    // Frobenius norm
    const norm = Math.sqrt(diff.flat().reduce((sum, val) => sum + val * val, 0));
    return norm;
}

/**
 * Returns true if mat is close to or on the manifold SO(3)
 * @param {Array<Array<number>>} mat A 3x3 matrix
 * @returns {boolean} True if mat is very close to or in SO(3), false otherwise
 * Computes the distance d from mat to the SO(3) manifold:
 *   If det(mat) <= 0, d = a large number.
 *   If det(mat) > 0, d = norm(mat^T * mat - I).
 *   If d is close to zero, return true. Otherwise, return false.
 * Example Input:
 *   mat = [
 *     [1.0, 0.0,  0.0 ],
 *     [0.0, 0.1, -0.95],
 *     [0.0, 1.0,  0.1 ]
 *   ]
 * Output:
 *   false
 */
function TestIfSO3(mat) {
    return Math.abs(DistanceToSO3(mat)) < 1e-3;
}

/**
 * Returns true if mat is close to or on the manifold SE(3)
 * @param {Array<Array<number>>} mat A 4x4 matrix
 * @returns {boolean} True if mat is very close to or in SE(3), false otherwise
 * Computes the distance d from mat to the SE(3) manifold:
 *   Compute the determinant of the top 3x3 submatrix of mat.
 *   If det(mat) <= 0, d = a large number.
 *   If det(mat) > 0, replace the top 3x3 submatrix of mat with mat^T.mat, and
 *   set the first three entries of the fourth column of mat to zero.
 *   Then d = norm(T - I).
 *   If d is close to zero, return true. Otherwise, return false.
 * Example Input:
 *   mat = [
 *     [1.0, 0.0,   0.0,  1.2],
 *     [0.0, 0.1, -0.95,  1.5],
 *     [0.0, 1.0,   0.1, -0.9],
 *     [0.0, 0.0,   0.1, 0.98]
 *   ]
 * Output:
 *   false
 */
function TestIfSE3(mat) {
    return Math.abs(DistanceToSE3(mat)) < 1e-3;
}

/**
 * Computes the rotation axis and angle directly from a rotation matrix
 * @param {Array<Array<number>>} R 3x3 rotation matrix
 * @returns {[Array<number>, number]} [omghat, theta] unit rotation axis and rotation angle
 */
function RotMatToAxisAngle(R) {
    const so3mat = MatrixLog3(R);
    const expc3 = so3ToVec(so3mat);
    const [omghat, theta] = AxisAng3(expc3);
    return [omghat, theta];
}

function SlistToBlist(M, Slist) {
    const Blist = matDot(Adjoint(TransInv(M)), Slist);
    return Blist;
}


/**
 * Returns true if mat is close to or on the manifold SE(3)
 * @param {Array<Array<number>>} T_sb Transformation matrix before the motion
 * @param {Array<Array<number>>} T_sc Transformation matrix current the motion
 * @returns {Array<Array<number>>} Returns a 6D twist vector [ω, v] and the rotation angle θ
 * refernce: page 65, example 3.26
 * Example Input:
    const T_sb = [
        [cos(rad(30)), -sin(rad(30)), 0, 1],
        [sin(rad(30)), cos(rad(30)), 0, 2],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ];
        const T_sc = [
        [cos(rad(60)), -sin(rad(60)), 0, 2],
        [sin(rad(60)), cos(rad(60)), 0, 1],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ];
 * Output:
 *   [0, 0, 1, 3.3660254, -3.3660254, 0] 0.5235987755982988
 */
function GetTwistFromTransform(T_sb, T_sc) {
    // T_SE = T_sc @ TransInv(T_sb)
    const T_SE = matDot(T_sc, TransInv(T_sb));

    // Step 1: Get se(3) matrix (对数映射)
    const se3mat = MatrixLog6(T_SE);

    // Step 2: Get 6D twist vector [wθ, vθ]
    const twist_theta = se3ToVec(se3mat);

    // Step 3: Extract angular part
    const w_theta = twist_theta.slice(0, 3);
    const v_theta = twist_theta.slice(3, 6);

    // Check if w_theta is all zeros
    const w_theta_norm = Norm(w_theta);
    let omega_hat, theta, v;
    
    if (w_theta_norm < 1e-6) {
        console.warn("Pure translation detected, setting omega_hat to zero.");
        omega_hat = [0.0, 0.0, 0.0];
        theta = Norm(v_theta);
        if (theta < 1e-6) {
            v = [0.0, 0.0, 0.0];  // No movement
        } else {
            v = v_theta.map(val => val / theta);
        }
    } else {
        // Normal twist case
        [omega_hat, theta] = AxisAng3(w_theta);
        v = v_theta.map(val => val / theta);
    } 

    // Full twist S = [ω, v]
    const S = [omega_hat[0], omega_hat[1], omega_hat[2], v[0], v[1], v[2]];
    
    // console.log("T_SE (T_sc @ T_sb⁻¹):\n", T_SE);
    // console.log("twist vector [ωθ, vθ]:\n", twist_theta);
    // console.log("θ:", theta);
    // console.log("ω:", omega_hat);
    // console.log("v:", v);
    // console.log("Twist S = [ω, v]:", S);
    
    return [S, theta];
}


/*** CHAPTER 4: FORWARD KINEMATICS ***/
/**
 * Computes forward kinematics in the body frame for an open chain robot
 * @param {Array<Array<number>>} M The home configuration (4x4) of the end-effector
 * @param {Array<Array<number>>} Blist The joint screw axes in the end-effector frame (6xn, each column is a screw axis)
 * @param {Array<number>} thetalist A list of joint coordinates (angles)
 * @returns {Array<Array<number>>} A 4x4 homogeneous transformation matrix representing the end-effector frame when the joints are at the specified coordinates (Body Frame)
 * Example Input:
 *   M = [
 *     [-1, 0,  0, 0],
 *     [ 0, 1,  0, 6],
 *     [ 0, 0, -1, 2],
 *     [ 0, 0,  0, 1]
 *   ]
 *   Blist = [
 *     [0, 0,  1],
 *     [0, 0,  0],
 *     [-1, 0,  0],
 *     [2, 0,  0],
 *     [0, 1,  0],
 *     [0, 0, 0.1]
 *   ] // 6x3, each column is a screw axis for a joint
 *   thetalist = [Math.PI / 2.0, 3, Math.PI]
 * Output:
 *   [
 *     [0, 1,  0,         -5],
 *     [1, 0,  0,          4],
 *     [0, 0, -1, 1.68584073],
 *     [0, 0,  0,          1]
 *   ]
 */
// function FKinBody(M, Blist, thetalist) {
//     let T = M.map(row => row.slice()); // Deep copy
//     for (let i = 0; i < thetalist.length; i++) {
//         // Extract the i-th column of Blist
//         const Bi = Blist.map(row => row[i]);
//         // Bi * thetalist[i]
//         const expc6 = Bi.map(val => val * thetalist[i]);
//         // MatrixExp6(VecTose3(expc6))
//         const exp6 = MatrixExp6(VecTose3(expc6));
//         T = matDot(T, exp6);
//     }
//     return T;
// }

/**
 * 优化后的 FKinBody
 * 核心改进：消除 map/slice，使用直接索引访问，减少内存抖动
 */
function FKinBody(M, Blist, thetalist) {
    // 1. 避免使用 M.map(row => row.slice())。
    // 如果 M 是固定的，建议预先定义好结果矩阵的结构
    let T = [
        [M[0][0], M[0][1], M[0][2], M[0][3]],
        [M[1][0], M[1][1], M[1][2], M[1][3]],
        [M[2][0], M[2][1], M[2][2], M[2][3]],
        [M[3][0], M[3][1], M[3][2], M[3][3]]
    ];

    const n = thetalist.length;
    // 临时向量，复用内存以减少 GC
    const expc6 = new Float64Array(6);

    for (let i = 0; i < n; i++) {
        const theta = thetalist[i];
        
        // 2. 只有当关节角度不为 0 时才进行矩阵乘法（跳过零空间优化）
        if (Math.abs(theta) < 1e-6) continue;

        // 3. 直接从 Blist 提取列并计算 (Bi * theta)
        // 避免使用 Blist.map(row => row[i])
        expc6[0] = Blist[0][i] * theta;
        expc6[1] = Blist[1][i] * theta;
        expc6[2] = Blist[2][i] * theta;
        expc6[3] = Blist[3][i] * theta;
        expc6[4] = Blist[4][i] * theta;
        expc6[5] = Blist[5][i] * theta;

        // 4. 计算指数矩阵
        // 建议：VecTose3 也可以改写为不返回新数组，而是修改传入的数组
        const exp6 = MatrixExp6(VecTose3(expc6));

        // 5. 使用快速矩阵乘法 (只处理 4x4)
        T = multiply4x4(T, exp6);
    }
    return T;
}


/**
 * Computes forward kinematics in the space frame for an open chain robot
 * @param {Array<Array<number>>} M The home configuration (4x4) of the end-effector
 * @param {Array<Array<number>>} Slist The joint screw axes in the space frame (6xn, each column is a screw axis)
 * @param {Array<number>} thetalist A list of joint coordinates (angles)
 * @returns {Array<Array<number>>} A 4x4 homogeneous transformation matrix representing the end-effector frame when the joints are at the specified coordinates (Space Frame)
 * Example Input:
 *   M = [
 *     [-1, 0,  0, 0],
 *     [ 0, 1,  0, 6],
 *     [ 0, 0, -1, 2],
 *     [ 0, 0,  0, 1]
 *   ]
 *   Slist = [
 *     [0, 0,  1],
 *     [0, 0,  0],
 *     [-1, 0,  0],
 *     [4, 0,  0],
 *     [0, 1,  0],
 *     [0, 0, -0.1]
 *   ] // 6x3, each column is a screw axis for a joint
 *   thetalist = [Math.PI / 2.0, 3, Math.PI]
 * Output:
 *   [
 *     [0, 1,  0,         -5],
 *     [1, 0,  0,          4],
 *     [0, 0, -1, 1.68584073],
 *     [0, 0,  0,          1]
 *   ]
 */
// function FKinSpace(M, Slist, thetalist) {
//     let T = M.map(row => row.slice()); // Deep copy
//     for (let i = thetalist.length - 1; i >= 0; i--) {
//         // Extract the i-th column of Slist
//         const Si = Slist.map(row => row[i]);
//         // Si * thetalist[i]
//         const expc6 = Si.map(val => val * thetalist[i]);
//         // MatrixExp6(VecTose3(expc6))
//         const exp6 = MatrixExp6(VecTose3(expc6));
//         T = numeric.dot(exp6, T);
//     }
//     return T;
// }

function FKinSpace(M, Slist, thetalist) {
    let n = thetalist.length;
    // 初始 T 为单位矩阵，我们先从左向右累加所有的 Exp
    let T = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];

    for (let i = 0; i < n; i++) {
        const theta = thetalist[i];
        // 只有角度不为 0 时才计算，节省微小开销
        if (Math.abs(theta) > 1e-6) {
            // 直接构造 se3 向量，不使用 map
            const s1 = Slist[0][i] * theta, s2 = Slist[1][i] * theta, s3 = Slist[2][i] * theta;
            const s4 = Slist[3][i] * theta, s5 = Slist[4][i] * theta, s6 = Slist[5][i] * theta;
            
            // 使用之前优化的 MatrixExp6
            const exp6 = MatrixExp6([
                [0, -s3, s2, s4],
                [s3, 0, -s1, s5],
                [-s2, s1, 0, s6],
                [0, 0, 0, 0]
            ]);
            
            // 手动展开 4x4 矩阵乘法: T = T * exp6
            T = multiply4x4(T, exp6);
        }
    }

    // 最后再乘以初始位姿 M: T_final = T * M
    return multiply4x4(T, M);
}

/**
 * 高性能 4x4 矩阵乘法助手
 */
function multiply4x4(A, B) {
    let C = [new Float64Array(4), new Float64Array(4), new Float64Array(4), new Float64Array(4)];
    for (let i = 0; i < 4; i++) {
        const ai0 = A[i][0], ai1 = A[i][1], ai2 = A[i][2], ai3 = A[i][3];
        C[i][0] = ai0 * B[0][0] + ai1 * B[1][0] + ai2 * B[2][0] + ai3 * B[3][0];
        C[i][1] = ai0 * B[0][1] + ai1 * B[1][1] + ai2 * B[2][1] + ai3 * B[3][1];
        C[i][2] = ai0 * B[0][2] + ai1 * B[1][2] + ai2 * B[2][2] + ai3 * B[3][2];
        C[i][3] = ai0 * B[0][3] + ai1 * B[1][3] + ai2 * B[2][3] + ai3 * B[3][3];
    }
    return C;
}


/*** CHAPTER 5: VELOCITY KINEMATICS AND STATICS***/
/**
 * Computes the body Jacobian for an open chain robot
 * @param {Array<Array<number>>} Blist 6xn, each column is a screw axis for a joint
 * @param {Array<number>} thetalist Joint angle array
 * @returns {Array<Array<number>>} 6xn body Jacobian matrix
 * Example Input:
 *   Blist = [
 *     [0, 1, 0, 1],
 *     [0, 0, 1, 0],
 *     [1, 0, 0, 0],
 *     [0, 2, 0, 0.2],
 *     [0.2, 0, 2, 0.3],
 *     [0.2, 3, 1, 0.4]
 *   ] // 6x4
 *   thetalist = [0.2, 1.1, 0.1, 1.2]
 * Output:
 *   [
 *     [-0.04528405, 0.99500417,           0,   1],
 *     [ 0.74359313, 0.09304865,  0.36235775,   0],
 *     [-0.66709716, 0.03617541, -0.93203909,   0],
 *     [ 2.32586047,    1.66809,  0.56410831, 0.2],
 *     [-1.44321167, 2.94561275,  1.43306521, 0.3],
 *     [-2.06639565, 1.82881722, -1.58868628, 0.4]
 *   ]
 */
function JacobianBody(Blist, thetalist) {
    // Blist: 6xn, each column is a screw axis for a joint
    // thetalist: n
    const n = thetalist.length;
    // Jb initialized as a deep copy of Blist
    let Jb = Blist.map(row => row.slice());
    let T = [
        [1,0,0,0],
        [0,1,0,0],
        [0,0,1,0],
        [0,0,0,1]
    ];
    for (let i = n - 2; i >= 0; i--) {
        // -thetalist[i+1] * Blist[:,i+1]
        const Bi1 = Blist.map(row => row[i+1]);
        const expc6 = Bi1.map(val => -thetalist[i+1] * val);
        const exp6 = MatrixExp6(VecTose3(expc6));
        T = matDot(T, exp6);
        // Adjoint(T) * Blist[:,i]
        const Bi = Blist.map(row => row[i]);
        const adjT = Adjoint(T);
        const Jb_col = [];
        for (let r = 0; r < 6; r++) {
            let sum = 0;
            for (let c = 0; c < 6; c++) {
                sum += adjT[r][c] * Bi[c];
            }
            Jb_col.push(sum);
        }
        for (let r = 0; r < 6; r++) {
            Jb[r][i] = Jb_col[r];
        }
    }
    return Jb;
}


/**
 * Computes the space Jacobian for an open chain robot
 * @param {Array<Array<number>>} Slist 6xn, each column is a screw axis for a joint
 * @param {Array<number>} thetalist Joint angle array
 * @returns {Array<Array<number>>} 6xn space Jacobian matrix
 * Example Input:
 *   Slist = [
 *     [0, 0, 1,   0],
 *     [1, 0, 0,   2],
 *     [0, 1, 0,   0],
 *     [1, 0, 0, 0.2],
 *     [0.2, 0, 2, 0.3],
 *     [0.2, 3, 1, 0.4]
 *   ] // 6x4
 *   thetalist = [0.2, 1.1, 0.1, 1.2]
 * Output:
 *   [
 *     [  0, 0.98006658, -0.09011564,  0.95749426],
 *     [  0, 0.19866933,   0.4445544,  0.28487557],
 *     [  1,          0,  0.89120736, -0.04528405],
 *     [  0, 1.95218638, -2.21635216, -0.51161537],
 *     [0.2, 0.43654132, -2.43712573,  2.77535713],
 *     [0.2, 2.96026613,  3.23573065,  2.22512443]
 *   ]
 */
// function JacobianSpace(Slist, thetalist) {
//     const n = thetalist.length;
//     let Js = Slist.map(row => row.slice());
//     let T = [
//         [1,0,0,0],
//         [0,1,0,0],
//         [0,0,1,0],
//         [0,0,0,1]
//     ];
//     for (let i = 1; i < n; i++) {
//         // Slist[:,i-1] * thetalist[i-1]
//         const Si_1 = Slist.map(row => row[i-1]);
//         const expc6 = Si_1.map(val => val * thetalist[i-1]);
//         const exp6 = MatrixExp6(VecTose3(expc6));
//         T = numeric.dot(T, exp6);
//         // Adjoint(T) * Slist[:,i]
//         const Si = Slist.map(row => row[i]);
//         const adjT = Adjoint(T);
//         const Js_col = [];
//         for (let r = 0; r < 6; r++) {
//             let sum = 0;
//             for (let c = 0; c < 6; c++) {
//                 sum += adjT[r][c] * Si[c];
//             }
//             Js_col.push(sum);
//         }
//         for (let r = 0; r < 6; r++) {
//             Js[r][i] = Js_col[r];
//         }
//     }
//     return Js;
// }

function JacobianSpace(Slist, thetalist) {
    const n = thetalist.length;
    let Js = Array.from({ length: 6 }, () => new Float64Array(n));
    
    // 第一列永远是第一个螺旋轴
    for (let r = 0; r < 6; r++) Js[r][0] = Slist[r][0];

    // T 用于存储从基座到当前关节的累积变换
    let T = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];

    for (let i = 1; i < n; i++) {
        // 1. 计算上一个关节产生的变换
        // 这里只计算 Exp(S_{i-1} * theta_{i-1})
        const s_prev = [
            Slist[0][i-1] * thetalist[i-1], Slist[1][i-1] * thetalist[i-1], Slist[2][i-1] * thetalist[i-1],
            Slist[3][i-1] * thetalist[i-1], Slist[4][i-1] * thetalist[i-1], Slist[5][i-1] * thetalist[i-1]
        ];
        
        // 累积变换 T = T_{0, i-1}
        T = numeric.dot(T, MatrixExp6(VecTose3(s_prev)));

        // 2. 直接提取 T 的分量进行 Adjoint 乘法
        const r11 = T[0][0], r12 = T[0][1], r13 = T[0][2], px = T[0][3];
        const r21 = T[1][0], r22 = T[1][1], r23 = T[1][2], py = T[1][3];
        const r31 = T[2][0], r32 = T[2][1], r33 = T[2][2], pz = T[2][3];

        const sw1 = Slist[0][i], sw2 = Slist[1][i], sw3 = Slist[2][i];
        const sv1 = Slist[3][i], sv2 = Slist[4][i], sv3 = Slist[5][i];

        // R * omega
        const jw1 = r11 * sw1 + r12 * sw2 + r13 * sw3;
        const jw2 = r21 * sw1 + r22 * sw2 + r23 * sw3;
        const jw3 = r31 * sw1 + r32 * sw2 + r33 * sw3;

        // R * v
        const rv1 = r11 * sv1 + r12 * sv2 + r13 * sv3;
        const rv2 = r21 * sv1 + r22 * sv2 + r23 * sv3;
        const rv3 = r31 * sv1 + r32 * sv2 + r33 * sv3;

        // Js_i = [ R*w; [p]R*w + R*v ]
        Js[0][i] = jw1;
        Js[1][i] = jw2;
        Js[2][i] = jw3;
        Js[3][i] = (py * jw3 - pz * jw2) + rv1;
        Js[4][i] = (pz * jw1 - px * jw3) + rv2;
        Js[5][i] = (px * jw2 - py * jw1) + rv3;
    }
    return Js;
}

/*** CHAPTER 6: INVERSE KINEMATICS ***/
/**
 * Computes inverse kinematics in the body frame for an open chain robot
 * @param {Array<Array<number>>} Blist 6xn, each column is a screw axis for a joint
 * @param {Array<Array<number>>} M Initial end-effector pose (4x4)
 * @param {Array<Array<number>>} T Desired end-effector pose (4x4)
 * @param {Array<number>} thetalist0 Initial joint angle guess
 * @param {number} eomg Orientation error tolerance
 * @param {number} ev Position error tolerance
 * @returns {[Array<number>, boolean]} [thetalist, success]
 * Example Input:
 *   Blist = [
 *     [0, 0, -1, 2, 0,   0],
 *     [0, 0,  0, 0, 1,   0],
 *     [0, 0,  1, 0, 0, 0.1]
 *   ] // 6x3, each column is a screw axis for a joint
 *   M = [
 *     [-1, 0,  0, 0],
 *     [ 0, 1,  0, 6],
 *     [ 0, 0, -1, 2],
 *     [ 0, 0,  0, 1]
 *   ]
 *   T = [
 *     [0, 1,  0,     -5],
 *     [1, 0,  0,      4],
 *     [0, 0, -1, 1.6858],
 *     [0, 0,  0,      1]
 *   ]
 *   thetalist0 = [1.5, 2.5, 3]
 *   eomg = 0.01
 *   ev = 0.001
 * Output:
 *   ([1.57073819, 2.999667, 3.14153913], true)
 */
function IKinBody(Blist, M, T, thetalist0, eomg, ev) {
    let thetalist = thetalist0.slice();
    let i = 0;
    const maxiterations = 30;
    let Tsb = FKinBody(M, Blist, thetalist);
    let Vb = se3ToVec(MatrixLog6(matDot(TransInv(Tsb), T)));
    let err = (Norm(Vb.slice(0, 3)) > eomg) || (Norm(Vb.slice(3, 6)) > ev);
    while (err && i < maxiterations) {
        const Jb = JacobianBody(Blist, thetalist);
        // Moore-Penrose pseudoinverse of Jb
        const Jb_pinv = matPinv(Jb);
        // thetalist = thetalist + Jb_pinv * Vb
        thetalist = thetalist.map((theta, idx) =>
            theta + Jb_pinv[idx].reduce((sum, val, j) => sum + val * Vb[j], 0)
        );
        Tsb = FKinBody(M, Blist, thetalist);
        Vb = se3ToVec(MatrixLog6(matDot(TransInv(Tsb), T)));
        err = (Norm(Vb.slice(0, 3)) > eomg) || (Norm(Vb.slice(3, 6)) > ev);
        i += 1;
    }
    return [thetalist, !err];
}

/**
 * IKinBodyNull - 带有零空间优化（避开限位）的物体坐标系逆运动学
 * @param {Array} Blist - 6xn 的物体螺旋轴矩阵
 * @param {Array} M - 初始末端位姿矩阵
 * @param {Array} T - 目标末端位姿矩阵
 * @param {Array} thetalist0 - 初始关节角
 * @param {Array} qmin - 关节下限
 * @param {Array} qmax - 关节上限
 * @param {Number} eomg - 旋转误差容忍度
 * @param {Number} ev - 位移误差容忍度
 */
function IKinBodyNull(Blist, M, T, thetalist0, qmin, qmax, eomg, ev) {
    let thetalist = thetalist0.slice();
    let i = 0;
    const maxiterations = 50;
    
    // 阻尼系数（Damped Least Squares）
    let lambda = 1e-3; 
    const v_max = 0.35; // 最大步长限幅
    const n = thetalist.length;
    const IdentityN = numeric.identity(n);

    while (i < maxiterations) {
        // 1. 计算当前位姿 (Body Frame)
        const Tsb = FKinBody(M, Blist, thetalist);
        
        // 2. 计算 Body Twist 误差 Vb
        // 公式：[Vb] = Log(inv(Tsb) * T)
        const iTsb = TransInv(Tsb);
        const T_diff = numeric.dot(iTsb, T);
        const Vb = se3ToVec(MatrixLog6(T_diff));

        // 3. 检查误差
        const err_omg = Math.sqrt(Vb[0]**2 + Vb[1]**2 + Vb[2]**2);
        const err_v = Math.sqrt(Vb[3]**2 + Vb[4]**2 + Vb[5]**2);
        
        if (err_omg < eomg && err_v < ev) return [thetalist, true];

        // 4. 计算 Body Jacobian
        const Jb = JacobianBody(Blist, thetalist);
        const JbT = numeric.transpose(Jb);
        
        // 5. DLS 主任务求解
        // (J^T * J + lambda * I) * dtheta = J^T * Vb
        const JbTJb = numeric.dot(JbT, Jb);
        const A = numeric.add(JbTJb, numeric.mul(lambda, IdentityN));
        const b = numeric.dot(JbT, Vb);
        
        const dtheta_task = numeric.solve(A, b);

        // 6. 零空间投影 (Null Space) 避开限位
        // 目标：让关节尽量靠近中点 qmid
        const qmid = thetalist.map((_, idx) => (qmax[idx] + qmin[idx]) / 2);
        const grad = thetalist.map((t, idx) => -1.0 * (t - qmid[idx])); 

        // 投影公式：dtheta_null = (I - J_pinv * J) * grad
        // 快速实现：grad - J_pinv * (J * grad)
        const J_grad = numeric.dot(Jb, grad);
        const JT_J_grad = numeric.dot(JbT, J_grad);
        const J_pinv_J_grad = numeric.solve(A, JT_J_grad);
        const dtheta_null = numeric.sub(grad, J_pinv_J_grad);

        // 7. 合成更新（主任务权重 1.0，副任务权重 0.1）
        let step = dtheta_task.map((v, idx) => v + 0.1 * dtheta_null[idx]);
        
        // 8. 步长限幅 (Scaling)
        let max_s = 0;
        for (let j = 0; j < n; j++) {
            const abs_s = Math.abs(step[j]);
            if (abs_s > max_s) max_s = abs_s;
        }
        if (max_s > v_max) {
            const scale = v_max / max_s;
            for (let j = 0; j < n; j++) step[j] *= scale;
        }

        // 9. 更新关节角
        for (let j = 0; j < n; j++) thetalist[j] += step[j];

        // 10. 迭代优化
        lambda *= 0.6; 
        i++;
    }

    return [thetalist, false];
}


/**
 * Computes inverse kinematics in the space frame for an open chain robot
 * @param {Array<Array<number>>} Slist 6xn, each column is a screw axis for a joint
 * @param {Array<Array<number>>} M Initial end-effector pose (4x4)
 * @param {Array<Array<number>>} T Desired end-effector pose (4x4)
 * @param {Array<number>} thetalist0 Initial joint angle guess
 * @param {number} eomg Orientation error tolerance
 * @param {number} ev Position error tolerance
 * @returns {[Array<number>, boolean]} [thetalist, success]
 * Example Input:
 *   Slist = [
 *     [0, 0,  1,  4, 0,    0],
 *     [0, 0,  0,  0, 1,    0],
 *     [0, 0, -1, -6, 0, -0.1]
 *   ] // 6x3, each column is a screw axis for a joint
 *   M = [
 *     [-1, 0,  0, 0],
 *     [ 0, 1,  0, 6],
 *     [ 0, 0, -1, 2],
 *     [ 0, 0,  0, 1]
 *   ]
 *   T = [
 *     [0, 1,  0,     -5],
 *     [1, 0,  0,      4],
 *     [0, 0, -1, 1.6858],
 *     [0, 0,  0,      1]
 *   ]
 *   thetalist0 = [1.5, 2.5, 3]
 *   eomg = 0.01
 *   ev = 0.001
 * Output:
 *   ([1.57073783, 2.99966384, 3.1415342], true)
 */
function IKinSpace(Slist, M, T, thetalist0, eomg, ev) {
    let thetalist = thetalist0.slice();
    let i = 0;
    const maxiterations = 30;
    let Tsb = FKinSpace(M, Slist, thetalist);
    let Vs = matDot(Adjoint(Tsb), se3ToVec(MatrixLog6(matDot(TransInv(Tsb), T))));
    let err = (Norm(Vs.slice(0, 3)) > eomg) || (Norm(Vs.slice(3, 6)) > ev);
    while (err && i < maxiterations) {
        const Js = JacobianSpace(Slist, thetalist);
        const Js_pinv = matPinv(Js); 
        thetalist = thetalist.map((theta, idx) =>
            theta + Js_pinv[idx].reduce((sum, val, j) => sum + val * Vs[j], 0)
        );
        Tsb = FKinSpace(M, Slist, thetalist);
        Vs = matDot(Adjoint(Tsb), se3ToVec(MatrixLog6(matDot(TransInv(Tsb), T))));
        err = (Norm(Vs.slice(0, 3)) > eomg) || (Norm(Vs.slice(3, 6)) > ev);
        i += 1;
    }
    return [thetalist, !err];
}

// function IKinSpaceNull(Slist, M, T, thetalist0, qmin, qmax, eomg, ev) {
//     let thetalist = thetalist0.slice();
//     let i = 0;
//     const maxiterations = 50;
//     const alpha = 0.25;   // null-space 权重

//     let Tsb = FKinSpace(M, Slist, thetalist);
//     let Vs = numeric.dot(Adjoint(Tsb),
//         se3ToVec(MatrixLog6(numeric.dot(TransInv(Tsb), T)))
//     );

//     let err = (Norm(Vs.slice(0, 3)) > eomg) ||
//               (Norm(Vs.slice(3, 6)) > ev);

//     const n = thetalist.length;

//     let I = Eye(n);

//     while (err && i < maxiterations) {
//         const Js = JacobianSpace(Slist, thetalist);
//         const Js_pinv = matPinv(Js);

//         // ===== 主任务项 =====
//         let dtheta_task = Js_pinv.map(row =>
//             row.reduce((sum, val, j) => sum + val * Vs[j], 0)
//         );

//         // ===== 次任务：关节限位梯度 =====
//         let grad = thetalist.map((theta, i) => {
//             let qmid = 0.5 * (qmax[i] + qmin[i]);
//             return -(theta - qmid);  // 往中间拉
//         });

//         // ===== Null space 投影 =====
        
//         let N = numeric.sub(I, numeric.dot(Js_pinv, Js));
//         let dtheta_null = numeric.dot(N, grad);

//         // ===== 合成更新 =====
//         let dtheta = dtheta_task.map(
//             (v, i) => v + alpha * dtheta_null[i]
//         );

//         thetalist = thetalist.map(
//             (theta, i) => theta + dtheta[i]
//         );

//         Tsb = FKinSpace(M, Slist, thetalist);
//         Vs = numeric.dot(Adjoint(Tsb),
//             se3ToVec(MatrixLog6(numeric.dot(TransInv(Tsb), T)))
//         );

//         err = (Norm(Vs.slice(0, 3)) > eomg) ||
//               (Norm(Vs.slice(3, 6)) > ev);

//         i += 1;
//     }

//     return [thetalist, !err];
// }

function IKinSpaceNull(Slist, M, T, thetalist0, qmin, qmax, eomg, ev) {
    let thetalist = thetalist0.slice();
    let i = 0;
    const maxiterations = 50;
    
    // 初始阻尼系数（DLS核心）
    let lambda = 1e-3; 
    const v_max = 0.35; 
    const n = thetalist.length;
    const IdentityN = numeric.identity(n);

    while (i < maxiterations) {
        // 1. 计算当前位姿与误差 (Space Frame)
        const Tsb = FKinSpace(M, Slist, thetalist);
        const Vs = numeric.dot(Adjoint(Tsb), 
            se3ToVec(MatrixLog6(numeric.dot(TransInv(Tsb), T)))
        );

        // 2. 检查误差 (避免 slice 以提升速度)
        const err_omg = Math.sqrt(Vs[0]*Vs[0] + Vs[1]*Vs[1] + Vs[2]*Vs[2]);
        const err_v = Math.sqrt(Vs[3]*Vs[3] + Vs[4]*Vs[4] + Vs[5]*Vs[5]);
        
        if (err_omg < eomg && err_v < ev) return [thetalist, true];

        // 3. 计算雅可比
        const Js = JacobianSpace(Slist, thetalist);
        const JsT = numeric.transpose(Js);
        
        // 4. Damped Least Squares (DLS) 主任务求解
        // 公式: (J^T * J + lambda * I) * dtheta = J^T * Vs
        const JTJ = numeric.dot(JsT, Js);
        const A = numeric.add(JTJ, numeric.mul(lambda, IdentityN));
        const b = numeric.dot(JsT, Vs);
        
        // dtheta_task 是主任务解
        const dtheta_task = numeric.solve(A, b);

        // 5. 零空间投影优化 (避开限位)
        // 重点：不需要计算 N = I - J_pinv * J，这太慢了。
        // 直接利用 N * grad = grad - J_pinv * (J * grad)
        // 在 DLS 下，J_pinv 近似为 A^-1 * J^T
        
        const qmid = thetalist.map((_, idx) => (qmax[idx] + qmin[idx]) / 2);
        const grad = thetalist.map((t, idx) => -1.0 * (t - qmid[idx])); 

        // 零空间投影计算：dtheta_null = grad - A^-1 * J^T * (J * grad)
        const J_grad = numeric.dot(Js, grad);
        const JT_J_grad = numeric.dot(JsT, J_grad);
        const J_pinv_J_grad = numeric.solve(A, JT_J_grad);
        const dtheta_null = numeric.sub(grad, J_pinv_J_grad);

        // 6. 合成更新并进行步长限幅
        let step = dtheta_task.map((v, idx) => v + 0.1 * dtheta_null[idx]);
        
        let max_s = 0;
        for (let j = 0; j < n; j++) {
            const abs_s = Math.abs(step[j]);
            if (abs_s > max_s) max_s = abs_s;
        }

        if (max_s > v_max) {
            const scale = v_max / max_s;
            for (let j = 0; j < n; j++) step[j] *= scale;
        }

        // 7. 更新关节角
        for (let j = 0; j < n; j++) thetalist[j] += step[j];

        // 8. 动态调整阻尼 (Levenberg-Marquardt 简化逻辑)
        // 随迭代减小 lambda，让后期收敛变快
        lambda *= 0.6; 
        i++;
    }
    return [thetalist, false];
}


/*** CHAPTER 8: DYNAMICS OF OPEN CHAINS ***/ 

/**
 * Calculate the 6x6 matrix [adV] of the given 6-vector
 * @param {Array<number>} V  A 6-vector spatial velocity
 * @returns {Array<Array<number>>} The corresponding 6x6 matrix [adV]
 * 
 * Used to calculate the Lie bracket [V1, V2] = [adV1]V2
 * 
 * Example Input:
 *   V = [1, 2, 3, 4, 5, 6]
 * Output:
 *   [
 *     [ 0, -3,  2,  0,  0,  0],
 *     [ 3,  0, -1,  0,  0,  0],
 *     [-2,  1,  0,  0,  0,  0],
 *     [ 0, -6,  5,  0, -3,  2],
 *     [ 6,  0, -4,  3,  0, -1],
 *     [-5,  4,  0, -2,  1,  0]
 *   ]
 */
function ad(V) {
    const omgmat = VecToso3([V[0], V[1], V[2]]);
    const vmat = VecToso3([V[3], V[4], V[5]]);
    // 6x6 matrix adV
    let adV = Array.from({ length: 6 }, () => Array(6).fill(0));
    // left up 3x3
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
            adV[i][j] = omgmat[i][j];
    // right up 3x3 as 0
    // left down 3x3
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
            adV[i + 3][j] = vmat[i][j];
    // right down 3x3
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
            adV[i + 3][j + 3] = omgmat[i][j];
    return adV;
}


/**
 * Computes inverse dynamics in the space frame for an open chain robot
 * @param {Array<number>} thetalist n-vector of joint variables
 * @param {Array<number>} dthetalist n-vector of joint rates
 * @param {Array<number>} ddthetalist n-vector of joint accelerations
 * @param {Array<number>} g Gravity vector g
 * @param {Array<number>} Ftip Spatial force applied by the end-effector expressed in frame {n+1}
 * @param {Array<Array<Array<number>>>} Mlist List of link frames {i} relative to {i-1} at the home position
 * @param {Array<Array<Array<number>>>} Glist Spatial inertia matrices Gi of the links
 * @param {Array<Array<number>>} Slist 6xn，Screw axes Si of the joints in a space frame, in the format
                  of a matrix with axes as the columns
 * @returns {Array<number>} The n-vector of required joint forces/torques

    This function uses forward-backward Newton-Euler iterations to solve the equation:
    taulist = Mlist(thetalist)ddthetalist + c(thetalist,dthetalist) + g(thetalist) + Jtr(thetalist)Ftip

    Example (3 Link Robot):
        const thetalist = [0.1, 0.1, 0.1];
        const dthetalist = [0.1, 0.2, 0.3];
        const ddthetalist = [2, 1.5, 1];
        const g = [0, 0, -9.8];
        const Ftip = [1, 1, 1, 1, 1, 1];

        const M01 = [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0.089159],
            [0, 0, 0, 1]
        ];
        const M12 = [
            [0, 0, 1, 0.28],
            [0, 1, 0, 0.13585],
            [-1, 0, 0, 0],
            [0, 0, 0, 1]
        ];
        const M23 = [
            [1, 0, 0, 0],
            [0, 1, 0, -0.1197],
            [0, 0, 1, 0.395],
            [0, 0, 0, 1]
        ];
        const M34 = [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0.14225],
            [0, 0, 0, 1]
        ];
        const G1 = [
            [0.010267, 0, 0, 0, 0, 0],
            [0, 0.010267, 0, 0, 0, 0],
            [0, 0, 0.00666, 0, 0, 0],
            [0, 0, 0, 3.7, 0, 0],
            [0, 0, 0, 0, 3.7, 0],
            [0, 0, 0, 0, 0, 3.7]
        ];
        const G2 = [
            [0.22689, 0, 0, 0, 0, 0],
            [0, 0.22689, 0, 0, 0, 0],
            [0, 0, 0.0151074, 0, 0, 0],
            [0, 0, 0, 8.393, 0, 0],
            [0, 0, 0, 0, 8.393, 0],
            [0, 0, 0, 0, 0, 8.393]
        ];
        const G3 = [
            [0.0494433, 0, 0, 0, 0, 0],
            [0, 0.0494433, 0, 0, 0, 0],
            [0, 0, 0.004095, 0, 0, 0],
            [0, 0, 0, 2.275, 0, 0],
            [0, 0, 0, 0, 2.275, 0],
            [0, 0, 0, 0, 0, 2.275]
        ];
        const Glist = [G1, G2, G3];
        const Mlist = [M01, M12, M23, M34];
        const Slist = [
            [1, 0, 0],
            [0, 1, 1],
            [1, 0, 0],
            [0, -0.089, -0.089],
            [1, 0, 0],
            [0, 0, 0.425]
        ];

        const taulist = mr.InverseDynamics(
            thetalist, dthetalist, ddthetalist, g, Ftip, Mlist, Glist, Slist
        );

        console.log("InverseDynamics Output:");
        console.log(taulist);
        // Desired output: [74.69616155, -33.06766016, -3.23057314]
 */
function InverseDynamics(thetalist, dthetalist, ddthetalist, g, Ftip, Mlist, Glist, Slist) {
    console.log("Starting Inverse Dynamics Computation...");
    const n = thetalist.length;
    let Mi = Eye(4);
    let Ai = Array.from({ length: 6 }, () => Array(n).fill(0));
    let AdTi = Array(n + 1).fill(null);
    let Vi = Array.from({ length: 6 }, () => Array(n + 1).fill(0));
    let Vdi = Array.from({ length: 6 }, () => Array(n + 1).fill(0));
    // Vdi[:, 0] = [0, 0, 0, -g]
    for (let i = 0; i < 3; i++) Vdi[i][0] = 0;
    for (let i = 0; i < 3; i++) Vdi[i + 3][0] = -g[i];
    if (!Mlist[n] || !Mlist[n][0] || Mlist[n].length !== 4) {
        throw new Error(`Mlist[${n}] is invalid: ` + JSON.stringify(Mlist[n]));
    }
    AdTi[n] = Adjoint(TransInv(Mlist[n]));
    let Fi = Ftip.slice();
    let taulist = Array(n).fill(0);

    // 前向递推
    for (let i = 0; i < n; i++) {
        Mi = matDot(Mi, Mlist[i]);
        // Ai[:, i] = Adjoint(TransInv(Mi)) * Slist[:, i]
        const Scol = Slist.map(row => row[i]);
        const AdTinvMi = Adjoint(TransInv(Mi));
        for (let r = 0; r < 6; r++) {
            Ai[r][i] = 0;
            for (let c = 0; c < 6; c++) {
                Ai[r][i] += AdTinvMi[r][c] * Scol[c];
            }
        }
        // AdTi[i] = Adjoint(MatrixExp6(VecTose3(Ai[:,i]*-thetalist[i])) * TransInv(Mlist[i]))
        const Ai_theta = Ai.map(row => row[i] * -thetalist[i]);
        const exp6 = MatrixExp6(VecTose3(Ai_theta));
        const AdT = Adjoint(matDot(exp6, TransInv(Mlist[i])));
        AdTi[i] = AdT;
        // Vi[:, i+1] = AdTi[i] * Vi[:,i] + Ai[:,i] * dthetalist[i]
        for (let r = 0; r < 6; r++) {
            Vi[r][i + 1] = 0;
            for (let c = 0; c < 6; c++) {
                Vi[r][i + 1] += AdT[r][c] * Vi[c][i];
            }
            Vi[r][i + 1] += Ai[r][i] * dthetalist[i];
        }
        // Vdi[:, i+1] = AdTi[i] * Vdi[:,i] + Ai[:,i] * ddthetalist[i] + ad(Vi[:,i+1]) * Ai[:,i] * dthetalist[i]
        const adVi = ad(Vi.map(row => row[i + 1]));
        for (let r = 0; r < 6; r++) {
            // AdTi[i] * Vdi[:,i]
            let tmp = 0;
            for (let c = 0; c < 6; c++) {
                tmp += AdT[r][c] * Vdi[c][i];
            }
            // ad(Vi[:,i+1]) * Ai[:,i]
            let tmp2 = 0;
            for (let c = 0; c < 6; c++) {
                tmp2 += adVi[r][c] * Ai[c][i];
            }
            Vdi[r][i + 1] = tmp + Ai[r][i] * ddthetalist[i] + tmp2 * dthetalist[i];
        }
    }

    for (let i = n - 1; i >= 0; i--) {
        // Fi = AdTi[i+1]^T * Fi + Glist[i] * Vdi[:,i+1] - ad(Vi[:,i+1])^T * Glist[i] * Vi[:,i+1]
        // 1. AdTi[i+1]^T * Fi
        let Ftmp = Array(6).fill(0);
        for (let r = 0; r < 6; r++)
            for (let c = 0; c < 6; c++)
                Ftmp[r] += AdTi[i + 1][c][r] * Fi[c];
        // 2. Glist[i] * Vdi[:,i+1]
        let G_Vdi = Array(6).fill(0);
        for (let r = 0; r < 6; r++)
            for (let c = 0; c < 6; c++)
                G_Vdi[r] += Glist[i][r][c] * Vdi[c][i + 1];
        // 3. ad(Vi[:,i+1])^T * Glist[i] * Vi[:,i+1]
        let G_Vi = Array(6).fill(0);
        for (let r = 0; r < 6; r++)
            for (let c = 0; c < 6; c++)
                G_Vi[r] += Glist[i][r][c] * Vi[c][i + 1];
        const adViT = ad(Vi.map(row => row[i + 1])).map(row => row.slice());

        for (let r = 0; r < 6; r++)
            for (let c = r + 1; c < 6; c++) {
                const tmp = adViT[r][c];
                adViT[r][c] = adViT[c][r];
                adViT[c][r] = tmp;
            }
        let adViT_GVi = Array(6).fill(0);
        for (let r = 0; r < 6; r++)
            for (let c = 0; c < 6; c++)
                adViT_GVi[r] += adViT[r][c] * G_Vi[c];
        // Fi = Ftmp + G_Vdi - adViT_GVi
        Fi = Ftmp.map((val, idx) => val + G_Vdi[idx] - adViT_GVi[idx]);
        // taulist[i] = Fi^T * Ai[:,i]
        taulist[i] = Fi.reduce((sum, val, idx) => sum + val * Ai[idx][i], 0);
    }
    return taulist;
}


/**
 * Computes the mass matrix of an open chain robot based on the given configuration
 * @param {Array<number>} thetalist A list of joint variables
 * @param {Array<Array<Array<number>>>} Mlist List of link frames i relative to i-1 at the home position
 * @param {Array<Array<Array<number>>>} Glist Spatial inertia matrices Gi of the links
 * @param {Array<Array<number>>} Slist Screw axes Si of the joints in a space frame, in the format
                  of a matrix with axes as the columns
 * @returns {Array<Array<number>>} The numerical inertia matrix M(thetalist) of an n-joint serial
             chain at the given configuration thetalist
 * 
 * This function calls InverseDynamics n times, each time passing a ddthetalist vector with a single element equal to one and all other
    inputs set to zero.
    Each call of InverseDynamics generates a single column, and these columns are assembled to create the inertia matrix.

    Example Input (3 Link Robot in the function InverseDynamics):
        const M = mr.MassMatrix(thetalist, Mlist, Glist, Slist);

        console.log("MassMatrix:");
        console.log(M);

        Output:
        [[ 2.25433380e+01, -3.07146754e-01, -7.18426391e-03]
        [-3.07146754e-01,  1.96850717e+00,  4.32157368e-01]
        [-7.18426391e-03,  4.32157368e-01,  1.91630858e-01]]
 */
function MassMatrix(thetalist, Mlist, Glist, Slist) {
    const n = thetalist.length;
    let M = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        let ddthetalist = Array(n).fill(0);
        ddthetalist[i] = 1;
        const col = InverseDynamics(
            thetalist,
            Array(n).fill(0),         // dthetalist = 0
            ddthetalist,
            [0, 0, 0],                // g = 0
            [0, 0, 0, 0, 0, 0],       // Ftip = 0
            Mlist,
            Glist,
            Slist
        );
        for (let j = 0; j < n; j++) {
            M[j][i] = col[j];
        }
    }
    return M;
}

/**
 * Computes the Coriolis and centripetal terms in the inverse dynamics of an open chain robot（Coriolis force）
 * @param {Array<number>} thetalist A list of joint variables,
 * @param {Array<number>} dthetalist A list of joint rates,
 * @param {Array<Array<Array<number>>>} Mlist List of link frames i relative to i-1 at the home position,
 * @param {Array<Array<Array<number>>>} Glist Spatial inertia matrices Gi of the links,
 * @param {Array<Array<number>>} Slist Screw axes Si of the joints in a space frame, in the format
                  of a matrix with axes as the columns.
 * @returns {Array<number>} The vector c(thetalist,dthetalist) of Coriolis and centripetal
             terms for a given thetalist and dthetalist.
 * 
 *  This function calls InverseDynamics with g = 0, Ftip = 0, and ddthetalist = 0.
 *  
 *  Example Input (Same 3 Link Robot in the function InverseDynamics):
 *   const thetalist = [0.1, 0.1, 0.1];
     const dthetalist = [0.1, 0.2, 0.3]; 
     const VQF = mr.VelQuadraticForces(thetalist, dthetalist, Mlist, Glist, Slist);
     console.log("VelQuadraticForces:");
     console.log(VQF);
     // output：[0.26453118, -0.05505157, -0.00689132]
 */
function VelQuadraticForces(thetalist, dthetalist, Mlist, Glist, Slist) {
    return InverseDynamics(
        thetalist,
        dthetalist,
        Array(thetalist.length).fill(0), // ddthetalist = 0
        [0, 0, 0],                       // g = 0
        [0, 0, 0, 0, 0, 0],              // Ftip = 0
        Mlist,
        Glist,
        Slist
    );
}


/**
 * Computes the joint forces/torques an open chain robot requires to overcome gravity at its configuration
 * @param {Array<number>} thetalist A list of joint variables
 * @param {Array<number>} g 3-vector for gravitational acceleration
 * @param {Array<Array<Array<number>>>} Mlist List of link frames i relative to i-1 at the home position
 * @param {Array<Array<Array<number>>>} Glist Spatial inertia matrices Gi of the links
 * @param {Array<Array<number>>} Slist Screw axes Si of the joints in a space frame, in the format
                                       of a matrix with axes as the columns
 * @returns {Array<number>} grav: The joint forces/torques required to overcome gravity at thetalist
 * 
 * This function calls InverseDynamics with Ftip = 0, dthetalist = 0, and ddthetalist = 0.
 * 
 * Example Input (Same 3 Link Robot in the function InverseDynamics):
     const thetalist = [0.1, 0.1, 0.1];
     const g = [0, 0, -9.8]; 
     const GF = mr.GravityForces(thetalist, g, Mlist, Glist, Slist);
     console.log("GravityForces:");
     console.log(GF);
     // output：[28.40331262, -37.64094817, -5.4415892]
 */
function GravityForces(thetalist, g, Mlist, Glist, Slist) {
    const n = thetalist.length;
    return InverseDynamics(
        thetalist,
        Array(n).fill(0),           // dthetalist = 0
        Array(n).fill(0),           // ddthetalist = 0
        g,
        [0, 0, 0, 0, 0, 0],         // Ftip = 0
        Mlist,
        Glist,
        Slist
    );
}

/**
 * Computes the joint forces/torques an open chain robot requires only to create the end-effector force Ftip
 * @param {Array<number>} thetalist A list of joint variables
 * @param {Array<number>} Ftip Spatial force applied by the end-effector expressed in frame {n+1}
 * @param {Array<Array<Array<number>>>} Mlist List of link frames i relative to i-1 at the home position
 * @param {Array<Array<Array<number>>>} Glist Spatial inertia matrices Gi of the links
 * @param {Array<Array<number>>} Slist Screw axes Si of the joints in a space frame, in the format
                                       of a matrix with axes as the columns
 * @returns {Array<number>} The joint forces and torques required only to create the end-effector force Ftip
 * 
 * This function calls InverseDynamics with g = 0, dthetalist = 0, and ddthetalist = 0.
 * Example Input (Same 3 Link Robot in the function InverseDynamics):
     const thetalist = [0.1, 0.1, 0.1];
     const Ftip = np.array([1, 1, 1, 1, 1, 1]); 
     const EF = mr.EndEffectorForces(thetalist, Ftip, Mlist, Glist, Slist);
     console.log("EndEffectorForces:");
     console.log(EF);
     // output：[1.40954608, 1.85771497, 1.392409]
 */
function EndEffectorForces(thetalist, Ftip, Mlist, Glist, Slist) {
    const n = thetalist.length;
    return InverseDynamics(
        thetalist,
        Array(n).fill(0),           // dthetalist = 0
        Array(n).fill(0),           // ddthetalist = 0
        [0, 0, 0],                  // g = 0
        Ftip,
        Mlist,
        Glist,
        Slist
    );
}

/**
 * Computes forward dynamics in the space frame for an open chain robot
 * @param {Array<number>} thetalist A list of joint variables
 * @param {Array<number>} dthetalist A list of joint rates
 * @param {Array<number>} taulist An n-vector of joint forces/torques
 * @param {Array<number>} g Gravity vector g
 * @param {Array<number>} Ftip Spatial force applied by the end-effector expressed in frame {n+1}
 * @param {Array<Array<Array<number>>>} Mlist List of link frames i relative to i-1 at the home position
 * @param {Array<Array<Array<number>>>} Glist Spatial inertia matrices Gi of the links
 * @param {Array<Array<number>>} Slist Screw axes Si of the joints in a space frame, in the format
                                       of a matrix with axes as the columns
 * @returns {Array<number>} ddthetalist: The resulting joint accelerations
 * 
 *  This function computes ddthetalist by solving:
 * 
    Mlist(thetalist) * ddthetalist = taulist - c(thetalist,dthetalist) - g(thetalist) - Jtr(thetalist) * Ftip
 * 
    Example Input (Same 3 Link Robot in the function InverseDynamics):
        const thetalist = np.array([0.1, 0.1, 0.1])
        const dthetalist = np.array([0.1, 0.2, 0.3])
        const taulist = np.array([0.5, 0.6, 0.7])
        const g = np.array([0, 0, -9.8])
        const Ftip = np.array([1, 1, 1, 1, 1, 1])

        ddthetalist = mr.ForwardDynamics(
            thetalist, dthetalist, taulist, g, Ftip, Mlist, Glist, Slist
        );
        console.log("ForwardDynamics Output:");
        console.log(ddthetalist);

 * Output: [-0.97392907, 25.58466784, -32.91499212]
 */
function ForwardDynamics(thetalist, dthetalist, taulist, g, Ftip, Mlist, Glist, Slist) {
    // 1. Mass matrix
    const M = MassMatrix(thetalist, Mlist, Glist, Slist);
    // 2. Coriolis and centripetal terms
    const c = VelQuadraticForces(thetalist, dthetalist, Mlist, Glist, Slist);
    // 3. Gravitational forces
    const grav = GravityForces(thetalist, g, Mlist, Glist, Slist);
    // 4. End-effector forces
    const JtrFtip = EndEffectorForces(thetalist, Ftip, Mlist, Glist, Slist);
    // 5. Computes ddthetalist by solving using numeric.solve
    // taulist = M * ddthetalist + c + grav + JtrFtip
    const n = thetalist.length;
    let rhs = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
        rhs[i] = taulist[i] - c[i] - grav[i] - JtrFtip[i];
    }
    const ddthetalist = numeric.solve(M, rhs);
    return ddthetalist;
}


/*** CHAPTER 9: TRAJECTORY GENERATION ***/ 
/**
 * Computes s(t) for a cubic time scaling
 * @param {number} Tf Total time of the motion in seconds from rest to rest
 * @param {number} t The current time t satisfying 0 < t < Tf
 * @returns {number} The path parameter s(t) corresponding to a third-order polynomial motion that begins and ends at zero velocity
 * Example: CubicTimeScaling(2, 0.6) => 0.216
 */
function CubicTimeScaling(Tf, t) {
    const tau = t / Tf;
    return 3 * Math.pow(tau, 2) - 2 * Math.pow(tau, 3);
}

/**
 * Computes s(t) for a quintic time scaling
 * @param {number} Tf Total time of the motion in seconds from rest to rest
 * @param {number} t The current time t satisfying 0 < t < Tf
 * @returns {number} The path parameter s(t) corresponding to a fifth-order polynomial motion that begins 
 *                   and ends at zero velocity and zero acceleration
 * Example: QuinticTimeScaling(2, 0.6) => 0.16308
 */
function QuinticTimeScaling(Tf, t) {
    const tau = t / Tf;
    return 10 * Math.pow(tau, 3) - 15 * Math.pow(tau, 4) + 6 * Math.pow(tau, 5);
}

/**
 * Computes a straight-line trajectory in joint space
 * @param {Array<number>} thetastart The initial joint variables
 * @param {Array<number>} thetaend The final joint variables
 * @param {number} Tf Total time of the motion in seconds from rest to rest
 * @param {number} N The number of points N > 1 (Start and stop) in the discrete
                     representation of the trajectory
 * @param {number} method The time-scaling method, where 3 indicates cubic (third-
                          order polynomial) time scaling and 5 indicates quintic
                          (fifth-order polynomial) time scaling
 * @returns {Array<Array<number>>} A trajectory as an N x n matrix, where each row is an n-vector
                                   of joint variables at an instant in time. The first row is
                                   thetastart and the Nth row is thetaend . The elapsed time
                                   between each row is Tf / (N - 1)
    Example Input:
        thetastart = np.array([1, 0, 0, 1, 1, 0.2, 0,1])
        thetaend = np.array([1.2, 0.5, 0.6, 1.1, 2, 2, 0.9, 1])
        Tf = 4
        N = 6
        method = 3
    Output:
        np.array([[     1,     0,      0,      1,     1,    0.2,      0, 1]
                  [1.0208, 0.052, 0.0624, 1.0104, 1.104, 0.3872, 0.0936, 1]
                  [1.0704, 0.176, 0.2112, 1.0352, 1.352, 0.8336, 0.3168, 1]
                  [1.1296, 0.324, 0.3888, 1.0648, 1.648, 1.3664, 0.5832, 1]
                  [1.1792, 0.448, 0.5376, 1.0896, 1.896, 1.8128, 0.8064, 1]
                  [   1.2,   0.5,    0.6,    1.1,     2,      2,    0.9, 1]])
 */
function JointTrajectory(thetastart, thetaend, Tf, N, method) {
    N = Math.floor(N);
    const n = thetastart.length;
    const timegap = Tf / (N - 1);
    let traj = [];
    for (let i = 0; i < N; i++) {
        let s;
        if (method === 3) {
            s = CubicTimeScaling(Tf, timegap * i);
        } else {
            s = QuinticTimeScaling(Tf, timegap * i);
        }
        // s*thetaend + (1-s)*thetastart
        let point = [];
        for (let j = 0; j < n; j++) {
            point.push(s * thetaend[j] + (1 - s) * thetastart[j]);
        }
        traj.push(point);
    }
    return traj;
}

/**
 * Computes a trajectory as a list of N SE(3) matrices corresponding to
 * the screw motion about a space screw axis
 * @param {Array<Array<number>>} Xstart The initial end-effector configuration
 * @param {Array<Array<number>>} Xend The final end-effector configuration
 * @param {number} Tf Total time of the motion in seconds from rest to rest
 * @param {number} N The number of points N > 1 (Start and stop) in the discrete
                     representation of the trajectory
 * @param {number} method The time-scaling method, where 3 indicates cubic (third-
                          order polynomial) time scaling and 5 indicates quintic
                          (fifth-order polynomial) time scaling
 * @returns {Array<Array<Array<number>>>}  The discretized trajectory as a list of N matrices in SE(3)
                                           separated in time by Tf/(N-1). The first in the list is Xstart
                                           and the Nth is Xend
 *     Example Input:
        Xstart = np.array([[1, 0, 0, 1],
                           [0, 1, 0, 0],
                           [0, 0, 1, 1],
                           [0, 0, 0, 1]])
        Xend = np.array([[0, 0, 1, 0.1],
                         [1, 0, 0,   0],
                         [0, 1, 0, 4.1],
                         [0, 0, 0,   1]])
        Tf = 5
        N = 4
        method = 3
    Output:
        [np.array([[1, 0, 0, 1]
                   [0, 1, 0, 0]
                   [0, 0, 1, 1]
                   [0, 0, 0, 1]]),
         np.array([[0.904, -0.25, 0.346, 0.441]
                   [0.346, 0.904, -0.25, 0.529]
                   [-0.25, 0.346, 0.904, 1.601]
                   [    0,     0,     0,     1]]),
         np.array([[0.346, -0.25, 0.904, -0.117]
                   [0.904, 0.346, -0.25,  0.473]
                   [-0.25, 0.904, 0.346,  3.274]
                   [    0,     0,     0,      1]]),
         np.array([[0, 0, 1, 0.1]
                   [1, 0, 0,   0]
                   [0, 1, 0, 4.1]
                   [0, 0, 0,   1]])]
 */
function ScrewTrajectory(Xstart, Xend, Tf, N, method) {
    N = Math.floor(N);
    const timegap = Tf / (N - 1);
    let traj = [];
    // Compute constants once
    const Xstart_inv = TransInv(Xstart);
    const Xrel = matDot(Xstart_inv, Xend);
    const logXrel = MatrixLog6(Xrel);
    for (let i = 0; i < N; i++) {
        let s;
        if (method === 3) {
            s = CubicTimeScaling(Tf, timegap * i);
        } else {
            s = QuinticTimeScaling(Tf, timegap * i);
        }
        // MatrixExp6(logXrel * s)
        const exp6 = MatrixExp6(logXrel.map(row => row.map(val => val * s)));
        // Xstart * exp6
        traj.push(matDot(Xstart, exp6));
    }
    return traj;
}

/**
 * Computes a trajectory as a list of N SE(3) matrices corresponding to
 * the origin of the end-effector frame following a straight line (decoupled translation and rotation)
 * @param {Array<Array<number>>} Xstart The initial end-effector configuration
 * @param {Array<Array<number>>} Xend The final end-effector configuration
 * @param {number} Tf Total time of the motion in seconds from rest to rest
 * @param {number} N The number of points N > 1 (Start and stop) in the discrete
                     representation of the trajectory
 * @param {number} method The time-scaling method, where 3 indicates cubic (third-
                   order polynomial) time scaling and 5 indicates quintic
                   (fifth-order polynomial) time scaling
 * @returns {Array<Array<Array<number>>>} The discretized trajectory as a list of N matrices in SE(3)
             separated in time by Tf/(N-1). The first in the list is Xstart
             and the Nth is Xend
    This function is similar to ScrewTrajectory, except the origin of the
    end-effector frame follows a straight line, decoupled from the rotational
    motion.

     Example Input:
        Xstart = np.array([[1, 0, 0, 1],
                           [0, 1, 0, 0],
                           [0, 0, 1, 1],
                           [0, 0, 0, 1]])
        Xend = np.array([[0, 0, 1, 0.1],
                         [1, 0, 0,   0],
                         [0, 1, 0, 4.1],
                         [0, 0, 0,   1]])
        Tf = 5
        N = 4
        method = 5
    Output:
        [np.array([[1, 0, 0, 1]
                   [0, 1, 0, 0]
                   [0, 0, 1, 1]
                   [0, 0, 0, 1]]),
         np.array([[ 0.937, -0.214,  0.277, 0.811]
                   [ 0.277,  0.937, -0.214,     0]
                   [-0.214,  0.277,  0.937, 1.651]
                   [     0,      0,      0,     1]]),
         np.array([[ 0.277, -0.214,  0.937, 0.289]
                   [ 0.937,  0.277, -0.214,     0]
                   [-0.214,  0.937,  0.277, 3.449]
                   [     0,      0,      0,     1]]),
         np.array([[0, 0, 1, 0.1]
                   [1, 0, 0,   0]
                   [0, 1, 0, 4.1]
                   [0, 0, 0,   1]])]
 */
function CartesianTrajectory(Xstart, Xend, Tf, N, method) {
    N = Math.floor(N);
    const timegap = Tf / (N - 1);
    let traj = [];
    // Split rotation and translation
    const [Rstart, pstart] = TransToRp(Xstart);
    const [Rend, pend] = TransToRp(Xend);
    // Rotation interpolation constants
    const RstartT = RotInv(Rstart);
    const Rrel = matDot(RstartT, Rend);
    const logRrel = MatrixLog3(Rrel);
    for (let i = 0; i < N; i++) {
        let s;
        if (method === 3) {
            s = CubicTimeScaling(Tf, timegap * i);
        } else {
            s = QuinticTimeScaling(Tf, timegap * i);
        }
        // Rotation interpolation: Rstart * exp(logRrel * s)
        const exp3 = MatrixExp3(logRrel.map(row => row.map(val => val * s)));
        const R = matDot(Rstart, exp3);
        // Translation interpolation: s*pend + (1-s)*pstart
        const p = [];
        for (let j = 0; j < pstart.length; j++) {
            p.push(s * pend[j] + (1 - s) * pstart[j]);
        }
        // Compose SE(3) matrix
        traj.push(RpToTrans(R, p));
    }
    return traj;
}

/* Robot Control */
/**
 * Simulates a PID control for a robot arm
 * @param {Array<number>} q0 initial joint angles
 * @param {Array<number>} dq0 initial joint velocities
 * @param {Array<number>} q_ref target joint angles
 * @param {Array<number>} dq_ref target joint velocities
 * @param {number} dt time step for the simulation
 * @param {number} steps number of simulation steps
 * @param {Array<Array<Array<number>>>} Mlist List of link frames i relative to i-1 at the home position
 * @param {Array<Array<Array<number>>>} Glist Spatial inertia matrices Gi of the links
 * @param {Array<Array<number>>} Slist Screw axes Si of the joints in a space frame, in the format
                                       of a matrix with axes as the columns
 * @param {Array<number>} Kplist gain for proportional control
 * @param {Array<number>} Kilist gain for integral control
 * @param {Array<number>} Kdlist gain for derivative control
 * @returns {[Array<Array<number>>, Array<Array<number>>]} [q_hist, dq_hist]
 */
function simulate_PIDcontrol(q0, dq0, q_ref, dq_ref, dt, steps, Mlist, Glist, Slist, Kplist, Kilist, Kdlist) {
    const g = [0, 0, -9.8];
    const Ftip = [0, 0, 0, 0, 0, 0];
    const pos_threshold = 0.002;
    const vel_threshold = 0.002;

    let q = q0.slice();
    let dq = dq0.slice();
    let q_hist = [q.slice()];
    let dq_hist = [dq.slice()];
    let integral = Array(q.length).fill(0);

    function pid_control(q, dq, q_ref, dq_ref, dt, Kp, Ki, Kd, integral) {
        let u = [];
        for (let i = 0; i < q.length; i++) {
            integral[i] += (q_ref[i] - q[i]) * dt;
            u[i] = Kp[i] * (q_ref[i] - q[i])
                 + Ki[i] * integral[i]
                 + Kd[i] * (dq_ref[i] - dq[i]);
        }
        return u;
    }

    for (let i = 0; i < steps; i++) {
        const tau_pid = pid_control(q, dq, q_ref, dq_ref, dt, Kplist, Kilist, Kdlist, integral);
        const tau = tau_pid.map((val, idx) => val + GravityForces(q, g, Mlist, Glist, Slist)[idx]);
        const ddq = ForwardDynamics(q, dq, tau, g, Ftip, Mlist, Glist, Slist);

        // dq += ddq * dt, q += dq * dt
        dq = dq.map((v, idx) => v + ddq[idx] * dt);
        q = q.map((v, idx) => v + dq[idx] * dt);

        q_hist.push(q.slice());
        dq_hist.push(dq.slice());

        // Check for convergence
        const pos_err = Math.sqrt(q.reduce((sum, v, idx) => sum + Math.pow(v - q_ref[idx], 2), 0));
        const vel_err = Math.sqrt(dq.reduce((sum, v) => sum + v * v, 0));
        if (pos_err < pos_threshold && vel_err < vel_threshold) {
            break;
        }
    }
    return [q_hist, dq_hist];
}


// Export the functions as a module
module.exports = {
    /* Basic Functions */
    NearZero,
    Norm,
    Eye,
    matDot,
    vecMatDot,
    matAdd,
    matAddN,
    matPinv,
    deg2rad,
    rad2deg,

    worlr2three,
    three2world,
    worlr2threeT,
    three2worldT,

    RotMatToQuaternion,
    QuaternionToRotMat,
    RotMatToEuler,
    EulerToRotMat,

    // Chapter 3: Rigid Body Kinematics 
    RotInv,
    VecToso3,
    so3ToVec,
    AxisAng3,
    MatrixExp3,
    MatrixLog3,
    RpToTrans,
    TransToRp,
    TransInv,
    VecTose3,
    se3ToVec,
    Adjoint,
    ScrewToAxis,
    AxisAng6,
    MatrixExp6,
    MatrixLog6,
    ProjectToSO3,
    ProjectToSE3,
    DistanceToSO3,
    DistanceToSE3,
    TestIfSO3,
    TestIfSE3,
    RotMatToAxisAngle,
    SlistToBlist,
    GetTwistFromTransform,

    // Chapter 4: Forward Kinematics 
    FKinBody,
    FKinSpace,

    // Chapter 5: Velocity Kinematics and Statics
    JacobianBody,
    JacobianSpace,

    // Chapter 6: Inverse Kinematics
    IKinBody,
    IKinBodyNull,
    IKinSpace,
    IKinSpaceNull,

    // Chapter 8: Dynamics of Open Chains
    ad,
    InverseDynamics,
    MassMatrix,
    VelQuadraticForces,
    GravityForces,
    EndEffectorForces,
    ForwardDynamics,

    // Chapter 9: Trajectory Generation
    CubicTimeScaling,
    QuinticTimeScaling,
    JointTrajectory,
    ScrewTrajectory,
    CartesianTrajectory,

    // Robot Control
    simulate_PIDcontrol
};
