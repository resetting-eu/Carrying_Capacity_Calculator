importScripts("turf.js", "carryingCapacity.js");
onmessage = function (event) {
    console.log('Started worker');
  
    // Perform computation
    let result = calculateCarryingCapacity(event.data.features,
       event.data.bounds, event.data.options, event.data.workerId);
  
    // Send result back to the main thread
    postMessage(result);
};


