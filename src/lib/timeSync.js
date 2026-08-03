// ⏱️ 时间同步多轮采样配置
const TIME_SYNC_ROUNDS = 8;          // 采样轮数
const TIME_SYNC_INTERVAL_MS = 150;   // 每轮间隔
const TIME_SYNC_TIMEOUT_MS = 1000;   // 单轮超时（socket.io 内置处理）
const TIME_SYNC_KEEP_RATIO = 0.5;    // 取 RTT 最小的比例样本
const TIME_SYNC_MAX_RETRIES_PER_ROUND = 3; // 单轮最多重试次数

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 发送单轮时间同步请求，用 socket.io 内置的 ack + timeout 机制
 * 自带超时处理，不需要手动记录 pendingT0 或额外的事件监听
 */
function syncTimeOnce(socket, timeoutMs) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    socket
      .timeout(timeoutMs)
      .emit("sync_time_ping", { client_t0: t0 }, (err, data) => {
        if (err) {
          // 超时或者对端未 ack，socket.io 会自动把这个当成 err 传回来
          reject(err);
          return;
        }
        const t1 = Date.now();
        const rtt = t1 - t0;
        const networkDelay = rtt / 2;
        const offset = data.server_time + networkDelay - t1;
        resolve({ offset, rtt });
      });
  });
}

/**
 * 执行完整的多轮时间同步，返回最终 offset
 */
async function performTimeSync(socket) {
  const samples = [];

  for (let round = 1; round <= TIME_SYNC_ROUNDS; round++) {
    let sample = null;
    for (let attempt = 1; attempt <= TIME_SYNC_MAX_RETRIES_PER_ROUND; attempt++) {
      try {
        sample = await syncTimeOnce(socket, TIME_SYNC_TIMEOUT_MS);
        break;
      } catch (e) {
        console.warn(`⚠️ [第 ${round}/${TIME_SYNC_ROUNDS} 轮] 第 ${attempt} 次尝试超时，重试...`);
      }
    }

    if (!sample) {
      console.warn(`❌ [第 ${round}/${TIME_SYNC_ROUNDS} 轮] 多次重试后仍失败，跳过该轮`);
      continue;
    }

    samples.push(sample);
    console.log(
      `⏱️ [第 ${round}/${TIME_SYNC_ROUNDS} 轮] RTT=${sample.rtt}ms, ` +
      `单程延时≈${(sample.rtt / 2).toFixed(1)}ms, Offset=${sample.offset.toFixed(1)}ms`
    );

    if (round < TIME_SYNC_ROUNDS) {
      await sleep(TIME_SYNC_INTERVAL_MS);
    }
  }

  if (samples.length === 0) {
    console.error("❌ [TIME SYNC FAILED] 所有轮次均失败，无法完成时间同步");
    return null;
  }

  // 按 RTT 升序排序，只保留 RTT 最小的一部分样本
  const sorted = [...samples].sort((a, b) => a.rtt - b.rtt);
  const keepN = Math.max(1, Math.floor(sorted.length * TIME_SYNC_KEEP_RATIO));
  const best = sorted.slice(0, keepN);

  const avgOffset = best.reduce((sum, s) => sum + s.offset, 0) / best.length;
  const avgRtt = best.reduce((sum, s) => sum + s.rtt, 0) / best.length;

  console.log(
    `✅ [TIME SYNC FINALIZED] 共采样 ${samples.length} 轮，取 RTT 最小的 ${keepN} 轮取均值\n` +
    `   平均单程延时: ${(avgRtt / 2).toFixed(1)}ms, 最终 Offset: ${avgOffset.toFixed(1)}ms ` +
    `(RTT 范围: ${best[0].rtt}ms ~ ${best[best.length - 1].rtt}ms)`
  );

  return avgOffset;
}

export { performTimeSync };