/**
 * Generate 6x6 spatial inertia matrix
 * @param {number} mass Mass of the body
 * @param {Array<number>} com Center of mass position [x, y, z]
 * @param {Array<Array<number>>} inertia 3x3 rotational inertia tensor (about the body origin)
 * @returns {Array<Array<number>>} 6x6 spatial inertia matrix
 */
function spatialInertiaMatrix(mass, com, inertia) {
    const com_hat = [
        [0, -com[2], com[1]],
        [com[2], 0, -com[0]],
        [-com[1], com[0], 0]
    ];
    // mc_hat = mass * com_hat
    let mc_hat = [];
    for (let i = 0; i < 3; i++) {
        mc_hat[i] = [];
        for (let j = 0; j < 3; j++) {
            mc_hat[i][j] = mass * com_hat[i][j];
        }
    }
    // inertia + mc_hat @ com_hat.T
    let rot = [];
    for (let i = 0; i < 3; i++) {
        rot[i] = [];
        for (let j = 0; j < 3; j++) {
            // inertia[i][j]
            let sum = inertia[i][j];
            // + sum_k mc_hat[i][k] * com_hat[j][k] (note transpose)
            for (let k = 0; k < 3; k++) {
                sum += mc_hat[i][k] * com_hat[j][k];
            }
            rot[i][j] = sum;
        }
    }
    // Construct 6x6 spatial inertia matrix
    let G = Array.from({length: 6}, () => Array(6).fill(0));
    // Top-left
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
            G[i][j] = rot[i][j];
    // Top-right
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
            G[i][j+3] = mc_hat[i][j];
    // Bottom-left
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
            G[i+3][j] = mc_hat[j][i]; // transpose
    // Bottom-right
    for (let i = 0; i < 3; i++)
        G[i+3][i+3] = mass;
    return G;
}

class RobotDynamcis {
    static _builders = {};

    constructor(robot_id) {
        this.robot_id = robot_id;
        if (!(robot_id in RobotDynamcis._builders)) {
            throw new Error(`Unsupported robot_id: ${robot_id}`);
        }
        const { M, Mlist, Glist, Slist, jointLimits, jointInitial } = RobotDynamcis._builders[robot_id]();
        this.M = M;
        this.Mlist = Mlist;
        this.Glist = Glist;
        this.Slist = Slist;
        this.jointLimits = jointLimits;
        this.jointInitial = jointInitial;
    }

    static register_robot(robot_id, builderFunc) {
        RobotDynamcis._builders[robot_id] = builderFunc;
    }

    get_M() {
        return this.M;
    }

    get_Mlist() {
        return this.Mlist;
    }
    get_Glist() {
        return this.Glist;
    }

    get_Slist() {
        return this.Slist;
    }

    // get_Kplist() {
    //     return this.Kplist;
    // }

    // get_Kilist() {
    //     return this.Kilist;
    // }

    // get_Kdlist() {
    //     return this.Kdlist;
    // }

    get_jointLimits() {
        return this.jointLimits;
    }

    get_jointInitial() {
        return this.jointInitial;
    }

    // get_toolLimits() {
    //     return this.toolLimit;
    // }
}

const deg2rad = deg => deg * Math.PI / 180;

function screw_axis(w, q) {
    const cross = [
        w[1]*q[2] - w[2]*q[1],
        w[2]*q[0] - w[0]*q[2],
        w[0]*q[1] - w[1]*q[0]
    ];
    return w.concat([-cross[0], -cross[1], -cross[2]]);
}



//  piper_agilex robot
// RobotDynamcis.register_robot("agilex_piper", function build_piper_6dof() {
//     const L_01 = 0.123, L_23 = 0.28503, L_34 = 0.25075, L_56 = 0.091, L_ee = 0.1358;
//     const W_34 = 0.0219;

//     const jointLimits = [
//     { min: deg2rad(-150), max: deg2rad(150) },   // theta_1
//     { min: deg2rad(-90),  max: deg2rad(90)  },   // theta_2
//     { min: deg2rad(0),    max: deg2rad(169) },   // theta_3
//     { min: deg2rad(-99),  max: deg2rad(99)  },   // theta_4
//     { min: deg2rad(-69.901),    max: deg2rad(69.901) },   // theta_5
//     { min: deg2rad(-120), max: deg2rad(120) },   // theta_6
//     ];

