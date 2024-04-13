from flask import Flask, jsonify, request
from flask_cors import CORS
from polygon_scripts import create_walkable_area_polygons

app = Flask(__name__)
CORS(app)

@app.route('/usable_area', methods=['POST'])
def usable_area():
    feature = request.get_json()
    feature_with_usable_area = create_walkable_area_polygons([feature])[0]
    return jsonify(feature_with_usable_area)
