function processSmallMonuments(features){
    let processed = [];
    for(f of features){
        if(isPolygon(f))
            processed.push(addBuffer(f, 0.01));
        else
            processed.push(addBuffer(f, 1));
    }
    return processed;
}

function processBuildings(features, removeInnerRings=true){
    let processed = [];
    for(f of features){
        if(removeInnerRings && f.geometry.type == "Polygon"){
            let outerRing = f.geometry.coordinates[0];
            f.geometry.coordinates = [outerRing];
        }
        //Small buffer to avoid intersection errors
        processed.push(addBuffer(f,0.01));
    }
    return processed;
}

function processBenches(features){
    let processed = [];
    for(f of features){
        processed.push(turf.buffer(f, 0.5, {units: "meters", steps: 4}));
    }
    return processed;
}

function processTrees(features){
    let processed = [];
    for(f of features){
        processed.push(addBuffer(f, 0.5));
    }
    return processed;
}

function processBarriers(features){
    let processed = [];
    for(f of features){
        processed.push(addBuffer(f, 0.4));
    }
    return processed;
}

function processWater(filteredFeatures, bounds){
    bridges = addBufferMany(filteredFeatures.bridges, 0.01);
    waterBodies = addBufferMany(filteredFeatures.waterBodies, 0.05);
    processed = [];
    for (let water of waterBodies){
        processed.push(differenceMany(water, bridges));
    }

    //unmappedWater = processUnmappeddWater(filteredFeatures, bounds);
    //processed = processed.concat(unmappedWater);
    return processed;
}

function processRoads(roads, laneWidth, diagonalWidth, parallelWidth){
    let processed = [];
    for(let road of roads){
        let numLanes = parseInt(road.properties["lanes"] ? road.properties["lanes"] : 1);
        let numBusLanes = parseInt(road.properties["lanes:bus"] ? road.properties["lanes:bus"]: 0);
        let estWidth = (numLanes + numBusLanes) * laneWidth;

        // PARKING
        if (road.properties["parking:lane:left"] )
            if ( road.properties["parking:lane:left"] == "parallel")
                estWidth += parallelWidth;
            else
                estWidth += diagonalWidth;

        if (road.properties["parking:lane:right"])
            if (road.properties["parking:lane:right"] == "parallel")
                estWidth += parallelWidth;
            else
                estWidth += diagonalWidth;
        
        if (road.properties["parking:lane:both"])
            if (road.properties["parking:lane:both"] == "parallel")
                estWidth += parallelWidth * 2;
            else
                estWidth += diagonalWidth * 2;       

        road.properties["estWidth"] = estWidth;
        processed.push(turf.buffer(road, estWidth / 2, {units: "meters"}));
        
    }
    return processed;
}


/*function processUnrepresentedWater(filteredFeatures, bounds){
    const land = filteredFeatures.land;
    const buildings = filteredFeatures.buildings;
    const roads = filteredFeatures.roads;
    const boundaries = filteredFeatures.boundaries;

    const isNotLand = land.length == 0 && buildings.length==0 && roads.length==0;

    if(boundaries.length == 0){
        if(isNotLand){
            return addBuffer(turf.centroid(bounds), 0.01);
        }
    }else{
        if(!turf.booleanWithin(bounds, boundaries[0])){
            let unmappedWater = turf.difference(bounds, boundaries[0]);
            let isWater = true;
            for (let l of land){
                if(turf.booleanIntersects(unmappedWater, l)){
                    isWater = false;
                    break;
                }
            }
            if(isWater){
                waterWithBridges.push(unmappedWater);
            }
            
        }
    }
    return water;
}*/