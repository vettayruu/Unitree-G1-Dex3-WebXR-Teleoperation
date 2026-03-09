# メタワーク用の MQTT manager

# internal instruction
# https://uclab.esa.io/posts/8825 (privavte)

import paho.mqtt.client as mqtt
import json
import time

TIMEOUT_HOUR = 1  # for More than 1 hour, we need to clear the device db.


# client robots should update there info for each 30min.
class MetaworkMQTT:
    def __init__(self, host, port):  # , username, password):
        self.host = host
        self.port = port
        self.mod = False

        # self.username = username
        # self.password = password
        # self.client.username_pw_set(username, password)

        # For Local MQTT Test
        self.client = mqtt.Client(transport="websockets")
        self.client.tls_set(cert_reqs=0)

        self.client.connect(host, port, 60)

        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message

        self.devices = []

        self.client.loop_start()

    def on_connect(self, client, userdata, flags, rc):
        print("Connected with result code " + str(rc))
        client.subscribe("mgr/register")
        client.subscribe("mgr/unregister")
        client.subscribe("mgr/request")

    def on_message(self, client, userdata, msg):
        #        print(msg.topic+" "+str(msg.payload))
        if msg.topic == "mgr/register":
            self.update_status()
            self.register(msg)
        elif msg.topic == "mgr/unregister":
            self.update_status()
            self.unregister(msg)
        elif msg.topic == "mgr/request":
            self.request(msg)

    # we need to flush obsolute devices after TIMEOUT_HOUR
    def update_status(self):
        for d in self.devices:
            if (time.time()) - d["registered"] > TIMEOUT_HOUR * 3600:
                print("TIMEOUT: ", d)
                self.devices.remove(d)  # あれば、そのデータを消す

    def register(self, msg):
        data = json.loads(msg.payload)
        ver = data.get("version", "none")

        if not "devId" in data:
            return

        if "device" in data:
            print("register:", data["devId"][:4] + "-" + data["devId"][-4:], ver, data["device"]["agent"])
        else:
            print("register:", data["devId"][:4] + "-" + data["devId"][-4:], ver)

        # 同じIDのデバイスがあるかを確認
        for d in self.devices:
            if d["devId"] == data["devId"]:
                self.devices.remove(d)  # あれば、そのデータを消したうえで
                break
        # 最後にappend する

        # update for codeType -> type
        cType = ""
        if "type" in data:
            cType = data["type"]
        elif "codeType" in data:
            cType = data["codeType"]
        else:
            cType = "unknown"

        optStr = ""
        if "optStr" in data:
            optStr = data["optStr"]

        self.devices.append({
            "type": cType,
            "version": ver,
            "devId": data["devId"],
            "devType": data["devType"],
            "optStr": optStr,
            "date": data["date"],
            "registered": int(time.time())
        })
        self.mod = True

    def unregister(self, msg):
        data = json.loads(msg.payload)
        if not "devId" in data:
            return
        print("unregister:", data["devId"])
        # 同じIDのデバイスがあるかを確認
        for d in self.devices:
            if d["devId"] == data["devId"]:
                self.devices.remove(d)  # あれば、そのデータを消したうえで
                break
        self.mod = True

    #        print("register")
    #        self.client.publish("mgr/register", json.dumps(data))

    #   希望するタイプのデバイスがあるかを確認
    def request(self, msg):
        data = json.loads(msg.payload)
        print("Request:", data)
        # 逆に探すべし。
        rev_list = self.devices[::-1]
        try:
            for d in rev_list:
                if d["devType"] == "robot" and d["type"] == data["type"]:
                    print("Request found", d)  # 本当は、現在使われているか、オーバライドか、などの情報を保持すべき
                    self.client.publish("dev/" + data["devId"], json.dumps(d))
                    self.pub_event({"event": "request", "from": data, "to": d, "date": time.ctime()})
                    return
        except:
            print("error in request", data)
        print("not found request ", data["type"])
        self.client.publish("dev/" + data["devId"], json.dumps({"devId": "none"}))

    def pub_status(self):
        self.client.publish("mgr/status", json.dumps(self.devices))

    def pub_event(self, event):
        self.client.publish("mgr/event", json.dumps(event))

    def print_devices(self):
        for i, r in enumerate(self.devices):
            print(i, r)
        self.mod = False


if __name__ == "__main__":
    # host = "127.0.0.1"
    # port = 1883

    host = '192.168.197.36'
    port = 8333
    mq = MetaworkMQTT(host, port)

    while True:
        time.sleep(1)
        if mq.mod:
            print("---- " + time.ctime() + " -------------")
            mq.print_devices()
            mq.pub_status()
