const {MapboxOverlay} = require("@deck.gl/mapbox");
const {GeoJsonLayer} = require("@deck.gl/layers");

class Overlay {
  constructor(context) {
    this.deck = new MapboxOverlay({
      layers: []
    });
    context.map.addControl(this.deck);
  }

  removeFeaturesById(context, removedIds) {
    for(const removedId of removedIds) {
      delete context.metadata.areas[removedId];
    }
    refreshOverlay(context, this.deck);
  }

  addFeature(context, _) {
    refreshOverlay(context, this.deck);
  }
}

function refreshOverlay(context, deck) {
  const features = [];
  for(const key of Object.keys(context.metadata.areas)) {
    const area = context.metadata.areas[key];
    if(typeof area.meters === "number") {
      features.push(area.feature);
    }
  }

  deck.setProps({
    layers: [
      new GeoJsonLayer({
        id: "GeoJsonLayer",
        data: features,
        getFillColor: [255, 0, 0, 100],
        getLineColor: [255, 0, 0, 255]
      })
  ]});
}

module.exports = {
  Overlay
};
