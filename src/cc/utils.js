// Buffer functions
function addBuffer(feature, value){
    try{
        return turf.buffer(feature, value, {units: 'meters'});
    }catch(error){
        console.log(feature)
        console.log(error)
    }
}

function addBufferMany(features, value){
    let buffered = [];
    for(let feature of features){
        buffered.push(addBuffer(feature, value));
    }
    return buffered;
}

//bulk functions
function difference(feature1, feature2){
    return turf.difference(turf.featureCollection([feature1, feature2]));
}

function differenceMany(feature, features){
    if (features.length == 0)
        return feature;
    return turf.difference(turf.featureCollection([feature, ...features]));
}

function unionMany(feature, features){
    let union = feature;
    for(let f of features){
        union = turf.union(union, f);
    }
    return union;
}

function unionArray(features){
    return turf.union(turf.featureCollection(features));
}

function divideArea(bounds, numAreas, horizontal=true){
	        
    let bbox = turf.bbox(bounds);
    let minX = bbox[0];
    let minY = bbox[1];
    let maxX = bbox[2];
    let maxY = bbox[3];
    
    let deltaX = (maxX - minX) / numAreas;
    let deltaY = (maxY - minY) / numAreas;
    let subAreas = [];
    
    
    for(let i = 0; i < numAreas; i++){
        let points;
        if(horizontal){
            points = [[
                [minX + (i*deltaX), maxY],
                [minX + ((i+1)*deltaX), maxY],
                [minX + ((i+1)*deltaX), minY],
                [minX + (i*deltaX), minY],
                [minX + (i*deltaX), maxY]
            ]];
        }else{
            points = [[
                [minX, maxY - (i*deltaY)],
                [maxX, maxY - (i*deltaY)],
                [maxX, maxY - ((i+1)*deltaY)],
                [minX, maxY - ((i+1)*deltaY)],
                [minX, maxY - (i*deltaY)]
            ]];
        }
        
        let subArea = addBuffer(turf.polygon(points), 0.01);
        subAreas.push(turf.intersect(turf.featureCollection([subArea, bounds])));
    }

    return subAreas;
}