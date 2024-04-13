const mapboxgl = require("mapbox-gl")

const data = require("./my_layer_data");

const earcut = require("earcut");

function geojsonToBuffers(geojson) {
  console.assert(geojson.type === "FeatureCollection");
  
  if(geojson.features?.length === 0)
    return null;

  // TODO investigar vantagens em usar earcut.flatten()
  const polygonFeature = geojson.features[0];
  console.assert(polygonFeature.geometry.type === "Polygon");
  const coordinates = polygonFeature.geometry.coordinates[0];
  const vertices = [];
  for(let i = 0; i < coordinates.length - 1; ++i) { // don't include repeating vertex
    const [lng, lat] = coordinates[i];
    const {x, y} = mapboxgl.MercatorCoordinate.fromLngLat({lng, lat});
    vertices.push(x, y);
  }
  const triangles = earcut(vertices);
  const triangleVertices = [];
  for(const vertexIndex of triangles) {
    const x = vertices[vertexIndex * 2];
    const y = vertices[vertexIndex * 2 + 1];
    triangleVertices.push(x, y);
  }
  return {
    triangleVertices: new Float32Array(triangleVertices),
    polygonVertices: new Float32Array(vertices)
  };
}

const {triangleVertices, polygonVertices} = geojsonToBuffers(data);
const nVertices = polygonVertices.length;
console.log(polygonVertices); // TODO REMOVE

// creates linear function that maps zoom level to amount of pixel distance to the edges
// for the gradient effect in the fragment shader
function zoomToPixelsFactory(zoom1, pixels1, zoom2, pixels2) {
  const m = (pixels2 - pixels1) / (zoom2 - zoom1);
  const b = pixels1 - m * zoom1;
  const f = zoom => m * zoom + b;
  return f;
}

//const zoomToPixels = zoomToPixelsFactory(17, 15, 18, 20); // TODO adjust values so it looks good
// const zoomToPixels = zoomToPixelsFactory(17, 15, 22, 400);
const zoomToPixels = zoomToPixelsFactory(18, 15, 22, 400);

const MyLayer = {
  id: "my-layer",
  type: "custom",
  onAdd: function(map, gl) {
    this.map = map;

    const vertexSource = `#version 300 es

      uniform mat4 u_matrix;
      in vec2 a_pos;
      void main() {
        gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
      }`;
    const fragmentSource = `#version 300 es

      precision highp float;

      const int nVertices = ${nVertices};

      uniform mat4 u_matrix;
      uniform vec2 vertices[nVertices];
      uniform float screenWidth;
      uniform float screenHeight;
      uniform float distanceCutoff;

      out vec4 fragColor;

      float distancePointToLineSegment(vec2 point, vec2 segmentStart, vec2 segmentEnd) {
        vec2 segmentDirection = normalize(segmentEnd - segmentStart);
        float segmentLength = distance(segmentStart, segmentEnd);
        vec2 pointToStart = point - segmentStart;
        float t = dot(pointToStart, segmentDirection);
        
        if (t <= 0.0) {
            return distance(point, segmentStart); // Closest to start point
        }
        else if (t >= segmentLength) {
            return distance(point, segmentEnd); // Closest to end point
        }
        else {
            vec2 closestPointOnSegment = segmentStart + segmentDirection * t;
            return distance(point, closestPointOnSegment);
        }
      }

      float distanceToAlpha(float dist) {
        if(dist > distanceCutoff) {
          return 0.8;
        } else {
          float a = dist / distanceCutoff;
          return mix(0.3, 0.8, a);  
        }
      }

      vec2 vertexToFragCoord(vec2 v) {
        // TODO usar multiplicação de vetor por matriz
        vec4 vp = u_matrix * vec4(v.x, v.y, 0.0, 1.0);
        return vec2((vp.x + 1.0) * screenWidth / 2.0 + 0.5, (vp.y + 1.0) * screenHeight / 2.0 + 0.5);
      }

      void main() {
        float min_dist = 1e20;
        for(int i = 0; i < nVertices; ++i) {
          vec2 v0 = vertexToFragCoord(vertices[i]);
          vec2 v1 = vertexToFragCoord(vertices[(i + 1) % nVertices]);
          float dist = distancePointToLineSegment(gl_FragCoord.xy, v0, v1);
          if(dist < min_dist) {
            min_dist = dist;
          }
        }

        float alpha = distanceToAlpha(min_dist);

        fragColor = vec4(1.0, 0.0, 0.0, alpha);
      }`;
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);

    // create a fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);

    // link the two shaders into a WebGL program
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    this.aPos = gl.getAttribLocation(this.program, 'a_pos');

    // create and initialize a WebGLBuffer to store vertex and color data
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      triangleVertices,
      gl.STATIC_DRAW
    );
  },

  render: function (gl, matrix) {
    gl.useProgram(this.program);
    

    gl.uniformMatrix4fv(
      gl.getUniformLocation(this.program, 'u_matrix'),
      false,
      matrix
    );

    gl.uniform2fv(
      gl.getUniformLocation(this.program, "vertices"),
      polygonVertices
    );

    let viewport = gl.getParameter(gl.VIEWPORT);
    let screenWidth = viewport[2];
    let screenHeight = viewport[3];
    gl.uniform1f(
      gl.getUniformLocation(this.program, "screenWidth"),
      screenWidth
    );
    gl.uniform1f(
      gl.getUniformLocation(this.program, "screenHeight"),
      screenHeight
    );

    const distanceCutoff = zoomToPixels(this.map.getZoom());
    gl.uniform1f(
      gl.getUniformLocation(this.program, "distanceCutoff"),
      distanceCutoff
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.drawArrays(gl.TRIANGLES, 0, triangleVertices.length / 2);
  }

};

module.exports = MyLayer;
