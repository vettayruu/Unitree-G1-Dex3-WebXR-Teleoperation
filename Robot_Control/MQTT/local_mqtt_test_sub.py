import paho.mqtt.client as mqtt
import time
import json

def on_connect(client, userdata, flags, rc):
    print("✅ Connected with result code", rc)
    client.subscribe("test/timestamp")  # 可以改为 "#" 订阅所有Topic

def on_message(client, userdata, msg):
    recv_time = int(time.time() * 1000)
    try:
        data = json.loads(msg.payload.decode())
        send_time = data.get("timestamp", 0)
        latency = recv_time - send_time
        print(f"\n📩 Topic: {msg.topic}")
        print(f"Send: {send_time} | Recv: {recv_time} | Latency: {latency} ms")
    except Exception as e:
        print("Decode error:", e)
        print("Payload:", msg.payload)

client = mqtt.Client(transport="websockets")
client.tls_set(cert_reqs=0)
client.on_connect = on_connect
client.on_message = on_message

client.connect("192.168.197.39", 8333, 60)
client.loop_forever()
