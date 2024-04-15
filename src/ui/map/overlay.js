const { ScatterplotLayer } = require('@deck.gl/layers');
const { difference, union, point } = require('@turf/turf');
const {
  WALKABLE_AREA_POINT_DENSITY,
  WALKABLE_AREA_POINT_RADIUS,
  WALKABLE_AREA_POINT_COLOR
} = require('../../constants');
const { featureToPoints, checkContains } = require('./util');

// TODO ponderar passar isto para util.js em vez de ter este módulo
function refreshOverlay(context, newFeature, removedIds) {
  if(newFeature) {
    const unionFeature = context.metadata.union;
    const newArea = unionFeature ? difference(newFeature, unionFeature) : newFeature;
    const newPoints = featureToPoints(newArea, WALKABLE_AREA_POINT_DENSITY);
    context.metadata.union = unionFeature ? union(unionFeature, newArea) : newArea;
    context.metadata.points = context.metadata.points.concat(newPoints);  
  }
  
  if(removedIds && removedIds.length > 0) {
    let newUnion = null;
    for(const id of Object.keys(context.metadata.areas)) {
      if(removedIds.includes(id)) {
        delete context.metadata.areas[id];
      } else {
        const f = context.metadata.areas[id].feature;
        newUnion = newUnion ? union(newUnion, f) : f;
      }
    }
    
    const newPoints = [];
    if(newUnion) {
      for(const p of context.metadata.points) {
        if(checkContains(newUnion, point(p))) {
          newPoints.push(p);
        }
      }
    }

    context.metadata.union = newUnion;
    context.metadata.points = newPoints;
  }

  context.map.deck.setProps({
  layers: [
      new ScatterplotLayer({
      id: 'ScatterplotLayer',
      data: context.metadata.points,
      getPosition: p => p,
      getRadius: WALKABLE_AREA_POINT_RADIUS,
      getFillColor: WALKABLE_AREA_POINT_COLOR
    })
  ]});
}

module.exports = {
  refreshOverlay
};
