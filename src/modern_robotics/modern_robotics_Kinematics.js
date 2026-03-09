const deg2rad = deg => {
  if (Array.isArray(deg)) {
    return deg.map(d => d * Math.PI / 180); 
  }
  return deg * Math.PI / 180; 
};

function screw_axis(w, q) {
    const cross = [
        w[1]*q[2] - w[2]*q[1],
        w[2]*q[0] - w[0]*q[2],
        w[0]*q[1] - w[1]*q[0]
    ];
    return w.concat([-cross[0], -cross[1], -cross[2]]);
}

class RobotKinematics {
    static _builders = {};

    constructor(robot_id) {
        this.robot_id = robot_id;
        if (!(robot_id in RobotKinematics._builders)) {
            throw new Error(`Unsupported robot_id: ${robot_id}`);
        }
        const { M, Slist, jointLimits, jointInitial } = RobotKinematics._builders[robot_id]();
        this.M = M;
        this.Slist = Slist;
        this.jointLimits = jointLimits;
        this.jointInitial = jointInitial;
    }

    static register_robot(robot_id, builderFunc) {
        RobotKinematics._builders[robot_id] = builderFunc;
    }

    get_M() {
        return this.M;
    }

    get_Slist() {
        return this.Slist;
    }

    get_jointLimits() {
        return this.jointLimits;
    }

    get_jointInitial() {
        return this.jointInitial;
    }

}

RobotKinematics.register_robot("agilex_piper", function build_piper_6dof() {
    const L_01 = 0.123, L_23 = 0.28503, L_34 = 0.25075, L_56 = 0.091, L_ee = 0.1358;
    const W_34 = 0.0219;

    // For Single Arm Setting
    // const jointLimits = [
    // { min: deg2rad(-150), max: deg2rad(150) },   // theta_1
    // { min: deg2rad(-90),  max: deg2rad(90)  },   // theta_2
    // { min: deg2rad(0),    max: deg2rad(169) },   // theta_3
    // { min: deg2rad(-99),  max: deg2rad(99)  },   // theta_4
    // { min: deg2rad(-69.901),  max: deg2rad(69.901) },   // theta_5
    // { min: deg2rad(-120), max: deg2rad(120) },   // theta_6
    // ];

    // For Double Arm Setting
    const jointLimits = [
    { min: deg2rad(-45), max: deg2rad(45) },   // theta_1
    { min: deg2rad(-45),  max: deg2rad(55)  },   // theta_2
    { min: deg2rad(45),    max: deg2rad(145) },   // theta_3
    { min: deg2rad(-95),  max: deg2rad(95)  },   // theta_4
    { min: deg2rad(1),  max: deg2rad(69) },   // theta_5
    { min: deg2rad(-120), max: deg2rad(120) },   // theta_6
    ];

    // const jointInitial = [0, -0.27473, 1.44144, 0, 1.22586, 0]; 
    const jointInitial = deg2rad([0, 115-90, -42+169.997, 90, 58, -90]);


    const M = [
        [1, 0, 0, -W_34],
        [0, 1, 0, 0],
        [0, 0, 1, L_01 + L_23 + L_34 + L_56 + L_ee],
        [0, 0, 0, 1]
    ];

    // const M = [
    //     [1, 0, 0, -0.0219],
    //     [0, 1, 0, -0.6],
    //     [0, 0, 1, 0.88558],
    //     [0, 0, 0, 1]
    // ];

    const S1 = screw_axis([0, 0, 1], [0, 0, L_01]);
    const S2 = screw_axis([0, 1, 0], [0, 0, L_01]);
    const S3 = screw_axis([0, 1, 0], [0, 0, L_01 + L_23]);
    const S4 = screw_axis([0, 0, 1], [-W_34, 0, L_01 + L_23 + L_34]);
    const S5 = screw_axis([0, 1, 0], [-W_34, 0, L_01 + L_23 + L_34]);
    const S6 = screw_axis([0, 0, 1], [-W_34, 0, L_01 + L_23 + L_34 + L_56]);

    const Slist = [
        S1, S2, S3, S4, S5, S6
    ].map(col => col.slice()); 

    const SlistT = Array.from({length: 6}, (_, i) => Slist.map(row => row[i]));

    return { M, Slist: SlistT, jointLimits, jointInitial };
});

