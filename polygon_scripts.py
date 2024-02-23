import json
import geopandas as gp
from shapely.geometry import shape
import area
import pprint
import pymongo as db
import utm
import math
from turfpy.transformation import intersect, circle, difference, union
from turfpy.measurement import area
from geojson import (Point, Polygon, Feature, LineString, FeatureCollection)
from geojson_rewind import rewind

pp = pprint.PrettyPrinter(indent=1)

# MONGO CONNECTION INIT
client = db.MongoClient("mongodb://localhost:27017/")

crowding_db = client["melbourne"]

osm = crowding_db["osm"]

# OSM Types collections
buildings = crowding_db["buildings"]
water = crowding_db["water"]
roads = crowding_db["roads"]
footways = crowding_db["footways"]
railways = crowding_db["railways"]
bridges = crowding_db["bridges"]

# Polygonized lines
road_polygons = crowding_db["road_polygons"]
rail_polygons = crowding_db["rail_polygons"]

sensors = crowding_db["sensors"]
crowding_polygons = crowding_db["crowding_polygons"]
usable_areas = crowding_db["usable_areas"]


def get_perpendicular_point_1_from_center_at_distance(m, b, center_x, center_y, d):
    x = (center_x - (m * b) + (center_y * m) +
         math.sqrt((d ** 2) * (m ** 2) - (m ** 2) * (center_x ** 2) + (2 * center_y * m * center_x) - (
                 2 * m * b * center_x) + (d ** 2) + (2 * center_y * b) - (center_y ** 2) - (b ** 2))) / \
        (1 + m ** 2)
    y = m * x + b
    return x, y


def get_perpendicular_point_2_from_center_at_distance(m, b, center_x, center_y, d):
    x = (center_x - (m * b) + (center_y * m) -
         math.sqrt((d ** 2) * (m ** 2) - (m ** 2) * (center_x ** 2) + (2 * center_y * m * center_x) - (
                 2 * m * b * center_x) + (d ** 2) + (2 * center_y * b) - (center_y ** 2) - (b ** 2))) / \
        (1 + m ** 2)
    y = m * x + b
    return x, y


def create_street_segment(start_x, start_y, end_x, end_y, step):
    # y = mx + b
    if start_x == end_x:
        m = 0
    elif start_y == end_y:
        m = 99999999999
    else:
        segment_m = (end_y - start_y) / (end_x - start_x)
        perpendicular_m = -1 / segment_m

    b = start_y - perpendicular_m * start_x

    point_1 = get_perpendicular_point_1_from_center_at_distance(perpendicular_m, b, start_x, start_y, 50)
    point_2 = get_perpendicular_point_2_from_center_at_distance(perpendicular_m, b, start_x, start_y, 50)

    perpendicular_line = LineString([[0, 0], [1, 0], [1, 1]])


def create_street_segments():
    pass


def calc_polygon_difference(polygon, subtracting_polygons):
    diff_polygon = polygon
    if len(subtracting_polygons) > 0:
        buffered_polygons = add_buffer_to_polygons(subtracting_polygons, 0.05)
        for subtracting_polygon in buffered_polygons:
            diff_polygon = difference(diff_polygon, subtracting_polygon)
    return diff_polygon


def calc_polygon_difference_bulk(polygon, subtracting_polygons):
    diff_union = union(FeatureCollection(subtracting_polygons))
    diff_union = add_buffer_to_polygons([diff_union], 0.05)
    diff_polygon = difference(polygon, diff_union[0])
    return diff_polygon


