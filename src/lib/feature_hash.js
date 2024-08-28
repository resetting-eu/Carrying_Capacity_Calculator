const hash = require('object-hash');

module.exports = function(feature) {
  return hash(feature?.geometry?.coordinates);
}