//     const toolLimit = { min: -1, max: 89 }; // theta_tool

//     // const jointLimits = [
//     // { min: deg2rad(-120), max: deg2rad(120) },   // theta_1
//     // { min: deg2rad(-80),  max: deg2rad(80)  },   // theta_2
//     // { min: deg2rad(10),    max: deg2rad(160) },   // theta_3
//     // { min: deg2rad(-90),  max: deg2rad(90)  },   // theta_4
//     // { min: deg2rad(0),    max: deg2rad(120) },   // theta_5
//     // { min: deg2rad(-120), max: deg2rad(120) },   // theta_6
//     // ];

//     /* M */
//     const M = [
//         [1, 0, 0, -W_34],
//         [0, 1, 0, 0],
//         [0, 0, 1, L_01 + L_23 + L_34 + L_56 + L_ee],
//         [0, 0, 0, 1]
//     ];

//     /* Mlist */
//     const M01 = [
//         [1, 0, 0, 0],
//         [0, 1, 0, 0],
//         [0, 0, 1, L_01],
//         [0, 0, 0, 1]
//     ];
//     const M12 = [
//         [1, 0, 0, 0],
//         [0, 0, 1, 0],
//         [0, -1, 0, 0],
//         [0, 0, 0, 1]
//     ];
//     const M23 = [
//         [1, 0, 0, 0],
//         [0, 1, 0, -L_23],
//         [0, 0, 1, 0],
//         [0, 0, 0, 1]
//     ];
//     const M34 = [
//         [1, 0, 0, -W_34],
//         [0, 0, -1, -L_34],
//         [0, 1, 0, 0],
//         [0, 0, 0, 1]
//     ];
//     const M45 = [
//         [1, 0, 0, 0],
//         [0, 0, 1, 0],
//         [0, -1, 0, 0],
//         [0, 0, 0, 1]
//     ];
//     const M56 = [
//         [1, 0, 0, 0],
//         [0, 0, -1, -L_56],
//         [0, 1, 0, 0],
//         [0, 0, 0, 1]
//     ];
//     const M6ee = [
//         [1, 0, 0, 0],
//         [0, 1, 0, 0],
//         [0, 0, 1, L_ee],
//         [0, 0, 0, 1]
//     ];
//     const Mlist = [M01, M12, M23, M34, M45, M56, M6ee];

//     /* Glist */
//     const Glist = [
//         // base link
//         spatialInertiaMatrix(1.02, [-0.0047364, 2.5683e-05, 0.0414515], [
//             [0.00267433, -0.00000073, -0.00017389],
//             [-0.00000073, 0.00282612, 0.0000004],
//             [-0.00017389, 0.0000004, 0.00089624]
//         ]),
//         // link 1
//         spatialInertiaMatrix(0.71, [0.0001215, 0.0001046, -0.004386], [
//             [0.00048916, -0.00000036, -0.00000224],
//             [-0.00000036, 0.00040472, -0.00000242],
//             [-0.00000224, -0.00000242, 0.00043982]
//         ]),
//         // link 2
//         spatialInertiaMatrix(1.17, [0.198666145229743, -0.010926924140076, 0.00142121714502687], [
//             [0.00116918, -0.00180037, 0.00025146],
//             [-0.00180037, 0.06785384, -0.00000455],
//             [0.00025146, -0.00000455, 0.06774489]
//         ]),
//         // link 3
//         spatialInertiaMatrix(0.5, [-0.0202737662, -0.133915, -0.0004587], [
//             [0.01361711, 0.00165794, -0.00000048],
//             [0.00165794, 0.00045024, -0.00000045],
//             [-0.00000048, -0.00000045, 0.01380322]
//         ]),
//         // link 4
//         spatialInertiaMatrix(0.38, [-9.66635792e-05, 0.00087606, -0.00496881], [
//             [0.00018501, 0.00000054, 0.00000120],
//             [0.00000054, 0.00018965, -0.00000841],
//             [0.00000120, -0.00000841, 0.00015484]
//         ]),
//         // link 5
//         spatialInertiaMatrix(0.383, [-4.10554119e-05, -0.05664867, -0.00372058], [
//             [0.00166169, 0.00000006, -0.00000007],
//             [0.00000006, 0.00018510, 0.00001026],
//             [-0.00000007, 0.00001026, 0.00164321]
//         ]),
//         // link 6
//         spatialInertiaMatrix(0.007, [-8.82590763e-05, 9.05983785e-06, -0.002], [
//             [5.73015541e-07, -1.98305403e-22, -7.27918939e-23],
//             [-1.98305403e-22, 5.73015541e-07, -3.41460266e-24],
//             [-7.27918939e-23, -3.41460266e-24, 1.06738869e-06]
//         ]),
//         // link_gripper
//         spatialInertiaMatrix(0.45, [-0.00018381, 8.05033e-05, 0.03214367], [
//             [0.00092934, 0.00000034, -0.00000738],
//             [0.00000034, 0.00071447, 0.00000005],
//             [-0.00000738, 0.00000005, 0.00039442]
//         ]),
//         // link 7 
//         spatialInertiaMatrix(0.025, [0.00065123, -0.04919299, 0.00972259], [
//             [0.00007371, -0.00000113, 0.00000021],
//             [-0.00000113, 0.00000781, -0.00001372],
//             [0.00000021, -0.00001372, 0.0000747]
//         ]),
//         // link 8 
//         spatialInertiaMatrix(0.025, [0.00065123, -0.04919299, 0.00972259], [
//             [0.00007371, -0.00000113, 0.00000021],
//             [-0.00000113, 0.00000781, -0.00001372],
//             [0.00000021, -0.00001372, 0.0000747]
//         ])
//     ];