def create_walkable_area_polygons():
    cells = list(crowding_polygons.find({}))
    usable_areas.delete_many({})
    usable_areas_list = []
    for cell in cells:
        del cell["_id"]
        intersecting_buildings = list(buildings.find({
            "geometry": {
                "$geoIntersects": {
                    "$geometry": cell["geometry"]
                }
            }
        }))
        intersecting_water_bodies = list(water.find({
            "geometry": {
                "$geoIntersects": {
                    "$geometry": cell["geometry"]
                }
            }
        }))
        intersecting_roads = list(road_polygons.find({
            "geometry": {
                "$geoIntersects": {
                    "$geometry": cell["geometry"]
                }
            }
        }))
        intersecting_railways = list(rail_polygons.find({
            "geometry": {
                "$geoIntersects": {
                    "$geometry": cell["geometry"]
                }
            }
        }))
        intersecting_bridges = list(bridges.find({
            "geometry": {
                "$geoIntersects": {
                    "$geometry": cell["geometry"]
                }
            }
        }))

        intersecting_buildings = add_buffer_to_polygons(intersecting_buildings, 0.005)

        intersecting_water_bodies = add_buffer_to_polygons(intersecting_water_bodies, 1)

        water_with_bridges = []
        for w in intersecting_water_bodies:
            water_with_bridges.append(calc_polygon_difference(w, intersecting_bridges))

        low_level_unusable_polygons = intersecting_buildings + water_with_bridges

        high_level_unusable_polygons = intersecting_roads + intersecting_railways

        unusable_polygon_union = union(FeatureCollection(low_level_unusable_polygons))
        print(type(unusable_polygon_union))

        '''if len(intersecting_bridges) > 0:
            intersecting_bridges = add_buffer_to_polygons(intersecting_bridges, 0.05)
            unusable_polygon_union = calc_polygon_difference_bulk(unusable_polygon_union, intersecting_bridges)'''

        feature_collection = FeatureCollection(high_level_unusable_polygons)
        feature_collection.features.append(unusable_polygon_union)

        unusable_polygon_union = union(feature_collection)

        #unusable_polygon_union = add_buffer_to_polygons([unusable_polygon_union], 0.05)
        #usable_area_polygon = difference(cell, unusable_polygon_union[0])
        print(type(unusable_polygon_union))
        usable_area_polygon = calc_polygon_difference_bulk(cell, [unusable_polygon_union])

        #TODO Add bridge polygons (with buffer maybe)
        # If bridge polygon has footway or bicycle way, add to walkable area (minus road area)
        # Append footways after

        usable_areas_list.append(usable_area_polygon)

    usable_areas.insert_many(usable_areas_list)
    # f = open("crowding_polygons_with_usable_areas.json", "w")
    # f.write(json.dumps(cells))


def check_polygons_usable_area():
    cells = list(crowding_polygons.find({}))
    # crowding_polygons.delete_many({})
    usable_areas.delete_many({})
    usable_areas_list = []
    for cell in cells:
        del cell["_id"]
        intersecting_buildings = list(buildings.find({
            "geometry": {
                "$geoIntersects": {
                    "$geometry": cell["geometry"]
                }
            }
        }))
        intersecting_water_bodies = list(water.find({
            "geometry": {
                "$geoIntersects": {
                    "$geometry": cell["geometry"]
                }
            }
        }))
        intersecting_roads = list(road_polygons.find({
            "geometry": {
                "$geoIntersects": {
                    "$geometry": cell["geometry"]
                }
            }
        }))
        unusable_polygons = intersecting_buildings + intersecting_water_bodies + intersecting_roads


        unusable_area = 0
        for polygon in unusable_polygons:
            polygon_intersect = intersect([cell, polygon])
            intersect_area = area(polygon_intersect)
            unusable_area += intersect_area

        cell_area = area(cell)
        cell["properties"]["unusable_area"] = unusable_area
        cell["properties"]["usable_area"] = cell_area - unusable_area
        cell["properties"]["area"] = cell_area

    #usable_areas.insert_many(usable_areas_list)
    # f = open("crowding_polygons_with_usable_areas.json", "w")
    # f.write(json.dumps(cells))


def create_crowding_polygons_from_sensors():
    crowding_polygons.delete_many({})
    sensors_list = list(sensors.find({}))
    polygons_list = []
    for sensor in sensors_list:
        cc = circle(sensor, radius=0.27475, steps=30)
        polygons_list.append(cc)
    crowding_polygons.insert_many(polygons_list)


