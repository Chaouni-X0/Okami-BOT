import PQueue from 'p-queue';

let consecutiveFailures = 0;
const FAILURE_THRESHOLD = 3;
let isPaused = false;

export const messageQueue = new PQueue({
  concurrency: 2,
  intervalCap: 10,
  interval: 1000
});

export function registerSuccess() {
  consecutiveFailures = 0;
}

export function registerFailure() {
  consecutiveFailures++;
  console.warn(`[Okami Queue] Consecutive failures: ${consecutiveFailures}/${FAILURE_THRESHOLD}`);

  if (consecutiveFailures >= FAILURE_THRESHOLD && !isPaused) {
    isPaused = true;
    console.error(`[Okami Queue] CRITICAL: ${consecutiveFailures} consecutive failures detected! Pausing message queue for a 10-second cooldown recovery period...`);
    
    messageQueue.pause();

    setTimeout(() => {
      console.log('[Okami Queue] Cooldown period complete. Resuming queue and resetting failure counters...');
      isPaused = false;
      consecutiveFailures = 0;
      messageQueue.start();
    }, 10000);
  }
}