//     /* Slist */
//     const S1 = screw_axis([0, 0, 1], [0, 0, L_01]);
//     const S2 = screw_axis([0, 1, 0], [0, 0, L_01]);
//     const S3 = screw_axis([0, 1, 0], [0, 0, L_01 + L_23]);
//     const S4 = screw_axis([0, 0, 1], [-W_34, 0, L_01 + L_23 + L_34]);
//     const S5 = screw_axis([0, 1, 0], [-W_34, 0, L_01 + L_23 + L_34]);
//     const S6 = screw_axis([0, 0, 1], [-W_34, 0, L_01 + L_23 + L_34 + L_56]);

//     const Slist = [
//         S1, S2, S3, S4, S5, S6
//     ].map(col => col.slice()); 

//     const SlistT = Array.from({length: 6}, (_, i) => Slist.map(row => row[i]));

//     // const Kplist = [3.5, 20, 15, 2.5, 0.5, 0.45]
//     // const Kilist = [0.00025, 0.035, 0.000225, 0, 0, 0.0003]
//     // const Kdlist = [1.2, 6.5, 4.2, 0.85, 0.1, 0.08]

//     // const Kplist = [3.5, 20, 15, 2.5, 0.5, 0.45]
//     // const Kilist = [0.00025, 0.035, 0.000225, 0, 0, 0.0003]
//     // const Kdlist = [0.6, 3.0, 2.0, 0.45, 0.1, 0.08]

//     return { M, Mlist, Glist, Slist: SlistT, jointLimits, toolLimit };
// });