RobotKinematics.register_robot("jaka_zu_5", function build_jaka_zu_5_6dof() {
    const X_01 = 0, Y_01 = 0, Z_01 = +0.12015
    const X_02 = 0, Y_02 = 0, Z_02 = +0.12015
    const X_03 = 0, Y_03 = 0, Z_03 = +0.55015
    const X_04 = -0.00006, Y_04 = -0.114, Z_04 = +0.91865
    const X_05 = -0.00006, Y_05 = -0.114, Z_05 = +1.03215
    const X_06 = -0.00001, Y_06 = -0.007, Z_06 = +1.03215

    const L_ee = 0.05

    const jointLimits = [
    { min: deg2rad(-360), max: deg2rad(360) },   // theta_1
    { min: deg2rad(-90), max: deg2rad(90) },   // theta_2
    { min: deg2rad(-150), max: deg2rad(150) },   // theta_3
    { min: deg2rad(-180), max: deg2rad(180) },   // theta_4
    { min: deg2rad(-360), max: deg2rad(360) },   // theta_5
    { min: deg2rad(-360), max: deg2rad(360) },   // theta_6
    ];

    // const jointInitial = deg2rad([0,20,90,-20,-90,-90]); 

    const M = [
        [-1, 0, 0, X_06],
        [0, 0, 1, Y_06 + L_ee],
        [0, 1, 0, Z_06],
        [0, 0, 0, 1]
    ];

    const S1 = screw_axis([0, 0, 1], [X_01, Y_01, Z_01]);
    const S2 = screw_axis([0, 1, 0], [X_02, Y_02, Z_02]);
    const S3 = screw_axis([0, 1, 0], [X_03, Y_03, Z_03]);
    const S4 = screw_axis([0, 1, 0], [X_04, Y_04, Z_04]);
    const S5 = screw_axis([0, 0, 1], [X_05, Y_05, Z_05]);
    const S6 = screw_axis([0, 1, 0], [X_06, Y_06, Z_06]);

    const Slist = [
        S1, S2, S3, S4, S5, S6
    ].map(col => col.slice()); 

    const SlistT = Array.from({length: 6}, (_, i) => Slist.map(row => row[i]));

    return { M, Slist: SlistT, jointLimits, jointInitial };
});

RobotKinematics.register_robot("myCobot280", function build_myCobot280_6dof() {
    const X_01 = 0, Y_01 = 0, Z_01 = +0.0706
    const X_02 = 0, Y_02 = -0.03256, Z_02 = +0.1306
    const X_03 = 0, Y_03 = -0.03056, Z_03 = +0.241
    const X_04 = 0, Y_04 = -0.03106, Z_04 = +0.337
    const X_05 = 0, Y_05 = -0.06462, Z_05 = +0.37218
    const X_06 = +0.0336, Y_06 = -0.06462, Z_06 = +0.41018
    const X_EE = 0.040, Y_EE = 0, Z_EE = 0.038

    const jointLimits = [
    { min: deg2rad(-168), max: deg2rad(168) },   // theta_1
    { min: deg2rad(-135), max: deg2rad(135) },   // theta_2
    { min: deg2rad(-150), max: deg2rad(150) },   // theta_3
    { min: deg2rad(-145), max: deg2rad(145) },   // theta_4
    { min: deg2rad(-165), max: deg2rad(165) },   // theta_5
    { min: deg2rad(-180), max: deg2rad(180) },   // theta_6
    ];

    const jointInitial = deg2rad([0, 45, -100, 0, 0, 0]);
    // const jointInitial = deg2rad([0,0,0,0,0,0]); [18.0, -22.5, -123, 128, -20, 5.5]; [0, 45, -100, 0, 0, 0]

    const M = [
        [0, 0, 1, X_06 + X_EE],
        [-1, 0, 0, Y_06 + Y_EE],
        [0, -1, 0, Z_06 + Z_EE],
        [0, 0, 0, 1]
    ];

    const S1 = screw_axis([0, 0, 1], [X_01, Y_01, Z_01]);
    const S2 = screw_axis([0, -1, 0], [X_02, Y_02, Z_02]);
    const S3 = screw_axis([0, -1, 0], [X_03, Y_03, Z_03]);
    const S4 = screw_axis([0, -1, 0], [X_04, Y_04, Z_04]);
    const S5 = screw_axis([0, 0, 1], [X_05, Y_05, Z_05]);
    const S6 = screw_axis([1, 0, 0], [X_06, Y_06, Z_06]);

    const Slist = [
        S1, S2, S3, S4, S5, S6
    ].map(col => col.slice()); 

    const SlistT = Array.from({length: 6}, (_, i) => Slist.map(row => row[i]));

    return { M, Slist: SlistT, jointLimits, jointInitial };
});

