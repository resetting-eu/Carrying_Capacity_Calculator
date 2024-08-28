
function walkableArea(features, bounds, options){
    let LANE_WIDTH = 3;
    let RAIL_WIDTH = 3;
    let PARALLEL_PARKING_WIDTH = 2;
    let DIAGONAL_PARKING_WIDTH = 5;
    let FLATTEN_BUILDINGS = false;

    if(options.laneWidth)
        LANE_WIDTH = options.laneWidth;
    if(options.railWidth)
        RAIL_WIDTH = options.railWidth;
    if(options.parallelWidth)
        PARALLEL_PARKING_WIDTH = options.parallelWidth;
    if(options.diagonalWidth)
        DIAGONAL_PARKING_WIDTH = options.diagonalWidth;
    if(options.flattenBuildings)
        FLATTEN_BUILDINGS = true;

    // Filter features
    let roads = [];
    let railways = [];
    let buildings = [];
    let waterBodies = [];
    let bridges = [];
    for (let feature of features) {
        if(isBuilding(feature))
            buildings.push(feature);
        else if(isWater(feature))
            waterBodies.push(feature);
        else if(isRoad(feature))
            roads.push(feature);
        else if(isRailway(feature))
            roads.push(feature);
        else if(isBridge(feature))
            bridges.push(feature);
    }
    
    roads = processRoads(roads, LANE_WIDTH, DIAGONAL_PARKING_WIDTH, PARALLEL_PARKING_WIDTH);

    buildings = addBufferMany(buildings, 0.01); 
    if (FLATTEN_BUILDINGS)
        buildings = flattenFeatures(buildings);
    
    railways = addBufferMany(railways, RAIL_WIDTH / 2);
    bridges = addBufferMany(bridges, 0.01);
    waterBodies = addBufferMany(waterBodies, 0.05);

    //console.log("Data processed");

    let waterWithBridges = [];
    for (let water of waterBodies){
        waterWithBridges.push(differenceMany(water, bridges));
    }

    let lowLevelUnwalkablePolygons = buildings.concat(waterWithBridges);
    let highLevelUnwalkablePolygons = roads.concat(railways);
    let unwalkablePolygons = lowLevelUnwalkablePolygons.concat(highLevelUnwalkablePolygons);

    let processedPolygons = 0;
    let totalPolygons = unwalkablePolygons.length;
    let walkableAreaPolygon = bounds;
    for(let f of unwalkablePolygons){
        try{
            walkableAreaPolygon = turf.difference(walkableAreaPolygon, f);   
        }catch(error){
            console.log("Error with feature:");
            console.log(f);
        }
        processedPolygons ++;
        if(options.progress){
            /*options.progress.processedPolygons = processedPolygons;
            options.progress.totalPolygons = totalPolygons;
            options.progress.elapsedTime = Date.now() - options.progress.startTime;*/
            let numWorkers = options.progress.numWorkers;
            let numSubAreas = options.progress.numSubAreas;
            if(options.progress.worker && processedPolygons % 10 == 0){
                let progress = ((processedPolygons / totalPolygons) * 100) / (numWorkers * numSubAreas);
                if(!isNaN(progress)){
                    postMessage(progress); 
                    processedPolygons = 0;
                }
            }
                
        }
    }
    if(options.progress){
        let numWorkers = options.progress.numWorkers;
        let numSubAreas = options.progress.numSubAreas;
        if(options.progress.worker){
            let progress = ((processedPolygons / totalPolygons) * 100) / (numWorkers * numSubAreas);
            if(!isNaN(progress)){
                postMessage(progress); 
            }
            
        }        
    } 

    return walkableAreaPolygon;
}

function walkableAreaWithSubAreas(features, bounds, options){
    let subAreas = divideArea(bounds, 8, horizontal=false);
    let unwalkablePolygons = [];
    for(let subArea of subAreas){
        let subFeatures = [];
        for(let feature of features){
            if(turf.booleanIntersects(feature, subArea)){
                subFeatures.push(feature);
            }
        }
        unwalkablePolygons.push(walkableArea(subFeatures, subArea, options));
    }
    console.log(unwalkablePolygons);
    return unionArray(unwalkablePolygons);
}

// Buffer functions

function addBuffer(feature, value){
    return turf.buffer(feature, value, {units: 'meters'});
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

function isRoad(feature){   
    return feature.properties.highway &&
    feature.properties.highway != "pedestrian" &&
    feature.properties.highway != "footway" &&
    feature.properties.highway != "steps" &&
    feature.properties.highway != "cicleway" && // Debatable...
    feature.properties.highway != "path" &&
    //feature.properties.highway != "living_street" &&
    parseInt(feature.properties.layer) != -1 &&
    isLine(feature);
}

function isRailway(feature){   
    return feature.properties.railway && 
    feature.properties.railway != "razed" && 
	parseInt(feature.properties.layer) != -1 &&
    isLine(feature);
}

function isBuilding(feature){   
    return feature.properties.building &&
    parseInt(feature.properties.layer) != -1 &&
    isPolygon(feature);
}

function isWater(feature){
    return feature.properties.natural == "water" && 
    isPolygon(feature); 
}

function isBridge(feature){
    return feature.properties.man_made == "bridge" && 
    isPolygon(feature);
}

// Geometry type filters
function isLine(feature){
    return feature.geometry.type == "LineString";
}

function isPolygon(feature){
    return feature.geometry.type.includes("Polygon");
}

// Preprocess roads 
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

function flattenFeatures(features){
    let flattened = [];
    for(let feature in features){
        flattened.push(turf.flatten(feature));
    }
    return flattened;
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

