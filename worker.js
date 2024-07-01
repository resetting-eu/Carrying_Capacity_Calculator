importScripts("turf.js", "cc.js");
onmessage = function (event) {
    console.log('Started worker');
  
    // Perform computation
    let result = walkableArea(event.data.features,
       event.data.bounds, event.data.options, event.data.workerId);
  
    // Send result back to the main thread
    postMessage(result);
};


