from coppeliasim_zmqremoteapi_client import RemoteAPIClient

class CoppeliasimControl:
    def __init__(self, joint_name_list, tool_name_list):
        copp_client = RemoteAPIClient()
        self.sim = copp_client.getObject('sim')
        self.joint_handles = [self.sim.getObject(joint_name) for joint_name in joint_name_list]
        self.tool_handles = [self.sim.getObject(tool_name) for tool_name in tool_name_list]

    def send_joint_position(self, thetaBody):
        for i, handle in enumerate(self.joint_handles):
            self.sim.setJointTargetPosition(handle, thetaBody[i])

    def send_tool_position(self, thetaTool):
        for i, handle in enumerate(self.tool_handles):
            self.sim.setJointTargetPosition(handle, thetaTool[i])

    def get_joint_position(self):
        """读取当前的关节角（单位：弧度）"""
        joint_position = [self.sim.getJointPosition(handle) for handle in self.joint_handles]
        return joint_position

    def get_tool_position(self):
        """读取当前的关节角（单位：弧度）"""
        tool_position = [self.sim.getJointPosition(handle) for handle in self.tool_handles]
        return tool_position

