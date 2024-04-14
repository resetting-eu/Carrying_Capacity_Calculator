const { ScatterplotLayer } = require('@deck.gl/layers');
const { featuresToPoints } = require('./util');

function refreshOverlay(context) {
  const walkableFeatureMetadata = context.metadata.areas[0]; // TODO work with multiple feats
  if(walkableFeatureMetadata !== undefined) {
    const walkableFeature = walkableFeatureMetadata.feature;
    const data = {"features": [walkableFeature]}
    const dataPoints = featuresToPoints(data, 0.2);
    context.map.deck.setProps({
    layers: [
        new ScatterplotLayer({
        id: 'ScatterplotLayer',
        data: dataPoints,
        getPosition: p => p,
        getRadius: 2,
        getFillColor: [255, 0, 0, 100]
      })
    ]
    });
  }
}

module.exports = {
  refreshOverlay
};
