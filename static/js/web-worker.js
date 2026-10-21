let timerId = null;
self.onmessage = function (event) {
  if (event.data === "start") {
    if (!timerId) {
      timerId = setInterval(() => {
        self.postMessage("tick");
      }, 1000);
    }
  } else if (event.data === "stop") {
    clearInterval(timerId);
    timerId = null;
  }
};
