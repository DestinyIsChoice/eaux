export async function acquireWakeLock(wakeLock) {
  if ("wakeLock" in navigator) {

    // noinspection JSUnusedAssignment
    wakeLock = await navigator.wakeLock.request("screen");
  }
}
