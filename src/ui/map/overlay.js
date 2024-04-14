const { ScatterplotLayer } = require('@deck.gl/layers');
const { difference, union } = require('@turf/turf');
const { featureToPoints } = require('./util');

// TODO ponderar passar isto para util.js em vez de ter este módulo
function refreshOverlay(context, newFeature) {
  const unionFeature = context.metadata.union;
  const newArea = unionFeature ? difference(newFeature, unionFeature) : newFeature;
  const newPoints = featureToPoints(newArea, 0.2);
  context.metadata.union = unionFeature ? union(unionFeature, newArea) : newArea;
  context.metadata.points = context.metadata.points.concat(newPoints);
  context.map.deck.setProps({
  layers: [
      new ScatterplotLayer({
      id: 'ScatterplotLayer',
      data: context.metadata.points,
      getPosition: p => p,
      getRadius: 2,
      getFillColor: [255, 0, 0, 100]
    })
  ]});
}

module.exports = {
  refreshOverlay
};
