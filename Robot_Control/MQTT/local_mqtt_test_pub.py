import paho.mqtt.client as mqtt
import time
import json

client = mqtt.Client(transport="websockets")
client.tls_set(cert_reqs=0)
client.connect("192.168.197.39", 8333, 60)

topic = "test/timestamp"

while True:
    timestamp = int(time.time() * 1000)
    payload = json.dumps({"timestamp": timestamp})
    client.publish(topic, payload)
    print(f"📤 Sent: {payload}")
    time.sleep(1)  # 每秒发一次，可改成更短
