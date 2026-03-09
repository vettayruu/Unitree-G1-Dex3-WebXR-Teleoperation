import numpy as np

class PredictiveFilter:
    def __init__(self, f_cutoff, dt):
        self.dt = dt
        self.omega = 2 * np.pi * f_cutoff
        self.y = None
        self.dy = 0
        # 引入预测增益 (Alpha)，0 代表标准滤波，越大越能补偿延迟
        self.alpha = 0.1

    def update(self, x_target):
        if self.y is None:
            self.y = x_target
            return x_target

        # 计算误差
        error = x_target - self.y

        # 核心逻辑：利用二阶系统模拟弹簧阻尼
        # ddy = omega^2 * error - 2 * omega * dy
        ddy = (self.omega ** 2) * error - (2 * self.omega) * self.dy

        # 更新状态
        self.dy += ddy * self.dt
        self.y += self.dy * self.dt

        # 【改进点】前馈补偿：输出 y 时加上一部分速度预测量
        # 这样可以在视觉和物理上抵消滤波器的滞后
        output = self.y + self.alpha * self.dy

        return output


class FastTrackFilter:
    def __init__(self, alpha=0.5, beta=0.3):
        self.alpha = alpha  # 基础平滑
        self.beta = beta  # 趋势平滑（修正迟滞的关键）
        self.level = None
        self.trend = None

    def update(self, x):
        if self.level is None:
            self.level = x
            self.trend = 0
            return x

        last_level = self.level
        self.level = self.alpha * x + (1 - self.alpha) * (self.level + self.trend)
        self.trend = self.beta * (self.level - last_level) + (1 - self.beta) * self.trend

        return self.level + self.trend  # 加上趋势项，大幅减少迟滞