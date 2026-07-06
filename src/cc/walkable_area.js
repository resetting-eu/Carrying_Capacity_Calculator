// Calculate walkable area from unwalkable features
function walkableArea(features, bounds, options={}){

    let LANE_WIDTH = 3;
    let RAIL_WIDTH = 3;
    let PARALLEL_PARKING_WIDTH = 1.8;
    let DIAGONAL_PARKING_WIDTH = 5;
    let REMOVE_BUILDING_INNER_RINGS = true;
    let WALKABLE_ROADS = false;
    let UNWALKABLE_GRASS = false;
    let WALKABLE_PARKING_AREAS = false;
    let WALKABLE_CITY_BLOCKS = false;
    let WALKABLE_PRIVATE_AREAS = false;
    let CALCULATE_UNWALKABLE_AREA = false;

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
    if(options.walkableParkingAreas)
        WALKABLE_PARKING_AREAS = options.walkableParkingAreas;
    if(options.walkablePrivateAreas)
        WALKABLE_PRIVATE_AREAS = options.walkablePrivateAreas;
    if(options.walkableCityBlocks)  
        WALKABLE_CITY_BLOCKS = options.walkableCityBlocks;
    if(options.calculateUnwalkableArea)
        CALCULATE_UNWALKABLE_AREA = options.calculateUnwalkableArea;

    // Filter features
    let filteredFeatures = filterFeatures(features, bounds);

    let roads = filteredFeatures.roads;
    let railways = filteredFeatures.railways;

    let buildings = filteredFeatures.buildings;
    let waterBodies = filteredFeatures.waterBodies;
    let grass = filteredFeatures.grass;
    let benches = filteredFeatures.benches;
    let trees = filteredFeatures.trees;
    let smallMonuments = filteredFeatures.smallMonuments;
    let barriers = filteredFeatures.barriers;
    let land = filteredFeatures.land;
    let coastlines = filteredFeatures.coastlines;
    let boundaries = filteredFeatures.boundaries;

    let parkingAreas = filteredFeatures.parkingAreas;
    let flowerbeds = filteredFeatures.flowerbeds;
    let privateAreas = filteredFeatures.privateAreas;
    let cityBlocks = filteredFeatures.cityBlocks;
    
    if(WALKABLE_ROADS){
        roads = []; 
    }else{
        roads = processRoads(roads, LANE_WIDTH, DIAGONAL_PARKING_WIDTH, PARALLEL_PARKING_WIDTH);
    }

    buildings = processBuildings(buildings, REMOVE_BUILDING_INNER_RINGS);
         
    railways = addBufferMany(railways, RAIL_WIDTH / 2);
    waterBodies = processWater(filteredFeatures, bounds);
    benches = processBenches(benches);
    trees = processTrees(trees);
    smallMonuments = processSmallMonuments(smallMonuments);
    barriers = processBarriers(barriers);
    parkingAreas = addBufferMany(parkingAreas, 0.05);

    /*console.log("Monuments:");
    console.log(smallMonuments);
    console.log("Urban furniture:");
    console.log(benches);
    console.log("Grass:");
    console.log(waterBodies);
    console.log("Coastlines:");
    console.log(coastlines);
    console.log("Land:");
    console.log(land);*/

    const isNotLand = land.length == 0 && buildings.length==0 && roads.length==0;

    if(boundaries.length == 0){
        if(isNotLand){
            return addBuffer(turf.centroid(bounds), 0.01);
        }
    }
    else if(coastlines.length > 0 ){
        let unmappedWater = turf.difference(bounds, boundaries[0]);
        waterBodies.push(unmappedWater);
    }

    let unwalkablePolygons = buildings.concat(waterBodies, 
        roads, railways, benches, trees, smallMonuments, barriers, flowerbeds);
    
    if(UNWALKABLE_GRASS)
        unwalkablePolygons = unwalkablePolygons.concat(grass);

    if(!WALKABLE_PARKING_AREAS)
        unwalkablePolygons = unwalkablePolygons.concat(parkingAreas);

    if(!WALKABLE_PRIVATE_AREAS)
        unwalkablePolygons = unwalkablePolygons.concat(privateAreas);

    if(!WALKABLE_CITY_BLOCKS)  
        unwalkablePolygons = unwalkablePolygons.concat(cityBlocks);

    if(options.customFeatures){
        unwalkablePolygons = unwalkablePolygons.concat(options.customFeatures.features)
        //console.log("Custom geometries:");
        //console.log(options.customFeatures.features);
    }
        
    let walkableAreaPolygon = truncateGeoJSON(bounds, 7);

    if(CALCULATE_UNWALKABLE_AREA){
        //console.log("Calculating unwalkable area...");
        let boundedUnwalkablePolygons = [];
        for(const f of unwalkablePolygons){
            try{
                let intersection = turf.intersect(f, bounds);
                if(intersection){
                    boundedUnwalkablePolygons.push(intersection);
                }       
            }catch(error){
                if (f && f.properties){
                    console.log("Error with feature: " + f.properties); 
                    console.log(f);
                    console.log(error);
                }       
            }
        }
        let unwalkableAreaPolygon = unionArray(boundedUnwalkablePolygons);
        return truncateGeoJSON(unwalkableAreaPolygon, 7);
    }

    for(const f of unwalkablePolygons){
        try{
            let diff = turf.difference(walkableAreaPolygon, f); 
            if(diff === null){
                diff = addBuffer(turf.centroid(bounds), 0.01);
                if(walkableAreaPolygon.properties){
                    diff.properties = walkableAreaPolygon.properties;
                }
                return diff;
            }
            walkableAreaPolygon = diff;

        }catch(error){
            if (f && f.properties){
                console.log("Error with feature: " + f.properties);
                console.log(f);
			    console.log(error);
            }
                
        }
        
    }

    return truncateGeoJSON(walkableAreaPolygon);
}

