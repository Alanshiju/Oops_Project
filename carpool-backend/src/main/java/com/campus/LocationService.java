package com.campus;

import java.util.List;

public class LocationService {

    private static final int EARTH_RADIUS_METERS = 6371000;
    private static final double MATCH_THRESHOLD_METERS = 50.0; // Tightened to 50 meters!

    /**
     * Checks if a passenger's location falls within 50m of the driver's custom
     * route.
     */
    public boolean isPassengerOnRoute(Coordinate passengerLoc, List<Coordinate> driverRoute) {
        if (driverRoute == null || driverRoute.size() < 2)
            return false;

        // Bounding Box Pre-filter
        double minLat = Double.MAX_VALUE;
        double maxLat = -Double.MAX_VALUE;
        double minLng = Double.MAX_VALUE;
        double maxLng = -Double.MAX_VALUE;

        for (Coordinate coord : driverRoute) {
            if (coord.getLat() < minLat)
                minLat = coord.getLat();
            if (coord.getLat() > maxLat)
                maxLat = coord.getLat();
            if (coord.getLng() < minLng)
                minLng = coord.getLng();
            if (coord.getLng() > maxLng)
                maxLng = coord.getLng();
        }

        minLat -= 0.0005;
        maxLat += 0.0005;
        minLng -= 0.0005;
        maxLng += 0.0005;

        if (passengerLoc.getLat() < minLat || passengerLoc.getLat() > maxLat ||
                passengerLoc.getLng() < minLng || passengerLoc.getLng() > maxLng) {
            return false; // Skip heavy planar math
        }

        for (int i = 0; i < driverRoute.size() - 1; i++) {
            Coordinate startNode = driverRoute.get(i);
            Coordinate endNode = driverRoute.get(i + 1);

            double distanceToSegment = getDistanceToSegment(passengerLoc, startNode, endNode);

            if (distanceToSegment <= MATCH_THRESHOLD_METERS) {
                return true; // Match found! Passenger is within 50m of this specific road segment.
            }
        }
        return false;
    }

    /**
     * Calculates the shortest distance from a point to a finite line segment.
     * Optimized using planar projection for short distances (avoids expensive
     * trig).
     */
    private double getDistanceToSegment(Coordinate point, Coordinate start, Coordinate end) {
        double d13 = haversine(start, point); // Distance to start node
        double d23 = haversine(end, point); // Distance to end node
        double d12 = haversine(start, end); // Length of the segment

        // If the segment is basically a single point
        if (d12 == 0)
            return d13;

        // Project the passenger point onto the line segment using the Law of Cosines
        double t = (d13 * d13 - d23 * d23 + d12 * d12) / (2 * d12);

        if (t <= 0) {
            // Passenger is behind the start node
            return d13;
        } else if (t >= d12) {
            // Passenger is past the end node
            return d23;
        } else {
            // Passenger is alongside the segment. Calculate perpendicular cross-track
            // distance.
            double crossTrackSq = d13 * d13 - t * t;
            return crossTrackSq > 0 ? Math.sqrt(crossTrackSq) : 0;
        }
    }

    /**
     * Calculates distance between two lat/lng points in meters.
     */
    public static double calculateDistance(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                        Math.sin(dLng / 2) * Math.sin(dLng / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_METERS * c;
    }

    /**
     * The Haversine Formula: Calculates great-circle distance between two points on
     * Earth.
     */
    private double haversine(Coordinate c1, Coordinate c2) {
        return calculateDistance(c1.getLat(), c1.getLng(), c2.getLat(), c2.getLng());
    }

    /**
     * Constraint 2: Calculates live ETA in minutes to a student pickup point.
     * Applies a tortuosity factor of 1.4 to account for road curvature at an
     * average speed of 30 km/h.
     * Bounded to a minimum of 1 minute (never 0 or negative).
     */
    public static int calculateLiveEtaMinutes(double driverLat, double driverLng, double studentLat,
            double studentLng) {
        double distMeters = calculateDistance(driverLat, driverLng, studentLat, studentLng);
        double distKmWithTortuosity = (distMeters / 1000.0) * 1.4;
        double etaMinutes = (distKmWithTortuosity / 30.0) * 60.0;
        return (int) Math.max(1, Math.round(etaMinutes));
    }
}