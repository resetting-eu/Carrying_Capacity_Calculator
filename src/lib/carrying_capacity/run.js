const turf = require('@turf/turf');

function run(numThreads, features, bounds, options, callback){
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
        for(let area of subAreas){
            let subFeatures = [];
            for(let feature of features){
                if(turf.booleanIntersects(feature, area)){
                    subFeatures.push(feature);
                }
            }

            promises.push(new Promise(function(resolve) {
                let worker = new Worker("worker.js");
                worker.postMessage({
                    features: subFeatures,
                    bounds: area,
                    options: options
                });
                worker.onmessage = function (event) {
                    resolve(event.data); 
                };
            }));
        }

        Promise.all(promises).then((values) => {
            let time = (Date.now() - timestamp0)/1000;
            console.log("Elapsed time: " + time);
            console.log(values);
            callback(values);
        })


    } else {
        console.log("This browser does not support workers");
        callback(calculateCarryingCapacity(features, bounds, options));
    }
    
}

module.exports = run;
