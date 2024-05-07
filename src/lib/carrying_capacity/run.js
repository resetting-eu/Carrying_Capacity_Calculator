const turf = require('@turf/turf');

function unionArray(features){
    let union = features.shift();
    for(let f of features){
        union = turf.union(union, f);
    }
    return union;
}

function run(numThreads, progressElementID, features, bounds, options, callback){
    if (typeof(Worker) !== "undefined") {
        console.log("This browser accepts workers");
        let timestamp0 = Date.now();
        
        let bbox = turf.bbox(bounds);
        let minX = bbox[0];
        let minY = bbox[1];
        let maxX = bbox[2];
        let maxY = bbox[3];
        
        let deltaX = (maxX - minX) / numThreads;
        let subAreas = [];
        for(let i = 0; i < numThreads; i++){
            let points = [[
                [minX + (i*deltaX), maxY],
                [minX + ((i+1)*deltaX), maxY],
                [minX + ((i+1)*deltaX) , minY],
                [minX + (i*deltaX), minY],
                [minX + (i*deltaX), maxY]
            ]];
            subAreas.push(turf.intersect(turf.polygon(points), bounds));
        }

        //console.log(subAreas);

        let promises = [];
        let workerId = 0;
        const workersProgress = {};

        for(let area of subAreas){
            let subFeatures = [];
            for(let feature of features){
                if(turf.booleanIntersects(feature, area)){
                    subFeatures.push(feature);
                }
            }

            promises.push(new Promise(function(resolve) {
                let worker = new Worker("worker.js");
                workersProgress[workerId] = {};
                worker.postMessage({
                    features: subFeatures,
                    bounds: area,
                    options: options,
                    workerId: workerId
                });
                worker.onmessage = function (event) {
                    if(event.data.progress){ 
                        const {processedPolygons, totalPolygons} = event.data;
                        const id = event.data.workerId;
                        workersProgress[id] = {processedPolygons, totalPolygons};
                        let sumProcessed = 0;
                        let sumTotal = 0;
                        for(const key of Object.keys(workersProgress)) {
                            const {processedPolygons, totalPolygons} = workersProgress[key];
                            sumProcessed += processedPolygons;
                            sumTotal += totalPolygons;
                        }
                        const progress = sumProcessed / sumTotal * 100;
                        if(!isNaN(progress)) {
                            showProgress(progress, progressElementID);  
                        }
                    }else{
                        resolve(event.data); 
                    }
                };
            }));

            ++workerId;
        }

        Promise.all(promises).then((values) => {
            let time = (Date.now() - timestamp0)/1000;
            console.log("Elapsed time: " + time);
            console.log(values);
            callback(unionArray(values));
        })


    } else {
        console.log("This browser does not support workers");
        callback(calculateCarryingCapacity(features, bounds, options, null, p => showProgress(p, progressElementID)));
    }
    
}

function showProgress(progress, progressElementID){
    let progressElement = document.getElementById(progressElementID);
    if(progressElement !== null) {
        progressElement.innerHTML = Math.floor(progress) + "%";
    }
}

module.exports = run;
