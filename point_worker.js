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

function featureToPoints(feat, density) {
  const points = [];
  const featBbox = bbox(feat);
  const a = area(feat);
  const n = Math.round(a * density);
  const featPolygons = feat.geometry.type === "MultiPolygon" ? multiPolygonToPolygons(feat) : [feat];
  let featPointCount = 0;
  while(featPointCount < n) {
    const randomPoints = randomPoint(n - featPointCount, {bbox: featBbox});
    for(const pointFeat of randomPoints["features"]) {
      for(const polygon of featPolygons) {
        if(booleanContains(polygon, pointFeat)) {
          points.push(pointFeat["geometry"]["coordinates"]);
          ++featPointCount;
          break;
        }
      }
    }
  }
  return points;
}

function removePoints(points, newUnion) {
  const newPoints = [];
  if(newUnion) {
    const newUnionPolygons = newUnion.geometry.type === "MultiPolygon" ? multiPolygonToPolygons(newUnion) : [newUnion];
    for(const p of points) {
      for(const polygon of newUnionPolygons) {
        if(booleanContains(polygon, point(p))) {
          newPoints.push(p);
          break;
        }  
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
