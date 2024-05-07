importScripts("turf.js", "carryingCapacity.js");
self.onmessage = function (event) {
    console.log('Started worker');
    
    if(event.data.largestArea || true){
        let progress = {
            "progress": true, 
            "worker": true, 
            "processedPolygons": 0, 
            "totalPolygons": 0,
            "startTime": Date.now(),
            "elapsedTime": 0,
            "numWorkers": event.data.numWorkers,
            "numSubAreas": 8
        };
        event.data.options.progress = progress;
    }
    
    // Send progress to main thread each second
    /*let intervalID = setInterval(() => {
       self.postMessage(event.data.options.progress);
        console.log("Sent message");
    }, 1000);*/

    //let result = calculateCarryingCapacity(event.data.features,event.data.bounds, event.data.options);
    let result = walkableAreaWithSubAreas(event.data.features, event.data.bounds, event.data.options);

    //clearInterval(intervalID);
  
    // Send result back to the main thread
    postMessage(result);
};


