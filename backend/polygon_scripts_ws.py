import sys

from flask import Flask, jsonify, request
from flask_cors import CORS

from geojson import Feature, FeatureCollection, Polygon
from turfpy.measurement import bbox, bbox_polygon
from turfpy.transformation import union, difference, intersect
import overpass
from osm2geojson import xml2geojson

from polygon_scripts import create_walkable_area_polygons, create_osm_collections, create_geo_indexes, crowding_db, osm

app = Flask(__name__)
CORS(app)

overpass_api = overpass.API()

bboxes_collection = crowding_db["bboxes"]

FEATURE_MAX_AREA = 200 * 200
BOUNDING_BOXES_MAX_AREA = FEATURE_MAX_AREA * 10

# TODO:
# - removal of old items in cache
# - use transactions

def load_feature_bbox(feature):
    bbox_feature = bbox_polygon(bbox(feature))
    existing_bboxes = bboxes_collection.find({})
    bboxes_features_intersecting = []
    for existing_bbox in existing_bboxes:
        del existing_bbox["_id"]
        intersection = intersect([existing_bbox, bbox_feature])
        if intersection:
            bboxes_features_intersecting.append(existing_bbox)

    if len(bboxes_features_intersecting) == 0:
        diff = bbox_feature
    else:
        diff = difference(bbox_feature, union(FeatureCollection(bboxes_features_intersecting)))

    if diff:
        print("new bbox", file=sys.stderr)
        print(diff, file=sys.stderr)
        new_bbox = bbox(diff)
        insert_new_bbox(new_bbox)
    else:
        print("existing bbox", file=sys.stderr)

def insert_new_bbox(new_bbox):
    new_bbox_ordered = [new_bbox[1], new_bbox[0], new_bbox[3], new_bbox[2]]
    bbox_str = ",".join(map(lambda c: str(c), new_bbox_ordered))
    query = f"way({bbox_str});(._;>;)"
    new_osm_xml = overpass_api.get(query, responseformat="xml") # TODO handle errors
    new_osm = xml2geojson(new_osm_xml)
    for feature in new_osm["features"]:
        if "tags" in feature["properties"]:
            tags = feature["properties"]["tags"]
            for tag in tags:
                feature["properties"][tag] = feature["properties"]["tags"][tag]
    if len(new_osm["features"]) > 0:
        osm.insert_many(new_osm["features"])
        create_osm_collections()
        create_geo_indexes()
        bboxes_collection.insert_one(bbox_to_feature(new_bbox))

def bbox_to_feature(bbox):
    min_lon, min_lat, max_lon, max_lat = bbox
    coordinates = [[
        [min_lon, min_lat],
        [min_lon, max_lat],
        [max_lon, max_lat],
        [max_lon, min_lat],
        [min_lon, min_lat]
    ]]

    return Feature(geometry=Polygon(coordinates))

@app.route('/usable_area', methods=['POST'])
def usable_area():
    feature = request.get_json()
    load_feature_bbox(feature)
    feature_with_usable_area = create_walkable_area_polygons([feature])[0]
    return jsonify(feature_with_usable_area)