RobotKinematics.register_robot("unitree_g1_arm_right_body", function build_unitree_g1_arm_right_body() {
    const P0 = [0, 0, 0]
    const P1 = [0, -0.100, 0+0.29178]
    const P2 = [0, -0.14034, -0.00282+0.29178]
    const P3 = [0.000, -0.14658, -0.10602+0.29178]
    const P4 = [0.01578, -0.14658, -0.18654+0.29178]
    const P5 = [0.11578, -0.14847, -0.19654+0.29178]
    const P6 = [0.15378, -0.14847, -0.19654+0.29178]
    const P7 = [0.19978, -0.14847, -0.19654+0.29178]

    const jointLimits = [
    { min: deg2rad(-120), max: deg2rad(120) },   // theta_0, wrist
    { min: deg2rad(-150), max: deg2rad(60) },   // theta_1
    { min: deg2rad(-100), max: deg2rad(5) },   // theta_2
    { min: deg2rad(-90), max: deg2rad(90) },   // theta_3 defalt: { min: deg2rad(-150), max: deg2rad(150) }
    { min: deg2rad(-60), max: deg2rad(90) },   // theta_4
    { min: deg2rad(-113), max: deg2rad(113) },   // theta_5
    { min: deg2rad(-92.5), max: deg2rad(92.5) },   // theta_6
    { min: deg2rad(-92.5), max: deg2rad(92.5) },   // theta_7
    ];

    // const jointInitial = deg2rad([0, 0, 0, 0, 0, 0, 0, 0]);
    const jointInitial = [0, -0.025, -0.25, 0.23, 0.022, 0.25, -0.055, -0.225];

    // const M = [
    //     [1, 0, 0, 0.19978+0.12],
    //     [0, 1, 0, -0.14847+0.035],
    //     [0, 0, 1, -0.19654+0.29178+0.035],
    //     [0, 0, 0, 1]
    // ];

    const M = [
        [1, 0, 0, 0.19978+0.0415],
        [0, 1, 0, -0.14847],
        [0, 0, 1, -0.19654+0.29178],
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

    return { M, Slist: SlistT, jointLimits, jointInitial };
});

RobotKinematics.register_robot("unitree_g1_arm_left_body", function build_unitree_g1_arm_left_body() {
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
    { min: deg2rad(-5), max: deg2rad(100) },   // theta_2
    { min: deg2rad(-90), max: deg2rad(90) },   // theta_3
    { min: deg2rad(-60), max: deg2rad(90) },   // theta_4
    { min: deg2rad(-113), max: deg2rad(113) },   // theta_5
    { min: deg2rad(-92.5), max: deg2rad(92.5) },   // theta_6
    { min: deg2rad(-92.5), max: deg2rad(92.5) },   // theta_7
    ];

    // const jointInitial = deg2rad([0, 0, 0, 0, 0, 0, 0, 0]);

    const jointInitial = [0, -0.025, 0.25, -0.23, 0.022, -0.25, -0.055, 0.225];
    // [0, -0.024563147987939713, 0.25127309482299626, -0.23209768998129876, 0.02179546260306924, -0.2503966555932314, -0.05533942513782316, 0.22617949527328127]

    // const M = [
    //     [1, 0, 0, 0.19978+0.12],
    //     [0, 1, 0, 0.14847-0.040],
    //     [0, 0, 1, -0.19654+0.29178+0.035],
    //     [0, 0, 0, 1]
    // ];

    const M = [
        [1, 0, 0, 0.19978+0.0415],
        [0, 1, 0, 0.14847],
        [0, 0, 1, -0.19654+0.29178],
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

    return { M, Slist: SlistT, jointLimits, jointInitial };
});


RobotKinematics.register_robot("unitree_g1_waist", function build_unitree_g1_waist() {
    const P0 = [0, 0, 0]
    const P1 = [-0.00396, 0.0, 0.044]
    const P2 = [-0.00396, 0.0, 0.044]

    const jointLimits = [
    { min: deg2rad(-120), max: deg2rad(120) },   // wrist_yaw
    { min: deg2rad(-29), max: deg2rad(29) },   // wrist_roll
    { min: deg2rad(-29), max: deg2rad(29) },   // wrist_pitch
    ];

    const jointInitial = deg2rad([0, 0, 0]);

    const M = [
        [1, 0, 0, -0.00396],
        [0, 1, 0, 0],
        [0, 0, 1, 0.044],
        [0, 0, 0, 1]
    ];

    const S0 = screw_axis([0, 0, 1], P0);
    const S1 = screw_axis([1, 0, 0], P1);
    const S2 = screw_axis([0, 1, 0], P2);

    const Slist = [
        S0, S1, S2,
    ].map(col => col.slice()); 

    const SlistT = Array.from({length: 6}, (_, i) => Slist.map(row => row[i]));

    return { M, Slist: SlistT, jointLimits, jointInitial };
});


RobotKinematics.register_robot("unitree_g1_hand_index_middle", function build_unitree_g1_hand_index_middle() {
    const P0 = [0, 0, 0]
    const P1 = [0.0458, 0.0, 0.0]
    // const P2 = [0.0458+0.05, 0.0, 0.0] // finger tip

    const jointLimits = [
    { min: deg2rad(-90), max: deg2rad(90) },   // wrist_yaw
    { min: deg2rad(-90), max: deg2rad(90) },   // wrist_roll
    ];

    const jointInitial = deg2rad([0, 0]);

    const M = [
        [1, 0, 0, 0.0458+0.05],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ];

    const S0 = screw_axis([0, 0, 1], P0);
    const S1 = screw_axis([0, 0, 1], P1);

    const Slist = [
        S0, S1, 
    ].map(col => col.slice()); 

    const SlistT = Array.from({length: 6}, (_, i) => Slist.map(row => row[i]));

    return { M, Slist: SlistT, jointLimits, jointInitial };
});


// // Register other robots
// RobotKinematics.register_robot("ur5", function ur5() {
//     // Custom UR5 parameters and poses
//     // return { M, Slist };
// });

module.exports = RobotKinematics;
