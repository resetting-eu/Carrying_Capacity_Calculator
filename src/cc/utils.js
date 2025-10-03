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
function differenceMany(feature, features){
    let diff = feature;
    for(let f of features){
        diff = turf.difference(diff, f);
    } 
    return diff;
}

function unionMany(feature, features){
    let union = feature;
    for(let f of features){
        union = turf.union(union, f);
    }
    return union;
}

function unionArray(features){
    let union = features.shift();
    for(let f of features){
        union = turf.union(union, f);
    }
    return union;
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
        subAreas.push(turf.intersect(subArea, bounds));
    }

    return subAreas;
}