const area = require('@turf/area').default;
const bbox = require('@turf/bbox').default;
const {union} = require('@turf/turf');
const {createPopper, flip} = require('@popperjs/core');
const osmtogeojson = require('osmtogeojson');
const run = require('./carrying_capacity/run');
const featureHash = require('./feature_hash');
const {areaUnits, convertArea} = require('./area_units');
const tooltips = require('./tooltips');

const DEFAULT_AREA_PER_PEDESTRIAN = 1; // sq. meters
const DEFAULT_ROTATION_FACTOR = 1;
const DEFAULT_CORRECTIVE_FACTORS = JSON.stringify([{name: "Corrective Factor", value: 1}]);
const DEFAULT_MANAGEMENT_CAPACITY = 1;
const AREA_PER_PEDESTRIAN_STORAGE_KEY = "area_per_pedestrian";
const ROTATION_FACTOR_STORAGE_KEY = "rotation_factor";
const CORRECTIVE_FACTORS_STORAGE_KEY = "corrective_factors";
const MANAGEMENT_CAPACITY_STORAGE_KEY = "management_capacity";

module.exports = function (context) {
  return function (e, id) {
    const sel = d3.select(e.target._content);

    sel.selectAll('.cancel').on('click', clickClose);

    sel.selectAll('form').on('submit', saveFeature);

    sel.selectAll('.add').on('click', addRow);

    sel
      .selectAll('.add-simplestyle-properties-button')
      .on('click', addSimplestyleProperties);

    sel.selectAll('.delete-invert').on('click', removeFeature);

    sel.select('.calculate-carrying-capacity-button').on('click', calculateWalkableArea);

    sel.select('#area-unit-select').on('change', changeAreaUnit);

    sel.selectAll("input[type=checkbox]").property("checked", false);

    sel.select('#download-geojson').on('click', downloadGeoJSON);
    sel.select('#download-csv').on('click', downloadCSV);
    sel.select('#upload-geometries').on('click', uploadData);
    
    const data = context.data.get('map');
    const feature = data.features[id];
    const id_hash = featureHash(feature);

    sel.select("#remove-custom-features-"+id_hash).on("click",removeCustomFeatures);
    
    renderMetadata();

    function renderMetadata() {
      if(feature.geometry.type === "Polygon") {
        expandMetadataWithTotalArea(feature);
        if(typeof context.metadata.areas[id_hash]?.meters === "number") {
          expandMetadataWithCarryingCapacity(feature, context.metadata.areas[id_hash].meters);
        }
      }
    }

    function calculateWalkableArea() {
      const button = sel.select(".calculate-carrying-capacity-button");
      button.classed("hide", true);

      const calculating = sel.select("#calculating-" + id_hash);
      calculating.classed("hide", false);

      context.metadata.areas[id_hash] = {meters: "calculating"};

      const feature_bbox = bbox(feature);
      const bbox_ordered = [feature_bbox[1], feature_bbox[0], feature_bbox[3], feature_bbox[2]];
      const bbox_str = bbox_ordered.join(",");
      const query_old = `[out:json][timeout:90];(nwr(${bbox_str}););(._;>;);out;`;
      const query = `[out:json][timeout:90];nwr[boundary!~"timezone"][!route](${bbox_str});(._;>;);out;`;
      const overpassEndpoint = 'https://overpass-api.de/api/interpreter';
      console.log("Starting OSM data download...");
      fetch(overpassEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ data: query })
      })
      .then(response => {
        if (!response.ok) {
          alert(`Error on calling Overpass API: ${response.status}`);
          throw new Error(`HTTP error on overpass call! Status: ${response.status}`);
        }
        return response.json();
      })
      .then(j => {

        const osm_geojson = osmtogeojson(j);
        console.log("OSM data downloaded");
        console.log("Number of OSM features: " + osm_geojson.features.length);
        sel.select("#calculating-" + id_hash).text("Starting calculations...");

        const grass = sel.select(".calculate-carrying-capacity-button");

        let custom_features = context.storage.get("custom_features_" + id_hash);

        const options = {
          railWidth: 3,
          laneWidth: 3,
          diagonalWidth: 2,
          parallelWidth: 5,
          flattenBuildings: sel.select("#buildings").node().checked,
          walkableRoads: sel.select("#roads").node().checked,
          unwalkableGrass: sel.select("#grass").node().checked,
          customFeatures: custom_features
        };

        console.log(options);
        // Limit worker numbers to avoid excessive memory overhead
        let nCores = Math.min(navigator.hardwareConcurrency, 10);
        //let num_workers = (nCores * 2 < 10) ? nCores * 2 : Math.max(nCores, 10);
        setTimeout(() => {
          run(nCores, "calculating-" + id_hash, osm_geojson.features, feature, options, feature_walkable => {
          const walkable_meters = area(feature_walkable);
          context.metadata.areas[id_hash] = {feature: feature_walkable, meters: walkable_meters, options};
          
          calculating.classed("hide", true);
          sel.select("#ccc-options").classed("hide", true);
          sel.select(".download").classed("hide", false);

          expandMetadataWithCarryingCapacity(feature, walkable_meters);

          context.map.overlay.addFeature(context, id_hash);
          sel.select("#ccc-options").classed("hide", true);
          sel.select(".download").classed("hide", false);
          });
        }, 0);
        
      })
      .catch(e => {
        console.error(e);
        delete context.metadata.areas[id_hash];

        sel.selectAll(".metadata-grid *").remove();
        calculating.classed("hide", true);
        button.classed("hide", false);

        expandMetadataWithTotalArea(feature);
      });
    }

    function expandMetadataWithTotalArea(feature) {
      sel.select(".metadata").remove(); // remove table element, we'll use grid
      const unitHTML = context.metadata.areaUnit.symbolHTML;
      sel.select(".metadata-grid").html(
        '<div>Area</div><div class="right"><span id="info-area">' +
        convertArea(area(feature.geometry), areaUnits.SQUARE_METERS, context.metadata.areaUnit).toFixed(2) +
        '</span> <span class="info-area-unit">' + unitHTML + '</span>' +
        '</div>'
      );
    }

    function expandMetadataWithCarryingCapacity(feature, walkable_meters) {
      const unitHTML = context.metadata.areaUnit.symbolHTML;

      const {areaPerPedestrian, rotationFactor, correctiveFactors, managementCapacity} = loadCarryingCapacityInputsFromStorage(id_hash);
      const areaPerPedestrianInSelectedUnit = convertArea(areaPerPedestrian, areaUnits.SQUARE_METERS, context.metadata.areaUnit);

      const correctiveFactorsResponse = correctiveFactorsHtml(correctiveFactors, areaPerPedestrian, rotationFactor);

      sel.select(".metadata-grid").html(
        sel.select(".metadata-grid").html() +
        '<div class="merge row-with-gap">' +
        '<span class="tooltip-label" tooltip="walkable-area">Walkable Area</span>' +
        '</div><div class="right"><span id="info-walkable-area">' +
        convertArea(walkable_meters, areaUnits.SQUARE_METERS, context.metadata.areaUnit).toFixed(2) +
        '</span> <span class="info-area-unit">' + unitHTML + '</span>' +
        '</div><div class="right row-with-gap">' +
        (walkable_meters / area(feature.geometry) * 100).toFixed(2) +
        '%</div>' +
        '<div class="input"><span class="tooltip-label" tooltip="area-per-pedestrian">Area per Pedestrian</span></div>' +
        '<div class="right input"><input list="los" value="' + areaPerPedestrianInSelectedUnit + '" id="info-area-per-pedestrian">'+
        `<datalist id="los">
            <option value="5.6" label="LOS A (m2/ped)">
            <option value="3.7" label="LOS B (m2/ped)">
            <option value="2.2" label="LOS C (m2/ped)">
            <option value="1.4" label="LOS D (m2/ped)">
            <option value="0.75" label="LOS E (m2/ped)">
        </datalist>`+
        '</input> <span class="info-area-unit">' + unitHTML + '</span></div>'+ 
        '<div class="input row-with-gap">' +
        '<span class="tooltip-label" tooltip="rotation-factor">Rotation Factor</span></div>' +
        '<div class="right input row-with-gap"><input id="info-rotation-factor" value="' + rotationFactor + '"></input></div>' +
        '<div class="row-with-gap"><span class="tooltip-label" tooltip="physical-carrying-capacity">PCC</span></div>' +
        '<div class="right row-with-gap"><span id="info-physical-carrying-capacity">' + Math.round(walkable_meters / areaPerPedestrian * rotationFactor) + '</span> visitors</div>' +
        correctiveFactorsResponse.html +
        '<div class="input row-with-gap"><span class="tooltip-label" tooltip="management-capacity">Management Capacity</span></div>' +
        '<div class="right input row-with-gap"><input id="info-management-capacity" value="' + managementCapacity + '"></input></div>' +
        '<div><span class="tooltip-label" tooltip="effective-carrying-capacity">ECC</span></div>' +
        '<div class="right"><span id="info-effective-carrying-capacity">' + Math.round(correctiveFactorsResponse.rcc * managementCapacity) + '</span> visitors</div>'
      );

      // Fixing LOS suggestion functionality
      /*
      const input = document.getElementById('info-area-per-pedestrian');
      // Trick: open dropdown with all options when focusing
      input.addEventListener('click', () => {
        const oldValue = input.value;
        input.value = '';             // insert space to trigger dropdown
        input.dispatchEvent(new Event('input', {bubbles:true}));
        input.value = oldValue;
      });*/
      
      addCalculatorEvents();

      addPoppers();
    }

    function correctiveFactorsHtml(correctiveFactors, areaPerPedestrian, rotationFactor) {
      const walkable_meters = context.metadata.areas[id_hash].meters;
      let rcc = Math.round(walkable_meters / areaPerPedestrian * rotationFactor);

      let res = "";
      for(let i = 0; i < correctiveFactors.length; ++i) {
        const cf = correctiveFactors[i];
        rcc *= cf.value;
        const lastRowClass = i == correctiveFactors.length - 1 ? "last-row" : "";
        res += `<div class="input corrective-factor ${lastRowClass}"><span>${cf.name}</span><textarea class="hide">${cf.name}</textarea><i class="fa-solid fa-check hide cf-align-right"></i><i class="fa-solid fa-pencil cf-align-right cf-edit"></i><i class="fa-solid fa-xmark delete-invert"></i></span></div><div class="input right ${lastRowClass}"><input value="${cf.value}"></input></div>`
      }
      res +=
        '<div class="add-corrective-factor"><span class="fa-solid fa-plus"></span> Add Corrective Factor</div>' +
        '<div class="row-with-gap"><span class="tooltip-label" tooltip="real-carrying-capacity">RCC</span></div>' +
        '<div class="right row-with-gap"><span id="info-real-carrying-capacity">' + Math.round(rcc) + '</span> visitors</div>';
      return {html: res, rcc};
    }

    function loadCarryingCapacityInputsFromStorage(id_hash) {
      return {
        areaPerPedestrian: loadFromStorage(id_hash, AREA_PER_PEDESTRIAN_STORAGE_KEY, DEFAULT_AREA_PER_PEDESTRIAN),
        rotationFactor: loadFromStorage(id_hash, ROTATION_FACTOR_STORAGE_KEY, DEFAULT_ROTATION_FACTOR),
        correctiveFactors: JSON.parse(loadFromStorage(id_hash, CORRECTIVE_FACTORS_STORAGE_KEY, DEFAULT_CORRECTIVE_FACTORS)),
        managementCapacity: loadFromStorage(id_hash, MANAGEMENT_CAPACITY_STORAGE_KEY, DEFAULT_MANAGEMENT_CAPACITY)
      }
    }

    function computeStorageKey(id_hash, key) {
      return "cc_input_" + key + id_hash;
    }

    function loadFromStorage(id_hash, key, defaultValue) {
      const computedKey = computeStorageKey(id_hash, key);
      const value = context.storage.get(computedKey);
      if(value) {
        return value;
      } else {
        context.storage.set(computedKey, defaultValue);
        return defaultValue;
      }
    }

    function storeInStorage(id_hash, key, value) {
      const computedKey = computeStorageKey(id_hash, key);
      context.storage.set(computedKey, value);
    }

    function changeAreaUnit() {
      const oldAreaUnit = context.metadata.areaUnit;
      const areaUnitName = this.value;
      const areaUnit = Object.values(areaUnits).filter(o => o.name === areaUnitName)[0];
      context.metadata.areaUnit = areaUnit;
      context.storage.set("area_unit", areaUnit.name);

      const data = context.data.get('map');
      const feature = data.features[id];
      const id_hash = featureHash(feature);
      const walkableAreaFeature = context.metadata.areas[id_hash]?.feature;

      const unitHTML = context.metadata.areaUnit.symbolHTML;

      sel
        .select("#info-area")
        .text(convertArea(area(feature.geometry), areaUnits.SQUARE_METERS, context.metadata.areaUnit).toFixed(2));
      
      if(walkableAreaFeature !== undefined) {
        sel
          .select("#info-walkable-area")
          .text(convertArea(area(walkableAreaFeature), areaUnits.SQUARE_METERS, context.metadata.areaUnit).toFixed(2))

        const areaPerPedestrianOld = parseFloat(sel.select("#info-area-per-pedestrian").property("value"));
        sel
          .select("#info-area-per-pedestrian")
          .property("value", convertArea(areaPerPedestrianOld, oldAreaUnit, context.metadata.areaUnit));
      }

      sel
        .selectAll(".info-area-unit")
        .html(unitHTML);
    }

    function addPoppers() {
      sel.selectAll(".tooltip-label:not([has-popper])").each(function() {
        const label = this;
        const tooltip = document.createElement("div");
        tooltip.className = "tooltip";
        tooltip.setAttribute("role", "tooltip");
        tooltip.textContent = tooltips[label.getAttribute("tooltip")];
        label.insertAdjacentElement("afterend", tooltip);

        label.setAttribute("has-popper", "");
        const popperInstance = createPopper(label, tooltip, {
          placement: 'top',
          modifiers: [flip]
        });
  
        function show() {
          tooltip.setAttribute('data-show', '');  
          popperInstance.update();
        }
        
        function hide() {
          tooltip.removeAttribute('data-show');
        }
        
        const showEvents = ['mouseenter', 'focus'];
        const hideEvents = ['mouseleave', 'blur'];
        
        showEvents.forEach((event) => {
          label.addEventListener(event, show);
        });
        
        hideEvents.forEach((event) => {
          label.addEventListener(event, hide);
        });  
      });
    }

    function addCalculatorEvents() {
      // change area per pedestrian
      sel.select("#info-area-per-pedestrian").on("input", function () {
        const areaPerPedestrian = parseFloat(d3.event.target.value);
        const areaUnit = context.metadata.areaUnit;
        const rotationFactor = parseFloat(sel.select("#info-rotation-factor").property("value"));
        const areaPerPedestrianInMeters = convertArea(areaPerPedestrian, areaUnit, areaUnits.SQUARE_METERS);
        const data = context.data.get('map');
        const feature = data.features[id];
        const id_hash = featureHash(feature);
        const walkableArea = context.metadata.areas[id_hash].meters;
        const pcc = walkableArea / areaPerPedestrianInMeters * rotationFactor;
        sel.select("#info-physical-carrying-capacity").text(Math.round(pcc));
        storeInStorage(id_hash, AREA_PER_PEDESTRIAN_STORAGE_KEY, areaPerPedestrianInMeters);
        let rcc = pcc;
        sel.selectAll(".corrective-factor + div input").each(function() {
          rcc *= parseFloat(this.value)
        });
        sel.select("#info-real-carrying-capacity").text(Math.round(rcc));
        const managementCapacity = parseFloat(d3.select("#info-management-capacity").property("value"));
        const ecc = Math.round(rcc * managementCapacity);
        sel.select("#info-effective-carrying-capacity").text(ecc);
      });

      // change rotation factor
      sel.select("#info-rotation-factor").on("input", function () {
        const areaPerPedestrian = parseFloat(sel.select("#info-area-per-pedestrian").property("value"));
        const areaUnit = context.metadata.areaUnit;
        const rotationFactor = parseFloat(d3.event.target.value);
        const areaPerPedestrianInMeters = convertArea(areaPerPedestrian, areaUnit, areaUnits.SQUARE_METERS);
        const data = context.data.get('map');
        const feature = data.features[id];
        const id_hash = featureHash(feature);
        const walkableArea = context.metadata.areas[id_hash].meters;
        const pcc = walkableArea / areaPerPedestrianInMeters * rotationFactor;
        sel.select("#info-physical-carrying-capacity").text(Math.round(pcc));
        storeInStorage(id_hash, ROTATION_FACTOR_STORAGE_KEY, rotationFactor);
        let rcc = pcc;
        sel.selectAll(".corrective-factor + div input").each(function() {
          rcc *= parseFloat(this.value)
        });
        sel.select("#info-real-carrying-capacity").text(Math.round(rcc));
        const managementCapacity = parseFloat(d3.select("#info-management-capacity").property("value"));
        const ecc = Math.round(rcc * managementCapacity);
        sel.select("#info-effective-carrying-capacity").text(ecc);
      });

      // change corrective factor's value
      sel.selectAll(".corrective-factor + div input").on("input", function (_, i) {
        const areaPerPedestrian = parseFloat(sel.select("#info-area-per-pedestrian").property("value"));
        const areaUnit = context.metadata.areaUnit;
        const rotationFactor = parseFloat(sel.select("#info-rotation-factor").property("value"));
        const areaPerPedestrianInMeters = convertArea(areaPerPedestrian, areaUnit, areaUnits.SQUARE_METERS);
        const data = context.data.get('map');
        const feature = data.features[id];
        const id_hash = featureHash(feature);
        const walkableArea = context.metadata.areas[id_hash].meters;
        const pcc = walkableArea / areaPerPedestrianInMeters * rotationFactor;
        let rcc = pcc;
        sel.selectAll(".corrective-factor + div input").each(function() {
          rcc *= parseFloat(this.value)
        });
        sel.select("#info-real-carrying-capacity").text(Math.round(rcc));
        const computedKey = computeStorageKey(id_hash, CORRECTIVE_FACTORS_STORAGE_KEY);
        const correctiveFactors = JSON.parse(context.storage.get(computedKey));
        correctiveFactors[i].value = parseFloat(d3.event.target.value);
        context.storage.set(computedKey, JSON.stringify(correctiveFactors));
        const managementCapacity = parseFloat(d3.select("#info-management-capacity").property("value"));
        const ecc = Math.round(rcc * managementCapacity);
        sel.select("#info-effective-carrying-capacity").text(ecc);
      });

      // add corrective factor
      sel.selectAll(".add-corrective-factor").on("click", function() {
        const computedKey = computeStorageKey(id_hash, CORRECTIVE_FACTORS_STORAGE_KEY);
        const correctiveFactors = JSON.parse(context.storage.get(computedKey));
        correctiveFactors.push({id: Math.round(Math.random() * 100), name: "Corrective Factor", value: 1});
        context.storage.set(computedKey, JSON.stringify(correctiveFactors));
        renderMetadata();
      });

      // remove corrective factor
      sel.selectAll(".corrective-factor i.delete-invert").on("click", function(_, i) {
        const computedKey = computeStorageKey(id_hash, CORRECTIVE_FACTORS_STORAGE_KEY);
        const correctiveFactors = JSON.parse(context.storage.get(computedKey));
        correctiveFactors.splice(i, 1);
        context.storage.set(computedKey, JSON.stringify(correctiveFactors));
        renderMetadata();
      });

      // change corrective factor's name
      sel.selectAll(".corrective-factor .cf-edit").on("click", function(_, i) {
        const parentElement = d3.select(this.parentNode);

        function toggleHide() {
          parentElement.selectAll("*").each(function() {
            const thisElement = d3.select(this);
            thisElement.classed("hide", !thisElement.classed("hide"));
          });  
        }
        toggleHide();

        function save() {
          const computedKey = computeStorageKey(id_hash, CORRECTIVE_FACTORS_STORAGE_KEY);
          const correctiveFactors = JSON.parse(context.storage.get(computedKey));
          correctiveFactors[i].name = parentElement.select("textarea").property("value");
          context.storage.set(computedKey, JSON.stringify(correctiveFactors));

          renderMetadata();
        }

        parentElement.select("i.fa-check").on("click", save);
        parentElement.select("textarea").on("keydown", function () {
          if(d3.event.key === "Enter") {
            save();
          }
        })
      });

      // change management capacity
      sel.selectAll("#info-management-capacity").on("input", function (_, i) {
        const areaPerPedestrian = parseFloat(sel.select("#info-area-per-pedestrian").property("value"));
        const areaUnit = context.metadata.areaUnit;
        const rotationFactor = parseFloat(sel.select("#info-rotation-factor").property("value"));
        const areaPerPedestrianInMeters = convertArea(areaPerPedestrian, areaUnit, areaUnits.SQUARE_METERS);
        const data = context.data.get('map');
        const feature = data.features[id];
        const id_hash = featureHash(feature);
        const walkableArea = context.metadata.areas[id_hash].meters;
        const pcc = walkableArea / areaPerPedestrianInMeters * rotationFactor;
        let rcc = pcc;
        sel.selectAll(".corrective-factor + div input").each(function() {
          rcc *= parseFloat(this.value)
        });
        const managementCapacity = parseFloat(d3.event.target.value);
        const ecc = Math.round(rcc * managementCapacity);
        sel.select("#info-effective-carrying-capacity").text(ecc);
        const computedKey = computeStorageKey(id_hash, MANAGEMENT_CAPACITY_STORAGE_KEY);
        context.storage.set(computedKey, managementCapacity);
      });
    }

    function uploadData(){
      const fileInput = document.getElementById('upload-geometries-input');
      
      fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        console.log(context)

        const reader = new FileReader();
        
        reader.onload = function(e) {
          context.storage.set("custom_features_" + id_hash, JSON.parse(e.target.result));
          console.log('File content:', e.target.result);
          sel.select("#custom-features-flag-"+id_hash).classed("hide", false);
        };

        reader.onerror = function(e) {
          console.error('Error reading file:', e);
        };

        reader.readAsText(file);
        fileInput.value = '';
      });
      fileInput.click()
    }

    function downloadGeoJSON() {
      const walkableAreaFeature = context.metadata.areas[id_hash].feature;
      const fileContent = JSON.stringify(walkableAreaFeature);
      const blob = new Blob([fileContent], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'walkable_area.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    function downloadCSV() {
      const {flattenBuildings, walkableRoads, unwalkableGrass} = context.metadata.areas[id_hash].options;

      const {areaPerPedestrian, rotationFactor, correctiveFactors, managementCapacity} = loadCarryingCapacityInputsFromStorage(id_hash);

      const unitName = context.metadata.areaUnit.name;
      const totalArea = area(feature);
      const totalAreaInSelectedUnit = convertArea(totalArea, areaUnits.SQUARE_METERS, context.metadata.areaUnit);
      const walkableArea = context.metadata.areas[id_hash].meters;
      const walkableAreaInSelectedUnit = convertArea(walkableArea, areaUnits.SQUARE_METERS, context.metadata.areaUnit);
      const areaPerPedestrianInSelectedUnit = convertArea(areaPerPedestrian, areaUnits.SQUARE_METERS, context.metadata.areaUnit);

      const walkableAreaPercent = walkableArea / totalArea * 100;
      const pcc = walkableArea / areaPerPedestrian * rotationFactor;
      let rcc = pcc;
      for(const {value} of correctiveFactors) {
        rcc *= value;
      }
      const ecc = managementCapacity * rcc;

      let csv =
`name,value,unit
removed private building areas,${flattenBuildings},
classify roads as walkable,${walkableRoads},
classify grass as unwalkable,${unwalkableGrass},
total area,${totalAreaInSelectedUnit.toFixed(2)},${unitName}
walkable area,${walkableAreaInSelectedUnit.toFixed(2)},${unitName}
walkable area,${walkableAreaPercent.toFixed(2)},%
area per pedestrian,${areaPerPedestrianInSelectedUnit},${unitName}
rotation factor,${rotationFactor},
pcc,${Math.round(pcc)},\n`;
      for(const {value, name} of correctiveFactors) {
        csv += `${name},${value},\n`;
      }
      csv +=
`rcc,${Math.round(rcc)},
management capacity,${managementCapacity},
ecc,${Math.round(ecc)},\n`;

      const blob = new Blob([csv], { type: 'text/csv' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'carrying_capacity_values.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    function clickClose() {
      e.target._onClose();
    }

    function removeFeature() {
      const data = context.data.get('map');
      data.features.splice(id, 1);

      context.data.set({ map: data }, 'popup');

      // hide the popup
      e.target._onClose();
    }

    function removeCustomFeatures() {
      const data = context.data.get('map');
      const feature = data.features[id];
      const id_hash = featureHash(feature);
      context.storage.set("custom_features_"+id_hash, null);
      console.log(context.storage.get("custom_features_"+id_hash));
      sel.select('#custom-features-flag-'+id_hash).classed("hide", true);
    }

    function losslessNumber(x) {
      const fl = parseFloat(x);
      if (fl.toString() === x) return fl;
      else return x;
    }

    function saveFeature() {
      const obj = {};
      const table = sel.select('table.marker-properties');
      table.selectAll('tr').each(collectRow);
      function collectRow() {
        if (d3.select(this).selectAll('input')[0][0].value) {
          obj[d3.select(this).selectAll('input')[0][0].value] = losslessNumber(
            d3.select(this).selectAll('input')[0][1].value
          );
        }
      }

      const data = context.data.get('map');
      const feature = data.features[id];
      feature.properties = obj;
      context.data.set({ map: data }, 'popup');
      // hide the popup
      e.target._onClose();
    }

    function addRow() {
      const tr = sel.select('table.marker-properties tbody').append('tr');

      tr.append('th').append('input').attr('type', 'text');

      tr.append('td').append('input').attr('type', 'text');
    }

    function addSimplestyleProperties() {
      // hide the button
      sel
        .selectAll('.add-simplestyle-properties-button')
        .style('display', 'none');

      const data = context.data.get('map');
      const feature = data.features[id];
      const { properties, geometry } = feature;

      if (geometry.type === 'Point' || geometry.type === 'MultiPoint') {
        if (!('marker-color' in properties)) {
          const tr = sel.select('table.marker-properties tbody').insert('tr');
          tr.append('th')
            .append('input')
            .attr('type', 'text')
            .attr('value', 'marker-color');
          tr.append('td')
            .append('input')
            .attr('type', 'color')
            .attr('value', '#7E7E7E');
        }

        if (!('marker-size' in properties)) {
          const tr = sel.select('table.marker-properties tbody').insert('tr');
          tr.append('th')
            .append('input')
            .attr('type', 'text')
            .attr('value', 'marker-size');
          const td = tr.append('td');
          td.append('input')
            .attr('type', 'text')
            .attr('value', 'medium')
            .attr('list', 'marker-size');
          const datalist = td.append('datalist').attr('id', 'marker-size');
          datalist.append('option').attr('value', 'small');
          datalist.append('option').attr('value', 'medium');
          datalist.append('option').attr('value', 'large');
        }

        if (!('marker-symbol' in properties)) {
          const tr = sel.select('table.marker-properties tbody').insert('tr');
          tr.append('th')
            .append('input')
            .attr('type', 'text')
            .attr('value', 'marker-symbol');
          const td = tr.append('td');
          td.append('input')
            .attr('type', 'text')
            .attr('value', 'circle')
            .attr('list', 'marker-symbol');
          const datalist = td.append('datalist').attr('id', 'marker-symbol');
          for (let i = 0; i < makiNames.length; i++) {
              datalist.append('option').attr('value', makiNames[i]);
          }
        }
      }
      if (
        geometry.type === 'LineString' ||
        geometry.type === 'MultiLineString' ||
        geometry.type === 'Polygon' ||
        geometry.type === 'MultiPolygon'
      ) {
        if (!('stroke' in properties)) {
          const tr = sel.select('table.marker-properties tbody').insert('tr');
          tr.append('th')
            .append('input')
            .attr('type', 'text')
            .attr('value', 'stroke');
          tr.append('td')
            .append('input')
            .attr('type', 'color')
            .attr('value', '#555555');
        }
        if (!('stroke-width' in properties)) {
          const tr = sel.select('table.marker-properties tbody').insert('tr');
          tr.append('th')
            .append('input')
            .attr('type', 'text')
            .attr('value', 'stroke-width');
          tr.append('td')
            .append('input')
            .attr('type', 'number')
            .attr('min', '0')
            .attr('step', '0.1')
            .attr('value', '2');
        }
        if (!('stroke-opacity' in properties)) {
          const tr = sel.select('table.marker-properties tbody').insert('tr');
          tr.append('th')
            .append('input')
            .attr('type', 'text')
            .attr('value', 'stroke-opacity');
          tr.append('td')
            .append('input')
            .attr('type', 'number')
            .attr('min', '0')
            .attr('max', '1')
            .attr('step', '0.1')
            .attr('value', '1');
        }
      }
      if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
        if (!('fill' in properties)) {
          const tr = sel.select('table.marker-properties tbody').insert('tr');
          tr.append('th')
            .append('input')
            .attr('type', 'text')
            .attr('value', 'fill');
          tr.append('td')
            .append('input')
            .attr('type', 'color')
            .attr('value', '#555555');
        }
        if (!('fill-opacity' in properties)) {
          const tr = sel.select('table.marker-properties tbody').insert('tr');
          tr.append('th')
            .append('input')
            .attr('type', 'text')
            .attr('value', 'fill-opacity');
          tr.append('td')
            .append('input')
            .attr('type', 'number')
            .attr('min', '0')
            .attr('max', '1')
            .attr('step', '0.1')
            .attr('value', '0.5');
        }
      }
    }
  };
};