// Register Unitree G1 robot
RobotDynamcis.register_robot("unitree_g1_arm_left_body", function build_unitree_g1_arm_left_body() {
    const P0 = [0, 0, 0]
    const P1 = [0, 0.100, 0+0.29178]
    const P2 = [0, 0.14034, -0.00282+0.29178]
    const P3 = [0.000, 0.14658, -0.10602+0.29178]
    const P4 = [0.01578, 0.14658, -0.18654+0.29178]
    const P5 = [0.11578, 0.14847, -0.19654+0.29178]
    const P6 = [0.15378, 0.14847, -0.19654+0.29178]
    const P7 = [0.19978, 0.14847, -0.19654+0.29178]
    const L_ee = 0.10

    const jointLimits = [
    { min: deg2rad(-120), max: deg2rad(120) },   // theta_0, wrist
    { min: deg2rad(-150), max: deg2rad(60) },   // theta_1
    { min: deg2rad(-10), max: deg2rad(130) },   // theta_2
    { min: deg2rad(-100), max: deg2rad(100) },   // theta_3
    { min: deg2rad(-60), max: deg2rad(85) },   // theta_4
    { min: deg2rad(-113), max: deg2rad(113) },   // theta_5
    { min: deg2rad(-92.5), max: deg2rad(92.5) },   // theta_6
    { min: deg2rad(-92.5), max: deg2rad(92.5) },   // theta_7
    ];

    const jointInitial = [0, 0, 0, 0, 0, 0, 0, 0];

    const M = [
        [1, 0, 0, 0.19978+0.12],
        [0, 1, 0, 0.14847-0.040],
        [0, 0, 1, -0.19654+0.29178+0.035],
        [0, 0, 0, 1]
    ];

    const S0 = screw_axis([0, 0, 1], P0);
    const S1 = screw_axis([0, 0.961261, 0.275637], P1);
    const S2 = screw_axis([1, 0, 0], P2);
    const S3 = screw_axis([0, 0, 1], P3);
    const S4 = screw_axis([0, 1, 0], P4);
    const S5 = screw_axis([1, 0, 0], P5);
    const S6 = screw_axis([0, 1, 0], P6);
    const S7 = screw_axis([0, 0, 1], P7);

    const Slist = [
        S0, S1, S2, S3, S4, S5, S6, S7
    ].map(col => col.slice()); 

    const SlistT = Array.from({length: 6}, (_, i) => Slist.map(row => row[i]));

    /* Mlist */
    const Mbase = [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ];
    const M00 = [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ];
    const M01 = [
        [1, 0, 0, 0],
        [0, 0.275637, -0.961261, +0.100],
        [0, -0.961261, 0.275637, +0.29178],
        [0, 0, 0, 1]
    ];
    const M12 = [
        [0, 0, -1, 0],
        [0, 1, 0, +0.01383],
        [1, 0, 0, +0.038],
        [0, 0, 0, 1]
    ];
    const M23 = [
        [1, 0, 0, +0.1032],
        [0, 1, 0, +0.00624],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ];
    const M34 = [
        [1, 0, 0, +0.01578],
        [0, 0, -1, 0],
        [0, 1, 0, -0.08052],
        [0, 0, 0, 1]
    ];
    const M45 = [
        [0, 0, -1, +0.100],
        [0, 1, 0, +0.010],
        [1, 0, 0, +0.00189],
        [0, 0, 0, 1]
    ];
    const M56 = [
        [1, 0, 0, 0],
        [0, 0, -1, 0],
        [0, 1, 0, +0.038],
        [0, 0, 0, 1]
    ];
    const M67 = [
        [1, 0, 0, +0.046],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ];
    const Mlist = [Mbase, M00, M01, M12, M23, M34, M45, M56, M67];

    /* Glist */
    const Glist = [
        // link 0 (torso)
        spatialInertiaMatrix(6.780, [0.000931, 0.000346, 0.15082], [
            [0.00048916, 0,          -0.0017715],
            [0,          0.00040472, 0         ],
            [-0.0017715, 0,          0.00043982]
        ]),
        // link 0 (torso)
        spatialInertiaMatrix(6.780, [0.000931, 0.000346, 0.15082], [
            [0.00048916, 0,          -0.0017715],
            [0,          0.00040472, 0         ],
            [-0.0017715, 0,          0.00043982]
        ]),
        // link 1 (left_shoulder_pitch_link)
        spatialInertiaMatrix(0.718, [0, 0.035892, -0.011628], [
            [0.0004291,  0,          0       ],
            [0,          0.000453,   0       ],
            [0,          0,          0.000423]
        ]),
        // link 2 (left_shoulder_roll_link)
        spatialInertiaMatrix(0.643, [-0.000227, 0.00727, -0.063243], [
            [0.0006177, 0,         0        ],
            [0,         0.0006912, 0        ],
            [0,         0,         0.0003894]
        ]),
        // link 3 (left_shoulder_yaw_link)
        spatialInertiaMatrix(0.734, [0.010773, -0.002949, -0.072009], [
            [0.0009988, 0,         0.0001412],
            [0,         0.0010605, 0        ],
            [0.0001412, 0,         0.0004354]
        ]),
        // link 4 (left_elbow_joint)
        spatialInertiaMatrix(0.6, [0.064956, 0.004454, -0.010062], [
            [0.0002891, 0,         0        ],
            [0,         0.0004152, 0        ],
            [0,         0,         0.0004197]
        ]), 
        // link 5 (left_wrist_roll_link)
        spatialInertiaMatrix(0.085, [0.01713944778, 0.00053759094, 0.00000048864], [
            [0.000048, 0,        0       ],
            [0,        0.000037, 0       ],
            [0,        0,        0.000054]
        ]),
        // link 6 (left_wrist_pitch_link)
        spatialInertiaMatrix(0.48404956, [0.02299989837, -0.00111685314, -0.00111658096], [
            [0.00016579646273, -0.00001231206746, 0.00001231699194],
            [-0.00001231206746, 0.00042954057410, 0.00000081417712],
            [0.00001231699194, 0.00000081417712, 0.00042953697654]
        ]),
        // link_7 (left_wrist_yaw_joint)
        spatialInertiaMatrix(0.08457647, [0.02200381568, 0.00049485096, 0.00053861123], [
            [0.00004929128828, -0.00000045735494, 0.00000445867591],
            [-0.00000045735494, 0.00005973338134, 0.00000043217198],
            [0.00000445867591, 0.00000043217198, 0.00003928083826]
        ]),
    ];

    return { M, Mlist, Glist, Slist: SlistT, jointLimits, jointInitial };
});

