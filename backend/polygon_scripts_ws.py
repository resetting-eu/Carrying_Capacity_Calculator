from flask import Flask, jsonify, request
from flask_cors import CORS
from polygon_scripts import check_polygons_usable_area

app = Flask(__name__)
CORS(app)

@app.route('/usable_area', methods=['POST'])
def usable_area():
    feature = request.get_json()
    feature_with_usable_area = check_polygons_usable_area([feature])[0]
    usable_area_value = feature_with_usable_area["properties"]["usable_area"]
    return jsonify({'usable_area': usable_area_value})
