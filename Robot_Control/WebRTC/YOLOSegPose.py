from ultralytics import YOLO
import numpy as np
import cv2

class YOLOSegPose:
    def __init__(self, model_path: str):
        """
        初始化 YOLO 分割模型
        """
        self.model = YOLO(model_path, verbose=False)

        self.length_object = 80

        self.img_width = 1280
        self.img_height = 720

        self.left_arm_box = [0, 0, 0, 0] # x1, y1, x2, y2
        self.right_arm_box = [0, 0, 0, 0]

        self.left_tip_cx = 0
        self.left_tip_cy = 0
        self.left_tip_theta = 0

        self.right_tip_cx = 0
        self.right_tip_cy = 0
        self.right_tip_theta = 0

        self.pack_cx = 0
        self.pack_cy = 0
        self.pack_theta = 0

        self.sorted_items = []

    def infer(self, img):
        """
        推理图像，返回每个 mask 的类别、中心和主方向
        :param img: np.ndarray 或 图像路径
        :return: List[dict] [{'class': name, 'cx': float, 'cy': float, 'theta': float}, ...]
        """
        # 如果输入是路径，读取图像
        if isinstance(img, str):
            img = cv2.imread(img)

        # self.img_width = int(img.shape[1])
        # self.img_height = int(img.shape[0])

        # results = self.model(img)[0]

        results = self.model.predict(
            source=img,  # 可以是numpy数组、路径或图像对象
            conf=0.6,  # 置信度阈值（默认0.25）
            iou=0.6,  # IoU阈值（默认0.7）
            # device = 0, # cuda
            verbose=False,
        )[0]

        # print(self.model.device)

        output = []
        if results.masks is None:
            print("⚠️ No detections found.")
            return []

        for i, (box, mask) in enumerate(zip(results.boxes, results.masks.data)):
            mask = mask.cpu().numpy().astype(np.uint8)

            mask = cv2.GaussianBlur(mask, (7, 7), 3)

            # resize mask 到原图大小
            mask = cv2.resize(mask, (self.img_width, self.img_height), interpolation=cv2.INTER_NEAREST)

            # 类别和置信度
            cls_id = int(results.boxes.cls[i])
            cls_name = results.names[cls_id]

            # bounding box
            bbox = box.xyxy[0].tolist()

            # 计算质心和方向
            M = cv2.moments(mask)
            if M["m00"] == 0:  # 避免除0
                continue

            else:
                cx = M["m10"] / M["m00"]
                cy = M["m01"] / M["m00"]

                # 协方差矩阵的归一化二阶矩
                mu20 = M["mu20"] / M["m00"]
                mu02 = M["mu02"] / M["m00"]
                mu11 = M["mu11"] / M["m00"]

                # 特征值（对应长轴和短轴方向上的方差）
                common = np.sqrt((mu20 - mu02) ** 2 + 4 * mu11 ** 2)
                lambda1 = (mu20 + mu02 + common) / 2
                lambda2 = (mu20 + mu02 - common) / 2

                # 主轴和副轴长度（乘以比例因子以适配图像尺度）
                a = 2.0 * np.sqrt(lambda1)  # 长轴近似长度
                b = 2.0 * np.sqrt(lambda2)  # 短轴近似长度

                theta = 0.5 * np.arctan2(2 * M["mu11"], M["mu20"] - M["mu02"])
                theta_deg = np.degrees(theta)

            group_id = ''
            if cls_name == 'piper':
                if cx < self.img_width/2:
                    group_id = 'left'
                    self.left_arm_box = bbox
                elif cx >= self.img_width/2:
                    group_id = 'right'
                    self.right_arm_box = bbox

            else:
                group_id = 'object'

            # if cls_name == 'gripper':
            #     contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            #     approx = cv2.approxPolyDP(contours[0], epsilon=3, closed=True)
            #     cv2.drawContours(img, [approx], -1, (0, 255, 0), 2)

            output.append({
                'group': group_id,
                'class': cls_name,
                'cx': cx,
                'cy': cy,
                'a':a,
                'b':b,
                # 'bbox': bbox,
                'theta': theta_deg
            })

        lx1, ly1, lx2, ly2 = self.left_arm_box
        rx1, ry1, rx2, ry2 = self.right_arm_box

        for item in output:
            if item['class'] in ('tip', 'tip_1', 'tip_2', 'gripper'):
                cx = item.get('cx', 0)
                cy = item.get('cy', 0)
                if lx1 < lx2 and lx1 <= cx <= lx2 and ly1 <= cy <= ly2:
                    item['group'] = 'left'
                elif rx1 < rx2 and rx1 <= cx <= rx2 and ry1 <= cy <= ry2:
                    item['group'] = 'right'
                # else:
                #     item['group'] = item.get('group', '')

        return output

    def draw_pose(self, img, cx, cy, theta, item_class, length_x, length_y):
        cv2.circle(img, (int(cx), int(cy)), 5, (255, 0, 0), -1)

        # y direction
        x1 = int(cx + length_y * np.cos(theta + np.pi / 2))
        y1 = int(cy + length_y * np.sin(theta + np.pi / 2))
        cv2.line(img, (int(cx), int(cy)), (x1, y1), (0, 255, 0), 2)

        # x direction
        x2 = int(cx + length_x * np.cos(theta + np.pi))
        y2 = int(cy + length_x * np.sin(theta + np.pi))
        cv2.line(img, (int(cx), int(cy)), (x2, y2), (0, 0, 255), 2)

        # 绘制类别
        cv2.putText(img, item_class, (int(cx), int(cy) - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)

    def draw_gripper_pose(self, img, cx_tip_1, cy_tip_1, a_tip_1, theta_tip_1,
                            cx_tip_2, cy_tip_2, a_tip_2, theta_tip_2):

        tx_tip_1 = int(cx_tip_1 + a_tip_1 * np.cos(theta_tip_1))
        ty_tip_1 = int(cy_tip_1 + a_tip_1 * np.sin(theta_tip_1))

        tx_tip_2 = int(cx_tip_2 + a_tip_2 * np.cos(theta_tip_2))
        ty_tip_2 = int(cy_tip_2 + a_tip_2 * np.sin(theta_tip_2))

        cv2.line(img, (tx_tip_1, ty_tip_1), (tx_tip_2, ty_tip_2),
                 (0, 0, 255), 2)

        # 计算向量和法向量
        dx = tx_tip_2 - tx_tip_1
        dy = ty_tip_2 - ty_tip_1
        length = np.hypot(dx, dy)

        # 法向量单位化
        nx = ny = theta = None
        if length == 0:
            nx = ny = theta = 0
        else:
            nx = -dy / length
            ny = dx / length
            theta = np.arctan2(ny, nx)

        width = 150

        # 四个角点
        pt1 = (int(tx_tip_1 + nx * width / 2), int(ty_tip_1 + ny * width / 2))
        pt2 = (int(tx_tip_2 + nx * width / 2), int(ty_tip_2 + ny * width / 2))
        pt3 = (int(tx_tip_2 - nx * width / 2), int(ty_tip_2 - ny * width / 2))
        pt4 = (int(tx_tip_1 - nx * width / 2), int(ty_tip_1 - ny * width / 2))
        pts = np.array([pt1, pt2, pt3, pt4], np.int32)

        # 创建 overlay 并画矩形带
        overlay = img.copy()
        cv2.fillPoly(overlay, [pts], (0, 0, 255))  # 红色带子

        # 设置透明度
        alpha = 0.2
        cv2.addWeighted(overlay, alpha, img, 1 - alpha, 0, img)

        cx_tip = (tx_tip_1 + tx_tip_2)/2
        cy_tip = (ty_tip_1 + ty_tip_2)/2
        cv2.circle(img, (int(cx_tip), int(cy_tip)), 5, (255, 0, 0), 2)

        return cx_tip, cy_tip, theta

    def visualize(self, img):
        """
        可视化 mask 主方向
        """
        if isinstance(img, str):
            img = cv2.imread(img)

        output = self.infer(img)

        groups = {}
        for item in output:
            g = item.get('group', '') or 'ungrouped'
            groups.setdefault(g, []).append(item)

        for g, items in groups.items():
            # print('group:', g)
            # print('items:', items)

            if g == 'left':
                cx_tip_1 = cy_tip_1 = theta_tip_1 = None
                cx_tip_2 = cy_tip_2 = theta_tip_2 = None
                a_tip_1 = b_tip_1 = a_tip_2 = b_tip_2 = None

                for item in items:
                    if item['class'] == 'tip_1':
                        cx_tip_1, cy_tip_1 = item['cx'], item['cy']
                        theta_tip_1 = np.radians(item['theta'])
                        a_tip_1,  b_tip_1= item['a'], item['b']
                        self.draw_pose(img, cx_tip_1, cy_tip_1, theta_tip_1 + np.pi, item['class'], a_tip_1,  b_tip_1)

                    elif item['class'] == 'tip_2':
                        cx_tip_2, cy_tip_2 = item['cx'], item['cy']
                        theta_tip_2 = np.radians(item['theta'])
                        a_tip_2, b_tip_2 = item['a'], item['b']
                        self.draw_pose(img, cx_tip_2, cy_tip_2, theta_tip_2 + np.pi, item['class'], a_tip_2, b_tip_2)

                if cx_tip_1 is not None and cx_tip_2 is not None:
                    cx_tip, cy_tip, theta = self.draw_gripper_pose(img, cx_tip_1, cy_tip_1, a_tip_1, theta_tip_1,
                                      cx_tip_2, cy_tip_2, a_tip_2, theta_tip_2)

                    # get_left_tip_pose
                    self.left_tip_cx = cx_tip
                    self.left_tip_cy = cy_tip
                    self.left_tip_theta = theta

            elif g == 'right':
                cx_tip_1 = cy_tip_1 = theta_tip_1 = None
                cx_tip_2 = cy_tip_2 = theta_tip_2 = None
                a_tip_1 = b_tip_1 = a_tip_2 = b_tip_2 = None

                for item in items:
                    if item['class'] == 'tip_1':
                        cx_tip_1, cy_tip_1 = item['cx'], item['cy']
                        theta_tip_1 = np.radians(item['theta'])
                        a_tip_1,  b_tip_1= item['a'], item['b']
                        self.draw_pose(img, cx_tip_1, cy_tip_1, theta_tip_1, item['class'], a_tip_1,  b_tip_1)

                    elif item['class'] == 'tip_2':
                        cx_tip_2, cy_tip_2 = item['cx'], item['cy']
                        theta_tip_2 = np.radians(item['theta'])
                        a_tip_2, b_tip_2 = item['a'], item['b']
                        self.draw_pose(img, cx_tip_2, cy_tip_2, theta_tip_2, item['class'], a_tip_2, b_tip_2)

                if cx_tip_1 is not None and cx_tip_2 is not None:
                    cx_tip, cy_tip, theta = self.draw_gripper_pose(img, cx_tip_1, cy_tip_1, a_tip_1, theta_tip_1 + np.pi,
                                      cx_tip_2, cy_tip_2, a_tip_2, theta_tip_2 + np.pi)

                    # get_right_tip_pose
                    self.right_tip_cx = cx_tip
                    self.right_tip_cy = cy_tip
                    self.right_tip_theta = theta

            else:
                p_right_arm = np.array([self.right_tip_cx, self.right_tip_cy])
                p_pack = []

                # Collect all item positions
                for item in items:
                    cx, cy, theta = item['cx'], item['cy'], np.radians(item['theta'])
                    self.draw_pose(img, cx, cy, theta, item['class'], self.length_object, self.length_object / 2)
                    p_pack.append([cx, cy])

                p_pack = np.array(p_pack)  # shape (N, 2)

                # Compute distances from right arm tip to all items
                D = np.linalg.norm(p_pack - p_right_arm, axis=1)  # shape (N,)

                # Sort by distance
                sorted_idx = np.argsort(D)

                # Get sorted items
                self.sorted_items = [items[i] for i in sorted_idx]
                # print("sorted_items", self.sorted_items)

                # Optional: print for debug
                # for i, idx in enumerate(sorted_idx):
                #     print(f"{i + 1}. class={items[idx]['class']}, distance={D[idx]:.3f}")



    def get_pack_pose(self):
        return self.pack_cx, self.pack_cy, self.pack_theta

    def get_tip_pose_left(self):
        return self.left_tip_cx, self.left_tip_cy, self.left_tip_theta

    def get_tip_pose_right(self):
        return self.right_tip_cx, self.right_tip_cy, self.right_tip_theta

    def get_sorted_items(self):
        return self.sorted_items

        # cv2.imshow("YOLO Seg Pose", img)
        # cv2.waitKey(0)
        # cv2.destroyAllWindows()


