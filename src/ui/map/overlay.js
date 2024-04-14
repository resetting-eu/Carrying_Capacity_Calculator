const { ScatterplotLayer } = require('@deck.gl/layers');
const { featuresToPoints } = require('./util');

// TODO ponderar passar isto para util.js em vez de ter este módulo
function refreshOverlay(context) {
  if(context.metadata.union === null) {
    context.map.deck.setProps({layers: []});
  } else {
    const featureCollection = {features: [context.metadata.union], type: "FeatureCollection"};
    const dataPoints = featuresToPoints(featureCollection, 0.2);
    context.map.deck.setProps({
    layers: [
        new ScatterplotLayer({
        id: 'ScatterplotLayer',
        data: dataPoints,
        getPosition: p => p,
        getRadius: 2,
        getFillColor: [255, 0, 0, 100]
      })
    ]});  
  }
}

module.exports = {
  refreshOverlay
};