def dump_collection(collection):
    segments = list(collection.find({}))
    for segment in segments:
        del segment["_id"]
        segment["properties"]["lineColor"] = "#FF0000"
        segment["properties"]["color"] = "#FF0000"
    f = open("segments.json", "w")
    f.write(json.dumps(segments))

# Polygonization


def create_road_polygons():
    road_polygons.delete_many({})
    streets = list(roads.find())
    for s in streets:
        del s["_id"]
    roads_df = gp.GeoDataFrame(streets)
    roads_df["geometry"] = roads_df["geometry"].apply(shape)
    roads_df = roads_df.set_geometry("geometry").set_crs("WGS84")
    roads_df["geometry"] = roads_df["geometry"].to_crs("EPSG:32633")
    roads_df["geometry"] = roads_df["geometry"].buffer(roads_df["est_width"] / 2, cap_style=2)
    roads_df["geometry"] = roads_df["geometry"] = roads_df["geometry"].to_crs("WGS84")
    roads_json = roads_df.to_json()
    roads_dict = json.loads(roads_json)
    road_polygons.insert_many(roads_dict["features"])


def create_railway_polygons():
    AVG_RAIL_WIDTH = 3
    rails = list(railways.find())
    for s in rails:
        del s["_id"]
    print("Creating buffered polygons...")
    polygons = add_buffer_to_polygons(rails, AVG_RAIL_WIDTH)
    print("Inserting polygons...")

    rail_polygons.delete_many({})
    rail_polygons.insert_many(polygons)


def add_buffer_to_polygons(polygons, buffer):
    for p in polygons:
        if "_id" in p:
            del p["_id"]
    if len(polygons) == 0:
        return polygons
    roads_df = gp.GeoDataFrame(polygons)
    roads_df["geometry"] = roads_df["geometry"].apply(shape)
    roads_df = roads_df.set_geometry("geometry").set_crs("WGS84")
    roads_df["geometry"] = roads_df["geometry"].to_crs("EPSG:32633")
    roads_df["geometry"] = roads_df["geometry"].buffer(buffer, cap_style=2)
    roads_df["geometry"] = roads_df["geometry"] = roads_df["geometry"].to_crs("WGS84")
    roads_json = roads_df.to_json()
    roads_dict = json.loads(roads_json)
    return roads_dict["features"]

# OSM COLLECTION FILTERING/CREATION


def create_buildings_collection():
    buildings_list = list(osm.find({
        "properties.building": {"$exists": True},
        "geometry.type": {"$regex": "Polygon"},
    }))
    buildings.delete_many({})
    for building in buildings_list:
        geometry = building["geometry"]
        if geometry["type"] == "MultiPolygon":
            geometry["type"] = "Polygon"
            max_area = 0
            for polygon_coordinates in geometry["coordinates"]:
                geojson = {"type": "Feature", "geometry": {"type": "Polygon", "coordinates": polygon_coordinates}}
                if area(geojson) > max_area:
                    geometry["coordinates"] = polygon_coordinates

    buildings.insert_many(buildings_list)
    buildings.delete_many({"properties.layer": "-1"})


def create_water_collection():
    water_list = list(osm.find(
        {
            "geometry.type": {"$regex": "Polygon"},
            "properties.natural": "water",
        }
    ))
    print(f"Water collection size: {len(water_list)}")
    water.delete_many({})
    water.insert_many(water_list)


def create_footways_collection():
    footway_list = list(osm.find(
        {
            "properties.highway": {"$exists": True},
            "geometry.type": "LineString",
            "$or": [
                {"properties.highway": "pedestrian"},
                {"properties.highway": "footway"},
                {"properties.highway": "steps"},
            ],
        }
    ))
    footways.delete_many({})
    footways.insert_many(footway_list)


def create_railway_collection():
    railway_list = list(osm.find(
        {"$and":
            [
                {"properties.railway": {"$exists": True}},
                {"properties.railway": {"$ne": "razed"}},
                {"geometry.type": "LineString"},
            ]
        }
    ))
    print(f"Number of railways: {len(railway_list)}")
    railways.delete_many({})
    railways.insert_many(railway_list)


