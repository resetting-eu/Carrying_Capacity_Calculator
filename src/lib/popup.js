const area = require('@turf/area').default;
const {createPopper, flip} = require('@popperjs/core');
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

    const data = context.data.get('map');
    const feature = data.features[id];
    const id_hash = featureHash(feature);
    
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
      const data = context.data.get('map');
      const feature = data.features[id];

      const button = sel.select(".calculate-carrying-capacity-button");
      button.classed("hide", true);

      const calculating = sel.select("#calculating");
      calculating.classed("hide", false);

      const id_hash = featureHash(feature);
      context.metadata.areas[id_hash] = {meters: "calculating"};

      fetch("http://localhost:5000/usable_area", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(feature)
      })
      .then(r => r.json())
      .then(j => {
        const walkable_meters = area(j);
        context.metadata.areas[id_hash] = {feature: j, meters: walkable_meters};
        
        calculating.classed("hide", true);

        expandMetadataWithCarryingCapacity(feature, walkable_meters);

        context.map.overlay.addFeature(context, id_hash);
      })
      .catch(e => {
        console.error(e);
        delete context.metadata.areas[id_hash];

        sel.selectAll(".metadata tr:not(:first-child)").remove();
        calculating.classed("hide", true);
        button.classed("hide", false);
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
        '<div class="right input"><input value="' + areaPerPedestrianInSelectedUnit + '" id="info-area-per-pedestrian"></input> <span class="info-area-unit">' + unitHTML + '</span></div>' +
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
        const pcc = Math.round(walkableArea / areaPerPedestrianInMeters * rotationFactor);
        sel.select("#info-physical-carrying-capacity").text(pcc);
        storeInStorage(id_hash, AREA_PER_PEDESTRIAN_STORAGE_KEY, areaPerPedestrianInMeters);
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
        const pcc = Math.round(walkableArea / areaPerPedestrianInMeters * rotationFactor);
        sel.select("#info-physical-carrying-capacity").text(pcc);
        storeInStorage(id_hash, ROTATION_FACTOR_STORAGE_KEY, rotationFactor);
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
        rcc = Math.round(rcc);
        sel.select("#info-real-carrying-capacity").text(rcc);
        const computedKey = computeStorageKey(id_hash, CORRECTIVE_FACTORS_STORAGE_KEY);
        const correctiveFactors = JSON.parse(context.storage.get(computedKey));
        correctiveFactors[i].value = parseFloat(d3.event.target.value);
        context.storage.set(computedKey, JSON.stringify(correctiveFactors));
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