RobotDynamcis.register_robot("unitree_g1_arm_right_body", function build_unitree_g1_arm_right_body() {
    const P0 = [0, 0, 0]
    const P1 = [0, -0.100, 0+0.29178]
    const P2 = [0, -0.14034, -0.00282+0.29178]
    const P3 = [0.000, -0.14658, -0.10602+0.29178]
    const P4 = [0.01578, -0.14658, -0.18654+0.29178]
    const P5 = [0.11578, -0.14847, -0.19654+0.29178]
    const P6 = [0.15378, -0.14847, -0.19654+0.29178]
    const P7 = [0.19978, -0.14847, -0.19654+0.29178]
    const L_ee = 0.10

    const jointLimits = [
    { min: deg2rad(-120), max: deg2rad(120) },   // theta_0, wrist
    { min: deg2rad(-150), max: deg2rad(60) },   // theta_1
    { min: deg2rad(-130), max: deg2rad(10) },   // theta_2
    { min: deg2rad(-100), max: deg2rad(100) },   // theta_3
    { min: deg2rad(-60), max: deg2rad(85) },   // theta_4
    { min: deg2rad(-113), max: deg2rad(113) },   // theta_5
    { min: deg2rad(-92.5), max: deg2rad(92.5) },   // theta_6
    { min: deg2rad(-92.5), max: deg2rad(92.5) },   // theta_7
    ];

    const jointInitial = [0, 0, 0, 0, 0, 0, 0, 0];

    const M = [
        [1, 0, 0, 0.19978+0.12],
        [0, 1, 0, -0.14847+0.035],
        [0, 0, 1, -0.19654+0.29178+0.035],
        [0, 0, 0, 1]
    ];

    const S0 = screw_axis([0, 0, 1], P0);
    const S1 = screw_axis([0, 0.961261, -0.275637], P1);
    const S2 = screw_axis([1, 0, 0], P2);
    const S3 = screw_axis([0, 0, 1], P3);
    const S4 = screw_axis([0, 1, 0], P4);
    const S5 = screw_axis([1, 0, 0], P5);
    const S6 = screw_axis([0, 1, 0], P6);
    const S7 = screw_axis([0, 0, 1], P7);

    const Slist = [
        S0, S1, S2, S3, S4, S5, S6, S7
    ].map(col => col.slice()); 

    const SlistT = Array.from({length: 6}, (_, i) => Slist.map(row => row[i]));

    /* Mlist */
    const Mbase = [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ];
    const M00 = [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ];
    const M01 = [
        [1, 0, 0, 0],
        [0, -0.275637, -0.961261, -0.100],
        [0, -0.961261, -0.275637, +0.29178],
        [0, 0, 0, 1]
    ];
    const M12 = [
        [0, 0, -1, 0],
        [0, 1, 0, +0.01383],
        [1, 0, 0, -0.038],
        [0, 0, 0, 1]
    ];
    const M23 = [
        [1, 0, 0, +0.1032],
        [0, 1, 0, -0.00624],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ];
    const M34 = [
        [1, 0, 0, +0.01578],
        [0, 0, -1, 0],
        [0, 1, 0, -0.08052],
        [0, 0, 0, 1]
    ];
    const M45 = [
        [0, 0, -1, +0.100],
        [0, 1, 0, +0.010],
        [1, 0, 0, -0.00189],
        [0, 0, 0, 1]
    ];
    const M56 = [
        [1, 0, 0, 0],
        [0, 0, -1, 0],
        [0, 1, 0, +0.038],
        [0, 0, 0, 1]
    ];
    const M67 = [
        [1, 0, 0, +0.046],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ];
    const Mlist = [Mbase, M00, M01, M12, M23, M34, M45, M56, M67];

    /* Glist */
    const Glist = [
        // base link (torso)
        spatialInertiaMatrix(6.780, [0.000931, 0.000346, 0.15082], [
            [0.00048916, 0,          -0.0017715],
            [0,          0.00040472, 0         ],
            [-0.0017715, 0,          0.00043982]
        ]),
        // base link (torso)
        spatialInertiaMatrix(6.780, [0.000931, 0.000346, 0.15082], [
            [0.00048916, 0,          -0.0017715],
            [0,          0.00040472, 0         ],
            [-0.0017715, 0,          0.00043982]
        ]),
        // link 1 (right_shoulder_pitch_link)
        spatialInertiaMatrix(0.718, [0, -0.035892, -0.011628], [
            [0.0004291,  0,          0       ],
            [0,          0.000453,   0       ],
            [0,          0,          0.000423]
        ]),
        // link 2 (right_shoulder_roll_link)
        spatialInertiaMatrix(0.643, [-0.000227, -0.00727, -0.063243], [
            [0.0006177, 0,         0        ],
            [0,         0.0006912, 0        ],
            [0,         0,         0.0003894]
        ]),
        // link 3 (right_shoulder_yaw_link)
        spatialInertiaMatrix(0.734, [0.010773, 0.002949, -0.072009], [
            [0.0009988, 0,         0.0001412],
            [0,         0.0010605, 0        ],
            [0.0001412, 0,         0.0004354]
        ]),
        // link 4 (right_elbow_joint)
        spatialInertiaMatrix(0.6, [0.064956, -0.004454, -0.010062], [
            [0.0002891, 0,         0        ],
            [0,         0.0004152, 0        ],
            [0,         0,         0.0004197]
        ]), 
        // link 5 (right_wrist_roll_link)
        spatialInertiaMatrix(0.085, [0.01713944778, -0.00053759094, 0.00000048864], [
            [0.000048, 0,        0       ],
            [0,        0.000037, 0       ],
            [0,        0,        0.000054]
        ]),
        // link 6 (right_wrist_pitch_link)
        spatialInertiaMatrix(0.48404956, [0.02299989837, 0.00111685314, -0.00111658096], [
            [0.00016579646273, -0.00001231206746, 0.00001231699194],
            [-0.00001231206746, 0.00042954057410, 0.00000081417712],
            [0.00001231699194, 0.00000081417712, 0.00042953697654]
        ]),
        // link_7 (right_wrist_yaw_link)
        spatialInertiaMatrix(0.08457647, [0.02200381568, -0.00049485096, 0.00053861123], [
            [0.00004929128828, -0.00000045735494, 0.00000445867591],
            [-0.00000045735494, 0.00005973338134, 0.00000043217198],
            [0.00000445867591, 0.00000043217198, 0.00003928083826]
        ]),
    ];

    return { M, Mlist, Glist, Slist: SlistT, jointLimits, jointInitial };
});

