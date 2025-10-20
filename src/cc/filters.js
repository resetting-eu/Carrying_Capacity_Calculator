function filterFeatures(features, bounds){
    let filteredFeatures = {
        roads: [],
        railways: [],
        buildings: [],
        waterBodies: [],
        restrictedAreas: [],
        benches: [],
        trees: [],
        smallMonuments: [],
        grass: [],
        bridges: [],
        barriers:[],
        boundaries:[],
        land:[],
        coastlines:[],
    };

    for (let feature of features) {
        if(isBuilding(feature))
            filteredFeatures.buildings.push(feature);
        if(isWater(feature))
            filteredFeatures.waterBodies.push(turf.intersect(feature, bounds));
        if(isRoad(feature))
            filteredFeatures.roads.push(feature);
        if(isRailway(feature))
            filteredFeatures.railways.push(feature);
        if(isBridge(feature))
            filteredFeatures.bridges.push(feature);
        if(isRestrictedArea(feature))
            filteredFeatures.restrictedAreas.push(feature);
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
    }

    return filteredFeatures;
}

// Type filters

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
    isAboveGround(feature) &&
    isLine(feature);
}

function isRailway(feature){   
    return feature.properties.railway && 
    feature.properties.railway != "razed" && 
    feature.properties.railway != "abandoned" &&
	isAboveGround(feature) &&
    isLine(feature);
}

function isBuilding(feature){   
    return feature.properties.building &&
    isAboveGround(feature) &&
    isPolygon(feature);
}

function isWater(feature){
    return (feature.properties.natural == "water" ||
	feature.properties.place == "sea" ||
	feature.properties.natural == "bay" ||
	feature.properties.natural	== "strait" ||
    feature.properties.natural	== "wetlands" ||
    feature.properties.natural	== "mud" ||
    feature.properties.natural	== "shoal" ||
    feature.properties.waterway) && 
    isPolygon(feature); 
}

function isBridge(feature){
    return feature.properties.man_made == "bridge" && 
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

function isRestrictedArea(feature){
    return (feature.properties.landuse == "military" ||
    feature.properties.aeroway) && 
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

function isAboveGround(feature){
    if(feature.properties.layer)
        return parseInt(feature.properties.layer) > -1;
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

// Geometry type filters
function isLine(feature){
    return feature.geometry.type == "LineString";
}

function isPolygon(feature){
    return feature.geometry.type.includes("Polygon");
}

function isPoint(feature){
    return feature.geometry.type == "Point";
}

function isPoint(feature){
    return feature.geometry.type == "Point";
}

