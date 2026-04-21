function filterFeatures(features, bounds, only_surface=true){
    let filteredFeatures = {
        roads: [],
        railways: [],
        buildings: [],
        waterBodies: [],
        benches: [],
        trees: [],
        smallMonuments: [],
        grass: [],
        bridges: [],
        barriers:[],
        boundaries:[],
        land:[],
        coastlines:[],

        parkingAreas: [],
        cityBlocks:[],
        plots:[],
        flowerbeds:[],
        privateAreas: [],

        walkableAreas: [],
        walkablePaths: []
    };

    for (const feature of features) {
        if(only_surface && !isGroundLevel(feature))
            continue;

        if(isBuilding(feature))
            filteredFeatures.buildings.push(feature);
        if(isWater(feature))
            filteredFeatures.waterBodies.push(feature);
        if(isRoad(feature))
            filteredFeatures.roads.push(feature);
        if(isParkingArea(feature))
            filteredFeatures.parkingAreas.push(feature);
        if(isRailway(feature))
            filteredFeatures.railways.push(feature);
        if(isBridge(feature))
            filteredFeatures.bridges.push(feature);
        if(isPrivateArea(feature))
            filteredFeatures.privateAreas.push(feature);
        if(isBench(feature))
            filteredFeatures.benches.push(feature);
        if(isTree(feature))
            filteredFeatures.trees.push(feature);
        if(isSmallMonument(feature))
            filteredFeatures.smallMonuments.push(feature);
        if(isGrass(feature))
            filteredFeatures.grass.push(feature);
        if(isBarrier(feature))
            filteredFeatures.barriers.push(feature);
        if(isBoundary(feature))
            filteredFeatures.boundaries.push(feature);
        if(isLand(feature))
            filteredFeatures.land.push(feature);
        if(isCoastline(feature))
            filteredFeatures.coastlines.push(feature);
        if(isCityBlock(feature))
            filteredFeatures.cityBlocks.push(feature);
        if(isFlowerbed(feature))
            filteredFeatures.flowerbeds.push(feature);  
        if(isWalkableArea(feature))
            filteredFeatures.walkableAreas.push(feature);
        if(isWalkablePath(feature))
            filteredFeatures.walkablePaths.push(feature);
    }

    return filteredFeatures;
}

// ---------------------------------------------- Type filters -------------------------------------------

function isRoad(feature){   
    return feature.properties.highway &&
    feature.properties.highway != "pedestrian" &&
    feature.properties.foot != "designated" &&
    !feature.properties.footway &&
    feature.properties.highway != "footway" &&
    feature.properties.highway != "steps" &&
    feature.properties.highway != "cycleway" && // Debatable...
    feature.properties.highway != "path" &&
    feature.properties.highway != "living_street" && // living street should not be congested
    feature.properties.highway != "platform" && // 
    isLine(feature);
}

function isRailway(feature){   
    return feature.properties.railway && 
    feature.properties.railway != "razed" && 
    feature.properties.railway != "abandoned" &&
    isLine(feature);
}

function isParkingArea(feature){   
    return (feature.properties.amenity === "motorcycle_parking" ||  
    feature.properties.amenity === "bicycle_parking" ||
    feature.properties.amenity === "parking") &&
    feature.properties.parking !== "underground" &&
    isPolygon(feature);
}

function isBuilding(feature){   
    return feature.properties.building &&
    feature.properties.building !== "roof" &&
    isPolygon(feature);
}

function isWalkable(feature){
    return feature.properties.highway &&
    (feature.properties.highway === "pedestrian" ||
    feature.properties.foot === "designated" ||
    feature.properties.footway ||
    feature.properties.highway === "footway" ||
    feature.properties.highway === "steps" ||
    //feature.properties.highway === "cycleway" || 
    feature.properties.highway === "path" ||
    feature.properties.highway === "living_street" ||
    feature.properties.highway === "platform" ||
    feature.properties.highway === "track") 
}

function isWalkableArea(feature){
    return (
        isWalkable(feature) ||
        feature.properties.place === "square" ||
        feature.properties.landuse === "recreation_ground" 
    ) && isPolygon(feature);
}

function isWalkablePath(feature){
    return isWalkable(feature) && isLine(feature);
}

function isWater(feature){
    return (feature.properties.natural == "water" ||
	feature.properties.place == "sea" ||
	feature.properties.natural == "bay" ||
	feature.properties.natural	== "strait" ||
    feature.properties.natural	== "wetlands" ||
    feature.properties.natural	== "mud" ||
    feature.properties.natural	== "shoal" ||
    feature.properties.leisure == "swimming_pool" ||
    feature.properties.waterway) && 
    isPolygon(feature); 
}

function isBridge(feature){
    return (
        feature.properties.man_made == "bridge" || 
        feature.properties.bridge
    ) && 
    isPolygon(feature);
}

function isTree(feature){
    return (feature.properties.natural == "tree" ||
    feature.properties.natural == "tree_row") &&
    isPoint(feature);
}

function isBench(feature){
    return feature.properties.amenity == "bench" &&
    isPoint(feature);
}

function isSmallMonument(feature){
    return (feature.properties.artwork_type ||
    feature.properties.tourism == "artwork" ||
    feature.properties.historic == "monument" ||
    feature.properties.historic == "memorial");
}

function isGrass(feature){
    return feature.properties.landuse == "grass" && 
    isPolygon(feature);
}

function isFlowerbed(feature){
    return feature.properties.landuse == "flowerbed" && 
    isPolygon(feature);
}

function isPrivateArea(feature){
    return (feature.properties.landuse == "military" || //Military bases
    feature.properties.landuse == "railway" || //Train areas with railways
    feature.properties.landuse == "construction" ||
    feature.properties.landuse == "quarry" ||   //Quarries
    // feature.properties.landuse == "industrial" || //Industrial areas
    //feature.properties.landuse == "cemetery" ||   //Cemeteries
    feature.properties.aeroway ||              //Airports
    feature.properties.access == "private" ||  //General private areas with access restrictions
    feature.properties.access == "no" ||       //General private areas with access restrictions
    feature.properties.leisure == "stadium" || //Sports stadiums
    feature.properties.leisure == "golf_course" ||
    feature.properties.sport ||
    feature.properties.amenity == "school" ||
    feature.properties.amenity == "prison" ||
    feature.properties.barrier||
    isPlot(feature)) &&  
    isPolygon(feature);
}

function isCityBlock(feature){
    return feature.properties.place == "city_block" && 
    isPolygon(feature);
}

function isPlot(feature){
    return feature.properties.place == "plot" && 
    isPolygon(feature);
}

function isBarrier(feature){
    return feature.properties.barrier &&
    feature.properties.barrier != "kerb" &&
    !isPolygon(feature);
}

function isBoundary(feature){
    return feature.properties.boundary &&
    feature.properties.boundary == "administrative" &&
    isPolygon(feature);
}

function isGroundLevel(feature){
    if(feature.properties.layer)
        return parseInt(feature.properties.layer) === 0;
    return true;
}

function isLand(feature){
    return feature.properties.place ||
    feature.properties.landuse ||
    (feature.properties.natural && !isWater(feature));
}

function isCoastline(feature){
    return feature.properties.natural &&
    feature.properties.natural === "coastline";
}

// ------------------------------------------ Geometry type filters -------------------------------------

function isLine(feature){
    return feature.geometry.type == "LineString";
}

function isPolygon(feature){
    return feature.geometry.type.includes("Polygon");
}

function isPoint(feature){
    return feature.geometry.type == "Point";
}

