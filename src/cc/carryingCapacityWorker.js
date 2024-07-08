
function walkableArea(features, bounds, options={}, workerId, progressCallback){
	try{
	
    let LANE_WIDTH = 3;
    let RAIL_WIDTH = 3;
    let PARALLEL_PARKING_WIDTH = 2;
    let DIAGONAL_PARKING_WIDTH = 5;
    let REMOVE_BUILDING_INNER_RINGS = true;
    let WALKABLE_ROADS = false;
    let UNWALKABLE_GRASS = false;

    if(options.laneWidth)
        LANE_WIDTH = options.laneWidth;
    if(options.railWidth)
        RAIL_WIDTH = options.railWidth;
    if(options.parallelWidth)
        PARALLEL_PARKING_WIDTH = options.parallelWidth;
    if(options.diagonalWidth)
        DIAGONAL_PARKING_WIDTH = options.diagonalWidth;
    if(options.flattenBuildings)
        REMOVE_BUILDING_INNER_RINGS = options.flattenBuildings;
    if(options.walkableRoads)
        WALKABLE_ROADS = options.walkableRoads;
    if(options.unwalkableGrass)
        UNWALKABLE_GRASS = options.unwalkableGrass;

    // Filter features
    let filteredFeatures = filterFeatures(features, bounds);

    let roads = filteredFeatures.roads;
    let railways = filteredFeatures.railways;
    let buildings = filteredFeatures.buildings;
    let waterBodies = filteredFeatures.waterBodies;
    let restrictedAreas = filteredFeatures.restrictedAreas;
    let grass = filteredFeatures.grass;
    let benches = filteredFeatures.benches;
    let trees = filteredFeatures.trees;
    let smallMonuments = filteredFeatures.smallMonuments;
    let barriers = filteredFeatures.barriers;

    let bridges = filteredFeatures.bridges;
    
    if(WALKABLE_ROADS){
        roads = []; 
    }else{
        roads = processRoads(roads, LANE_WIDTH, DIAGONAL_PARKING_WIDTH, PARALLEL_PARKING_WIDTH);
    }


    buildings = processBuildings(buildings, REMOVE_BUILDING_INNER_RINGS);

         
    railways = addBufferMany(railways, RAIL_WIDTH / 2);
    bridges = addBufferMany(bridges, 0.01);
    waterBodies = addBufferMany(waterBodies, 0.05);
    benches = processBenches(benches);
    trees = processTrees(trees);
    smallMonuments = processSmallMonuments(smallMonuments);
    barriers = processBarriers(barriers);

    console.log("Monuments:");
    console.log(smallMonuments);
    console.log("Urban furniture:");
    console.log(benches);
    console.log("Grass:");
    console.log(waterBodies);

    let waterWithBridges = [];
    for (let water of waterBodies){
        waterWithBridges.push(differenceMany(water, bridges));
    }

    /*let lowLevelUnwalkablePolygons = buildings.concat(waterWithBridges, );
    let highLevelUnwalkablePolygons = roads.concat(railways).concat(restrictedAreas);
    let unwalkablePolygons = lowLevelUnwalkablePolygons.concat(highLevelUnwalkablePolygons);*/

    let unwalkablePolygons = buildings.concat(waterWithBridges, 
        roads, railways, restrictedAreas, benches, trees, smallMonuments, barriers);
    
    if(UNWALKABLE_GRASS){
        unwalkablePolygons = unwalkablePolygons.concat(grass);
    }

    let processedPolygons = 0;
    let totalPolygons = unwalkablePolygons.length;
    let walkableAreaPolygon = bounds;
    for(let f of unwalkablePolygons){
        try{
            let diff = turf.difference(walkableAreaPolygon, f); 
            if(diff === null)
                diff = addBuffer(turf.centroid(bounds), 0.1);
            walkableAreaPolygon = diff;

        }catch(error){
            console.log("Error with feature:");
            console.log(f);
			console.log(error);
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

    return walkableAreaPolygon;
	}catch(error){
		console.log(error);
	}
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


