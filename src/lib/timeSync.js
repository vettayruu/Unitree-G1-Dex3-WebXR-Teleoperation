const TIME_SYNC_ROUNDS = 10;         
const TIME_SYNC_INTERVAL_MS = 100;   
const TIME_SYNC_TIMEOUT_MS = 1000;   
const TIME_SYNC_KEEP_RATIO = 0.5;    
const TIME_SYNC_MAX_RETRIES_PER_ROUND = 3; 

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function syncTimeOnce(socket, timeoutMs) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    socket
      .timeout(timeoutMs)
      .emit("sync_time_ping", { client_t0: t0 }, (err, data) => {
        if (err) {
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

async function performTimeSync(socket) {
  const samples = [];

  for (let round = 1; round <= TIME_SYNC_ROUNDS; round++) {
    let sample = null;
    for (let attempt = 1; attempt <= TIME_SYNC_MAX_RETRIES_PER_ROUND; attempt++) {
      try {
        sample = await syncTimeOnce(socket, TIME_SYNC_TIMEOUT_MS);
        break;
      } catch (e) {
        console.warn(`⚠️ [ ${round}/${TIME_SYNC_ROUNDS} Round] Attempt ${attempt} Timeout ...`);
      }
    }

    if (!sample) {
      console.warn(`❌ [ ${round}/${TIME_SYNC_ROUNDS} Round] Multiple retries failed, skipping this round`);
      continue;
    }

    samples.push(sample);
    // console.log(
    //   `⏱️ [Round ${round}/${TIME_SYNC_ROUNDS}] RTT=${sample.rtt}ms, ` +
    //   `RTT/2≈${(sample.rtt / 2).toFixed(1)}ms, Offset=${sample.offset.toFixed(1)}ms`
    // );

    if (round < TIME_SYNC_ROUNDS) {
      await sleep(TIME_SYNC_INTERVAL_MS);
    }
  }

  if (samples.length === 0) {
    console.error("❌ [TIME SYNC FAILED!] ");
    return null;
  }

  const sorted = [...samples].sort((a, b) => a.rtt - b.rtt);
  const keepN = Math.max(1, Math.floor(sorted.length * TIME_SYNC_KEEP_RATIO));
  const best = sorted.slice(0, keepN);

  const avgOffset = best.reduce((sum, s) => sum + s.offset, 0) / best.length;
  const avgRtt = best.reduce((sum, s) => sum + s.rtt, 0) / best.length;

  console.log(
    `✅ [TIME SYNC FINALIZED] Total ${samples.length} rounds\n` +
    `Mean RTT/2: ${(avgRtt / 2).toFixed(1)}ms, Device Time Offset: ${avgOffset.toFixed(1)}ms ` +
    `(RTT Range: ${best[0].rtt}ms ~ ${best[best.length - 1].rtt}ms)`
  );

  return avgOffset;
}

export { performTimeSync };