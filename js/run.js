function run(numThreads, progressElementID, features, bounds, options){
  
    let progress = 0;   
    if (typeof(Worker) !== "undefined") {
        console.log("This browser accepts workers");
        let startTimestamp = Date.now();
        
        let bbox = turf.bbox(bounds);
        let minX = bbox[0];
        let minY = bbox[1];
        let maxX = bbox[2];
        let maxY = bbox[3];
        
        let deltaX = (maxX - minX) / numThreads;
        let subAreas = [];
        
        let maxAreaID = -1;
        let maxAreaSize = 0;
        for(let i = 0; i < numThreads; i++){
            let points = [[
                [minX + (i*deltaX), maxY],
                [minX + ((i+1)*deltaX), maxY],
                [minX + ((i+1)*deltaX), minY],
                [minX + (i*deltaX), minY],
                [minX + (i*deltaX), maxY]
            ]];
            let subArea = addBuffer(turf.polygon(points), 0.001);
            subAreas.push(turf.intersect(subArea, bounds));
            if(subAreas.length > maxAreaSize){
                maxAreaSize = subAreas.length;
                maxAreaID = i;
            }
        }

        let promises = [];
        let workerID = 0;
        for(let area of subAreas){
            let subFeatures = [];
            for(let feature of features){
                if(turf.booleanIntersects(feature, area)){
                    subFeatures.push(feature);
                }
            }

            promises.push(new Promise(function(resolve) {
                let worker = new Worker("worker.js");
                let id = workerID;
                worker.postMessage({
                    features: subFeatures,
                    bounds: area,
                    options: options,
                    largestArea: workerID == maxAreaID,
                    numWorkers: numThreads
                });
                worker.onmessage = function (event) {
                    if(!isNaN(event.data)){ 
                        progress += event.data;
                        showProgress(progress, progressElementID);  
                    }else{
                        console.log("Worker "+ id+":");
                        console.log(event.data);
                        resolve(event.data); 
                    }
                };
            }));
            workerID++;
        }

        Promise.all(promises).then((values) => {
            let time = (Date.now() - startTimestamp)/1000;
            showProgress(100, progressElementID);
            let result;
            try{
                result = unionArray(values);
            }catch(error){
                console.log("Geo errors... applying buffers")
                console.log(values);
                let buffered = values.map(value => addBuffer(value, -0.05));
                result = unionArray(buffered);
            }
            console.log("Elapsed time: " + time);
            console.log(result);
            return result;
        })


    } else {
        console.log("This browser does not support workers");
        return walkableAreaWithSubAreas(features, bounds, options);
    }
    
}

function showProgress(progress, progressElementID){
    let progressElement = document.getElementById(progressElementID);
    progressElement.innerHTML = Math.floor(progress) + "%";

    /*if(heaviestThreadProgress){
        let total = heaviestThreadProgress.totalPolygons;
        let processed = heaviestThreadProgress.processedPolygons;
        let time = heaviestThreadProgress.elapsedTime;

        let estimatedTime = Math.floor(((total/processed) - 1 ) * time);
        progressElement.innerHTML = (estimatedTime / 1000) + " seconds";
    }*/

    /*let maxEstimatedTime = -1;
    for(progress of workerProgresses){
        if(progress){
            let total = progress.totalPolygons;
            let processed = progress.processedPolygons;
            let time = progress.elapsedTime;
            console.log(total + " " + processed + " " + time);
            let estimatedTime = (total/processed) * time;
            console.log(estimatedTime);
            if(estimatedTime > maxEstimatedTime){
                maxEstimatedTime = estimatedTime;
            }
        }
    }
    progressElement.innerHTML = (maxEstimatedTime / 1000) + " seconds";
    */
}
