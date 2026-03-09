import numpy as np

deg2rad = np.deg2rad

class RobotKinematics:
    _builders = {}

    def __init__(self, robot_id):
        self.robot_id = robot_id
        if robot_id not in self._builders:
            raise ValueError(f"Unsupported robot_id: {robot_id}")
        self.M, self.Slist, self.jointLimits = self._builders[robot_id]()

    @classmethod
    def register_robot(cls, robot_id):
        def decorator(func):
            cls._builders[robot_id] = func
            return func
        return decorator

    def get_M(self):
        return self.M

    def get_Slist(self):
        return self.Slist

    def get_jointLimits(self):
        return self.jointLimits


@RobotKinematics.register_robot("piper_agilex")
def build_piper_6dof():
    L_01, L_23, L_34, L_56, L_ee = 0.123, 0.28503, 0.25075, 0.091, 0.1358
    W_34 = 0.0219

    M = np.array([
        [1, 0, 0, -W_34],
        [0, 1, 0, 0],
        [0, 0, 1, L_01 + L_23 + L_34 + L_56 + L_ee],
        [0, 0, 0, 1]
    ])

    # jointLimits = [
    #     {"min": deg2rad(-150), "max": deg2rad(150)},
    #     {"min": deg2rad(-90), "max": deg2rad(90)},
    #     {"min": deg2rad(0), "max": deg2rad(170)},
    #     {"min": deg2rad(-95), "max": deg2rad(95)},
    #     {"min": deg2rad(-70), "max": deg2rad(70)},
    #     {"min": deg2rad(-120), "max": deg2rad(120)},
    # ]

    # Double Arm
    jointLimits = [
        {"min": deg2rad(-45), "max": deg2rad(45)},
        {"min": deg2rad(-45), "max": deg2rad(55)},
        {"min": deg2rad(45), "max": deg2rad(145)},
        {"min": deg2rad(-95), "max": deg2rad(95)},
        {"min": deg2rad(1), "max": deg2rad(69)},
        {"min": deg2rad(-120), "max": deg2rad(120)},
    ]

    def screw_axis(w, q):
        return np.hstack((w, -np.cross(w, q)))

    S1 = screw_axis(np.array([0, 0, 1]), np.array([0, 0, L_01]))
    S2 = screw_axis(np.array([0, 1, 0]), np.array([0, 0, L_01]))
    S3 = screw_axis(np.array([0, 1, 0]), np.array([0, 0, L_01 + L_23]))
    S4 = screw_axis(np.array([0, 0, 1]), np.array([-W_34, 0, L_01 + L_23 + L_34]))
    S5 = screw_axis(np.array([0, 1, 0]), np.array([-W_34, 0, L_01 + L_23 + L_34]))
    S6 = screw_axis(np.array([0, 0, 1]), np.array([-W_34, 0, L_01 + L_23 + L_34 + L_56]))

    Slist = np.column_stack((S1, S2, S3, S4, S5, S6))
    return M, Slist, jointLimits

# @RobotKinematics.register_robot("jaka_zu_5")
# def build_jaka_zu_5_6dof():
#     # joint initial position relative to world
#     X_01, Y_01, Z_01 = +0.00684, -0.00175, +0.04097
#     X_02, Y_02, Z_02 = +0.00684, +0.06232, +0.12112
#     X_03, Y_03, Z_03 = +0.00684, +0.06232, +0.48112
#     X_04, Y_04, Z_04 = +0.00684, +0.06781, +0.78412
#     X_05, Y_05, Z_05 = +0.00684, +0.11327, +0.85165
#     X_06, Y_06, Z_06 = +0.00684, +0.04386, +0.89762
#
#     # tool length
#     L_ee = 0
#
#     M = np.array([
#         [0, 0, 1, X_06],
#         [1, 0, 0, Y_06 + L_ee],
#         [0, 1, 0, Z_06],
#         [0, 0, 0, 1]
#     ])
#
#
#
#     def screw_axis(w, q):
#         return np.hstack((w, -np.cross(w, q)))
#
#     S1 = screw_axis(np.array([0, 0, 1]), np.array([X_01, Y_01, Z_01]))
#     S2 = screw_axis(np.array([0, 1, 0]), np.array([X_02, Y_02, Z_02]))
#     S3 = screw_axis(np.array([0, 1, 0]), np.array([X_03, Y_03, Z_03]))
#     S4 = screw_axis(np.array([0, 1, 0]), np.array([X_04, Y_04, Z_04]))
#     S5 = screw_axis(np.array([0, 0, 1]), np.array([X_05, Y_05, Z_05]))
#     S6 = screw_axis(np.array([0, 1, 0]), np.array([X_06, Y_06, Z_06]))
#
#     Slist = np.column_stack((S1, S2, S3, S4, S5, S6))
#     return M, Slist, jointLimits

# @RobotKinematics.register_robot("ur5")
# def ur5():
#     # 自定义 UR5 的参数和姿态
#     ...
#     return M, Slist
