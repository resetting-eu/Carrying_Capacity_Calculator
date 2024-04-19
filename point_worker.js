importScripts("turf.min.js");

const { bbox, area, randomPoint, booleanContains, point } = turf;

function multiPolygonToPolygons(multiPolygonFeature) {
  if (multiPolygonFeature.type !== 'Feature' || multiPolygonFeature.geometry.type !== 'MultiPolygon') {
    console.error('Input feature is not a MultiPolygon');
    return [];
  }

  const multiPolygonCoordinates = multiPolygonFeature.geometry.coordinates;
  const polygonFeatures = multiPolygonCoordinates.map(polygonCoords => {
    return {
      type: 'Feature',
      properties: multiPolygonFeature.properties,
      geometry: {
        type: 'Polygon',
        coordinates: polygonCoords
      }
    };
  });

  return polygonFeatures;
}

function checkContains(feat1, feat2) {
  const type = feat1.geometry.type;
  if(type === "MultiPolygon") {
    const polygons = multiPolygonToPolygons(feat1);
    for(const polygon of polygons) {
      if(booleanContains(polygon, feat2)) {
        return true;
      }
    }
    return false;
  } else {
    return booleanContains(feat1, feat2);
  }
}

function featureToPoints(feat, density) {
  const points = [];
  const featBbox = bbox(feat);
  const a = area(feat);
  const n = Math.round(a * density);
  let featPointCount = 0;
  while(featPointCount < n) {
    const randomPoints = randomPoint(n - featPointCount, {bbox: featBbox});
    for(const pointFeat of randomPoints["features"]) {
      if(checkContains(feat, pointFeat)) {
        points.push(pointFeat["geometry"]["coordinates"]);
        ++featPointCount;
      }
    }
  }
  return points;
}

function removePoints(points, newUnion) {
  const newPoints = [];
  if(newUnion) {
    for(const p of points) {
      if(checkContains(newUnion, point(p))) {
        newPoints.push(p);
      }
    }
  }
  return newPoints;
}

onmessage = function(e) {
  const {area, pointDensity, newUnion, points} = e.data;
  if(area) { // add feature
    postMessage(featureToPoints(area, pointDensity));
  } else { // remove features
    postMessage(removePoints(points, newUnion));
  }
}

onerror = function(e) {
  console.log("Error in point_worker");
  console.log(e);
}
