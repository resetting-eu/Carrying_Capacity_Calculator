const {MapboxOverlay} = require("@deck.gl/mapbox");
const {ScatterplotLayer} = require("@deck.gl/layers");
const {difference, union} = require("@turf/turf");

const {
  WALKABLE_AREA_POINT_DENSITY,
  WALKABLE_AREA_POINT_RADIUS,
  WALKABLE_AREA_POINT_COLOR
} = require("../../constants");

class Overlay {
  constructor(context) {
    this.deck = new MapboxOverlay({
      layers: []
    });
    context.map.addControl(this.deck);
  }

  removeFeaturesById(context, removedIds) {
    let newUnion = null;
    for(const id of Object.keys(context.metadata.areas)) {
      if(removedIds.includes(id)) {
        if(context.metadata.areas[id].worker) {
          context.metadata.areas[id].worker.terminate();
        }
        delete context.metadata.areas[id];
      } else {
        const f = context.metadata.areas[id].feature;
        newUnion = newUnion ? union(newUnion, f) : f;
      }
    }
    
    const worker = new Worker("point_worker.js");
    context.metadata.union = newUnion;
    worker.postMessage({points: context.metadata.points, newUnion: newUnion});
    worker.onmessage = e => {
      const newPoints = e.data;
      context.metadata.points = newPoints;
      refreshOverlay(context, this.deck);
    };
  }

  addFeature(context, newFeatureId) {
    const newFeature = context.metadata.areas[newFeatureId].feature;
    const unionFeature = context.metadata.union;
    const newArea = unionFeature ? difference(newFeature, unionFeature) : newFeature;
    context.metadata.union = unionFeature ? union(unionFeature, newArea) : newArea;

    const worker = new Worker("point_worker.js");
    context.metadata.areas[newFeatureId].worker = worker;
    worker.postMessage({area: newArea, pointDensity: WALKABLE_AREA_POINT_DENSITY});
    worker.onmessage = e => {
      const newPoints = e.data;
      delete context.metadata.areas[newFeatureId].worker;
      context.metadata.points = context.metadata.points.concat(newPoints);
      refreshOverlay(context, this.deck);
    };
  }
}

function refreshOverlay(context, deck) {
  deck.setProps({
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
  Overlay
};
