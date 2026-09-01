#!/usr/bin/env bash
#
# 在用户示例脚本的风格基础上，增加了摄像头指定（-d）和列出设备（-l）选项
# 每次运行都会先列出当前摄像头设备，再决定是否继续连接
#
# 用法示例:
#   ./run_g1.sh -d "USB Camera"                      # 用指定摄像头，其余用默认值
#   ./run_g1.sh -r HD -b 4000 -c my-room -d "e2eSoft iVCam"
#   ./run_g1.sh -l                                    # 只列出可用设备，不连接

RESOLUTION="2880x1620"
BITRATE=10000
CHANNEL="g1-vr180"
VIDEO_DEVICE=""
LIST_DEVICES=false

while getopts "r:b:c:d:l" optKey; do
    case "$optKey" in
        r)
            RESOLUTION=${OPTARG}
            ;;
        b)
            BITRATE=${OPTARG}
            ;;
        c)
            CHANNEL=${OPTARG}
            ;;
        d)
            VIDEO_DEVICE=${OPTARG}
            ;;
        l)
            LIST_DEVICES=true
            ;;
    esac
done

SIGNALING_URL="ws://sora2.uclab.jp:5000/signaling"

# 无论是不是只列设备，脚本一开始都先打印一次当前摄像头设备列表
echo "=== Available devices ==="
./sumomo --list-devices
echo "=========================="
echo ""

# 只想看看有哪些摄像头时，加 -l 到这里就退出，不继续连接
if [ "$LIST_DEVICES" = true ]; then
    exit 0
fi

echo "set resolution: $RESOLUTION"
echo "set bitrate: $BITRATE"
echo "set channel: $CHANNEL"
echo "set signaling URL: $SIGNALING_URL"
if [ -n "$VIDEO_DEVICE" ]; then
    echo "set video device: $VIDEO_DEVICE"
fi

if [ -n "$VIDEO_DEVICE" ]; then
    ./sumomo \
        --resolution "$RESOLUTION" \
        --video-bit-rate "$BITRATE" \
        --signaling-url "$SIGNALING_URL" \
        --channel-id "$CHANNEL" \
        --video-device "$VIDEO_DEVICE" \
        --role sendonly \
        --audio false \
        --log-level error
else
    ./sumomo \
        --resolution "$RESOLUTION" \
        --video-bit-rate "$BITRATE" \
        --signaling-url "$SIGNALING_URL" \
        --channel-id "$CHANNEL" \
        --role sendonly \
        --audio false \
        --log-level error
fi