// Calculate walkable area from walkable features
function walkablePathsArea(features, bounds, options={}){
    const ROAD_WIDTH = 5.5;
    const PATH_WIDTH = 3;
    //const STAIRS_WIDTH = 2

    let filteredFeatures = filterFeatures(features, bounds, only_surface=false);

    let roads = [];
    let buildings = [];

    if(options.walkableRoads){
        roads = processRoads(filteredFeatures.roads, ROAD_WIDTH, 0, 0);
    }

    if(options.walkableBuildings){
        buildings = processBuildings(filteredFeatures.buildings);
    }

    let walkablePaths = addBufferMany(filteredFeatures.walkablePaths, PATH_WIDTH / 2);
    let walkableAreas = filteredFeatures.walkableAreas.concat(walkablePaths, roads, buildings);
    return turf.intersect(unionArray(walkableAreas), bounds);
    
}


function walkableAreaWithSubAreas(features, bounds, options, workerId){
    bounds_area = turf.area(bounds);
    numDivisions = Math.ceil(bounds_area/100000);
    numDivisions = numDivisions >= 1 ? numDivisions : 1 
    console.log("Number of area divisions: " + numDivisions);
    let subAreas = divideArea(bounds, numDivisions, horizontal=false);
    let subAreaFeatures = [];
    let totalPolygons = 0;

    let walkablePolygons = [];
    
    for(let subArea of subAreas){
        let subFeatures = [];
        for(let feature of features){
            if(subArea && turf.booleanIntersects(feature, subArea)){
                subFeatures.push(feature);
            }
        }
        subAreaFeatures.push(subFeatures);
        //totalPolygons += subFeatures.length;
    }
    //progress = {"totalPolygons":totalPolygons,"processedPolygons": 0};
    let walkableAreaFunction;
    
    if(options.fromWalkableFeatures){
        walkableAreaFunction = walkablePathsArea;
    }else{
        walkableAreaFunction = walkableArea;
    }

    for(let i = 0; i < subAreas.length; i++){
        walkablePolygons.push(walkableAreaFunction(subAreaFeatures[i], subAreas[i], options));
        if(workerId !== undefined && workerId !== null) {
            postMessage({progress: true, processedPolygons:i+1, totalPolygons:subAreas.length, workerId});
        } 
    }

    results = [];
    try{
        results = unionArray(walkablePolygons);
    }catch(e){
        console.log("Error on union... trying again");
        console.log(e);
        walkablePolygons = addBufferMany(walkablePolygons, 0.1);
        try{
            results = unionArray(walkablePolygons);
        }catch(e1){
            console.log(e1);
        }
    }
    return results;
}
