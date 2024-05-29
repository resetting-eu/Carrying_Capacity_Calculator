
function calculateCarryingCapacity(features, bounds, options, workerId, progressCallback){
    let LANE_WIDTH = 3;
    let RAIL_WIDTH = 3;
    let PARALLEL_PARKING_WIDTH = 2;
    let DIAGONAL_PARKING_WIDTH = 5;
    let FLATTEN_MULTIPOLYGONS_BUILDING = false;

    if(options.laneWidth)
        LANE_WIDTH = options.laneWidth;
    if(options.railWidth)
        RAIL_WIDTH = options.railWidth;
    if(options.parallelWidth)
        PARALLEL_PARKING_WIDTH = options.parallelWidth;
    if(options.diagonalWidth)
        DIAGONAL_PARKING_WIDTH = options.diagonalWidth;

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

    buildings = addBufferMany(buildings, 0.05); 
    railways = addBufferMany(railways, RAIL_WIDTH / 2);
    bridges = addBufferMany(bridges, 1);
    waterBodies = addBufferMany(waterBodies, 0.5);

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
            const diff = turf.difference(walkableAreaPolygon, f);
            if(diff) {
                walkableAreaPolygon = diff;
            } else {
                console.log("skiping feature:");
                console.log(f);
            }
        }catch(error){
            console.log("Error with feature:");
            console.log(f);
        }
        processedPolygons ++;
        if(processedPolygons % 10 == 0) {
            if(workerId !== undefined && workerId !== null) {
                postMessage({progress: true, processedPolygons, totalPolygons, workerId});
            } else {
                progressCallback(processedPolygons / totalPolygons * 100);
            }
        }
    }

    // let walkableAreaPolygon = differenceMany(bounds, unwalkablePolygons);

    return walkableAreaPolygon;
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
    feature.properties.foot != "designated" &&
    !feature.properties.footway &&
    feature.properties.highway != "footway" &&
    feature.properties.highway != "steps" &&
    feature.properties.highway != "cycleway" && // Debatable...
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
    return (feature.properties.natural == "water" ||
	feature.properties.place == "sea" ||
	feature.properties.natural == "bay" ||
	feature.properties.natural == "strait") && 
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

// TODO
function flattenFeatures(features){
    let flattened = [];
    for(let feature in features){
        flattened.push(turf.flatten(feature));
    }
    return flattened;
}
