"use babel";

export async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export async function waitFor(
  condition,
  timeout = jasmine.DEFAULT_TIMEOUT_INTERVAL,
  interval = 50
) {
  let start = Date.now();
  while (!condition()) {
    await wait(interval);
    if (Date.now() - start > timeout) {
      throw new Error("Timeout waiting for condition");
    }
  }
}
