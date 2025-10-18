
function walkableArea(features, bounds, options={}, workerId, progressCallback, 
    progress={processedPolygons:0, totalPolygons:0}){
	//try{
	
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
    let land = filteredFeatures.land;
    
    let bridges = filteredFeatures.bridges;
    let boundaries = filteredFeatures.boundaries;
    
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

    /*console.log("Monuments:");
    console.log(smallMonuments);
    console.log("Urban furniture:");
    console.log(benches);
    console.log("Grass:");
    console.log(waterBodies);*/

    let waterWithBridges = [];

    if(boundaries.length == 0){
        if(land.length == 0){
            return addBuffer(turf.centroid(bounds), 0.01);
        }
    }else{
        if(!turf.booleanWithin(bounds, boundaries[0])){
            let unmappedWater = turf.difference(bounds, boundaries[0]);
            waterWithBridges.push(unmappedWater);
        }
    }

    /*if(boundaries.length != 0){
        if(!turf.booleanWithin(bounds, boundaries[0])){
            let unmappedWater = turf.difference(bounds, boundaries[0]);
            waterWithBridges.push(unmappedWater);
        }
    }else{
        return addBuffer(turf.centroid(bounds), 0.01);
    }*/

    for (let water of waterBodies){
        waterWithBridges.push(differenceMany(water, bridges));
    }

    let unwalkablePolygons = buildings.concat(waterWithBridges, 
        roads, railways, restrictedAreas, benches, trees, smallMonuments, barriers);
    
    if(UNWALKABLE_GRASS){
        unwalkablePolygons = unwalkablePolygons.concat(grass);
    }

    if(options.customFeatures){
        console.log("Custom geometries:");
        console.log(options.customFeatures.features);
        unwalkablePolygons = unwalkablePolygons.concat(options.customFeatures.features)
    }

    /*if(progress.totalPolygons == 0){
        progress.totalPolygons = unwalkablePolygons.length;
    }*/
        
    let walkableAreaPolygon = bounds;

    for(let f of unwalkablePolygons){
        try{
            let diff = turf.difference(walkableAreaPolygon, f); 
            if(diff === null)
                diff = addBuffer(turf.centroid(bounds), 0.01);
            walkableAreaPolygon = diff;

        }catch(error){
            console.log("Error with feature:");
            console.log(f);
			console.log(error);
        }
        progress.processedPolygons ++;
        let processedPolygons = progress.processedPolygons;
        let totalPolygons = progress.totalPolygons;

        /*if(processedPolygons % 10 == 0) {
            if(workerId !== undefined && workerId !== null) {
                postMessage({progress: true, processedPolygons, totalPolygons, workerId});
            } else {
                progressCallback(processedPolygons / totalPolygons * 100);
            }
        }*/
    }

    return walkableAreaPolygon;
	//}catch(error){
	//	console.log(error);
	//}
}

function walkableAreaWithSubAreas(features, bounds, options, workerId){
    bounds_area = turf.area(bounds);
    numDivisions = Math.ceil(bounds_area/100000);
    numDivisions = numDivisions >= 1 ? numDivisions : 1 
    //console.log("Num divisions: " + numDivisions);
    let subAreas = divideArea(bounds, numDivisions, horizontal=false);
    let subAreaFeatures = [];
    let totalPolygons = 0;

    let unwalkablePolygons = [];
    
    for(let subArea of subAreas){
        let subFeatures = [];
        for(let feature of features){
            if(turf.booleanIntersects(feature, subArea)){
                subFeatures.push(feature);
            }
        }
        subAreaFeatures.push(subFeatures);
        //totalPolygons += subFeatures.length;
    }
    progress = {"totalPolygons":totalPolygons,"processedPolygons": 0};
    for(let i = 0; i < subAreas.length; i++){
        unwalkablePolygons.push(walkableArea(subAreaFeatures[i], subAreas[i], options, workerId, null, progress));
        if(workerId !== undefined && workerId !== null) {
            postMessage({progress: true, processedPolygons:i+1, totalPolygons:subAreas.length, workerId});
        } 
    }

    results = [];
    try{
        results = unionArray(unwalkablePolygons);
    }catch(e){
        unwalkablePolygons = addBufferMany(unwalkablePolygons, 0.01);
        try{
            results = unionArray(unwalkablePolygons);
        }catch(e1){
            alert("There are geometry issues with the unions involved in this . Try another time");
            console.log(e);
        }
    }
    return results;
}


