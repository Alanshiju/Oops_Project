package com.campus;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;

public class GeoUtils {

    private static final double EARTH_RADIUS_KM = 6371.0;
    private static final ObjectMapper MAPPER = new ObjectMapper();

    /**
     * Calculates the great-circle distance between two points on the Earth
     * using the Haversine formula.
     *
     * @param lat1 Latitude of point 1 in degrees
     * @param lon1 Longitude of point 1 in degrees
     * @param lat2 Latitude of point 2 in degrees
     * @param lon2 Longitude of point 2 in degrees
     * @return Distance between points in kilometers
     */
    public static double haversine(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);

        double a = Math.sin(dLat / 2.0) * Math.sin(dLat / 2.0)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                        * Math.sin(dLon / 2.0) * Math.sin(dLon / 2.0);

        double c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));
        return EARTH_RADIUS_KM * c;
    }

    /**
     * Calculates the shortest cross-track distance from a point to every line
     * segment forming the polyline route.
     *
     * @param pointLat          Latitude of the point
     * @param pointLng          Longitude of the point
     * @param routeGeometryJson JSON string representing coordinates array
     * @return Minimum distance found in kilometers, or Double.MAX_VALUE if invalid
     */
    public static double distanceToPolyline(double pointLat, double pointLng, String routeGeometryJson) {
        if (routeGeometryJson == null || routeGeometryJson.trim().isEmpty()) {
            return Double.MAX_VALUE;
        }

        try {
            JsonNode root = MAPPER.readTree(routeGeometryJson);
            if (!root.isArray() || root.size() == 0) {
                return Double.MAX_VALUE;
            }

            List<Coordinate> coords = new ArrayList<>();
            for (JsonNode node : root) {
                double lat = 0.0;
                double lng = 0.0;

                if (node.has("lat")) {
                    lat = node.get("lat").asDouble();
                } else if (node.has("latitude")) {
                    lat = node.get("latitude").asDouble();
                } else if (node.isArray() && node.size() >= 2) {
                    lat = node.get(0).asDouble();
                }

                if (node.has("lng")) {
                    lng = node.get("lng").asDouble();
                } else if (node.has("longitude")) {
                    lng = node.get("longitude").asDouble();
                } else if (node.isArray() && node.size() >= 2) {
                    lng = node.get(1).asDouble();
                }

                coords.add(new Coordinate(lat, lng));
            }

            return distanceToPolyline(pointLat, pointLng, coords);

        } catch (Exception e) {
            System.err.println("GeoUtils: Error parsing routeGeometryJson: " + e.getMessage());
            return Double.MAX_VALUE;
        }
    }

    /**
     * Calculates the shortest distance from a point to a polyline formed by a list
     * of Coordinates.
     *
     * @param pointLat Latitude of the point
     * @param pointLng Longitude of the point
     * @param coords   List of Coordinates forming the route
     * @return Minimum distance in kilometers
     */
    public static double distanceToPolyline(double pointLat, double pointLng, List<Coordinate> coords) {
        if (coords == null || coords.isEmpty()) {
            return Double.MAX_VALUE;
        }

        if (coords.size() == 1) {
            return haversine(pointLat, pointLng, coords.get(0).getLat(), coords.get(0).getLng());
        }

        double minDistance = Double.MAX_VALUE;
        for (int i = 0; i < coords.size() - 1; i++) {
            Coordinate a = coords.get(i);
            Coordinate b = coords.get(i + 1);
            double dist = distanceToSegment(pointLat, pointLng, a.getLat(), a.getLng(), b.getLat(), b.getLng());
            if (dist < minDistance) {
                minDistance = dist;
            }
        }

        return minDistance;
    }

    /**
     * Calculates the shortest distance from point P to line segment AB in
     * kilometers.
     */
    public static double distanceToSegment(double pLat, double pLng, double aLat, double aLng, double bLat,
            double bLng) {
        double midLatRad = Math.toRadians((aLat + bLat + pLat) / 3.0);
        double cosMid = Math.cos(midLatRad);

        // Convert coordinates to local flat Cartesian plane (km) with A as origin (0,
        // 0)
        double ax = 0.0;
        double ay = 0.0;

        double bx = Math.toRadians(bLng - aLng) * cosMid * EARTH_RADIUS_KM;
        double by = Math.toRadians(bLat - aLat) * EARTH_RADIUS_KM;

        double px = Math.toRadians(pLng - aLng) * cosMid * EARTH_RADIUS_KM;
        double py = Math.toRadians(pLat - aLat) * EARTH_RADIUS_KM;

        double vx = bx - ax;
        double vy = by - ay;

        double wx = px - ax;
        double wy = py - ay;

        double c1 = wx * vx + wy * vy;
        if (c1 <= 0) {
            // Projection falls before point A
            return haversine(pLat, pLng, aLat, aLng);
        }

        double c2 = vx * vx + vy * vy;
        if (c2 <= c1) {
            // Projection falls after point B
            return haversine(pLat, pLng, bLat, bLng);
        }

        // Projection falls strictly within segment AB
        double b = c1 / c2;
        double projX = ax + b * vx;
        double projY = ay + b * vy;

        return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
    }
}