RobotDynamcis.register_robot("unitree_g1_waist", function build_unitree_g1_waist() {
    const P0 = [0, 0, 0]
    const P1 = [-0.00396, 0.0, 0.044]
    const P2 = [-0.00396, 0.0, 0.044]

    const jointLimits = [
    { min: deg2rad(-120), max: deg2rad(120) },   // wrist_yaw
    { min: deg2rad(-29), max: deg2rad(29) },   // wrist_roll
    { min: deg2rad(-29), max: deg2rad(29) },   // wrist_pitch
    ];

    const jointInitial = [0, 0, 0];

    const M = [
        [1, 0, 0, -0.00396],
        [0, 0, 1, 0],
        [0, -1, 0, 0.044],
        [0, 0, 0, 1]
    ];

    const S0 = screw_axis([0, 0, 1], P0);
    const S1 = screw_axis([1, 0, 0], P1);
    const S2 = screw_axis([0, 1, 0], P2);

    const Slist = [
        S0, S1, S2,
    ].map(col => col.slice()); 

    const SlistT = Array.from({length: 6}, (_, i) => Slist.map(row => row[i]));

    const Mlist = []
    const Glist = []

    return { M, Mlist, Glist, Slist: SlistT, jointLimits, jointInitial };
});

module.exports = RobotDynamcis;
