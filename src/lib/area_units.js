// maps area unit names to HTML unit symbols
const areaUnits = {
  SQUARE_METERS: {name: "Sq. Meters", symbolHTML: "m<sup>2</sup>"},
  SQUARE_KILOMETERS: {name: "Sq. Kilometers", symbolHTML: "km<sup>2</sup>"},
  SQUARE_FEET: {name: "Sq. Feet", symbolHTML: "ft<sup>2</sup>"},
  ACRE: {name: "Acre", symbolHTML: "acre"},
  SQUARE_MILES: {name: "Sq. Mile", symbolHTML: "mi<sup>2</sup>"}
};

function convertFromSqMeters(area, outputUnit) {
  switch(outputUnit) {
    case areaUnits.SQUARE_METERS:
      return area;
    case areaUnits.SQUARE_KILOMETERS:
      return area / 1000000;
    case areaUnits.SQUARE_FEET:
      return area / 0.092903;
    case areaUnits.ACRE:
      return area / 4046.86;
    case areaUnits.SQUARE_MILES:
      return area / 2589990;
  }
  console.error("Unknown unit");
}

function convertToSqMeters(area, inputUnit) {
  switch(inputUnit) {
    case areaUnits.SQUARE_METERS:
      return area;
    case areaUnits.SQUARE_KILOMETERS:
      return area * 1000000;
    case areaUnits.SQUARE_FEET:
      return area * 0.092903;
    case areaUnits.ACRE:
      return area * 4046.86;
    case areaUnits.SQUARE_MILES:
      return area * 2589990;
  }
  console.error("Unknown unit");
}

function convertArea(area, inputUnit, outputUnit) {
  return convertFromSqMeters(convertToSqMeters(area, inputUnit), outputUnit);
}

module.exports = {
  areaUnits,
  convertArea,
  DEFAULT_AREA_UNIT: areaUnits.SQUARE_METERS
};