def create_bridges_collection():
    bridges_list = list(osm.find(
        {
            "geometry.type": {"$regex": "Polygon"},
            "properties.man_made": "bridge",
        }
    ))
    bridges.delete_many({})
    bridges.insert_many(bridges_list)


def create_roads_collection():
    average_lane_width = 3  # METERS
    parallel_parking_width = 2  # METERS
    diagonal_parking_width = 5  # METERS

    roads_list = list(osm.find(
        {"$and":
            [
                {"properties.highway": {"$exists": True}},
                {"properties.highway": {"$ne": "pedestrian"}},
                {"properties.highway": {"$ne": "footway"}},
                {"properties.highway": {"$ne": "steps"}},
                {"properties.highway": {"$ne": "cycleway"}},
                {"properties.highway": {"$ne": "path"}},
                {"geometry.type": "LineString"},
            ]
        }
    ))

    for road in roads_list:

        num_lanes = int(road.get("properties").get("lanes", 1))
        num_bus_lanes = int(road.get("properties").get("lanes:bus", 0))
        est_width = (num_lanes + num_bus_lanes) * average_lane_width

        # ---- PARKING ---------
        has_parking_data = False

        if "parking:lane:left" in road:
            has_parking_data = True
            if road["parking:lane:left"] == "parallel":
                est_width += parallel_parking_width
            else:
                est_width += diagonal_parking_width
        if "parking:lane:right" in road:
            has_parking_data = True
            if road["parking:lane:right"] == "parallel":
                est_width += parallel_parking_width
            else:
                est_width += diagonal_parking_width
        if "parking:lane:both" in road:
            has_parking_data = True
            if road["parking:lane:both"] == "parallel":
                est_width += parallel_parking_width * 2
            else:
                est_width += diagonal_parking_width * 2
        if "parking:lane:left" in road:
            has_parking_data = True
            if road["parking:lane:left"] == "parallel":
                est_width += parallel_parking_width
            else:
                est_width += diagonal_parking_width

        road["est_width"] = est_width

    roads.delete_many({})
    roads.insert_many(roads_list)

# "Poligonization" functions


def create_geo_indexes():
    buildings.create_index([("geometry", "2dsphere")])
    water.create_index([("geometry", "2dsphere")])
    roads.create_index([("geometry", "2dsphere")])
    footways.create_index([("geometry", "2dsphere")])
    railways.create_index([("geometry", "2dsphere")])
    bridges.create_index([("geometry", "2dsphere")])

    road_polygons.create_index([("geometry", "2dsphere")])
    rail_polygons.create_index([("geometry", "2dsphere")])


def create_osm_collections():
    create_buildings_collection()
    create_water_collection()
    create_roads_collection()
    create_footways_collection()
    create_bridges_collection()
    create_railway_collection()

    create_road_polygons()
    create_railway_polygons()


def dump_collection_in_bounds(collection, bounds_file, filename):
    f = open(f"bounds/{bounds_file}.json")
    bounds = json.load(f)
    filtered_collection = list(collection.find({
        "geometry": {
            "$geoIntersects": {
                "$geometry": bounds["geometry"]
            }
        }
    }))

    for feature in filtered_collection:
        del feature["_id"]

    f = open(f"dumps/{filename}.json", "w")
    feature_collection = FeatureCollection(filtered_collection)
    f.write(json.dumps(feature_collection))


def filter_collection_in_bounds(collection, bounds_file):
    f = open(f"bounds/{bounds_file}.json")
    bounds = json.load(f)
    filtered_collection = list(collection.find({
        "geometry": {
            "$geoIntersects": {
                "$geometry": bounds["geometry"]
            }
        }
    }))

    collection.delete_many({})
    collection.insert_many({})


if __name__ == '__main__':
    # create_osm_collections()
    # create_geo_indexes()
    # create_crowding_polygons_from_sensors()
    # check_polygons_usable_area()
    # create_water_collection()
    create_walkable_area_polygons()

    # create_railway_collection()
    # create_railway_polygons()

    #dump_collection_in_bounds(rail_polygons, "melbourne_municipality", "railway_polygons")
