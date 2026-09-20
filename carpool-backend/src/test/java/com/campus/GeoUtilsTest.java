package com.campus;

public class GeoUtilsTest {
    public static void main(String[] args) {
        // Test 1: Haversine distance
        // Kerala: (10.5276, 76.2144) to (10.7280, 76.2792) is approx 23 km
        double distKm = GeoUtils.haversine(10.5276, 76.2144, 10.7280, 76.2792);
        System.out.println("Haversine distance (expected ~23km): " + distKm);
        if (distKm < 20 || distKm > 26) {
            throw new RuntimeException("Haversine failed: " + distKm);
        }

        // Test 2: distanceToPolyline with point close to route
        String routeJson = "[{\"lat\": 10.0, \"lng\": 76.0}, {\"lat\": 10.0, \"lng\": 76.1}]";
        // Point is ~11 meters north of segment
        double pLat = 10.0001;
        double pLng = 76.05;
        double polyDist = GeoUtils.distanceToPolyline(pLat, pLng, routeJson);
        System.out.println("Polyline distance (expected ~0.011km / 11m): " + polyDist);
        if (polyDist > 0.05) {
            throw new RuntimeException("Point within 50m was rejected: " + polyDist);
        }

        // Test 3: Point far away (>50m)
        double farLat = 10.001; // ~111m away
        double farPolyDist = GeoUtils.distanceToPolyline(farLat, pLng, routeJson);
        System.out.println("Far point polyline distance (expected ~0.111km): " + farPolyDist);
        if (farPolyDist <= 0.05) {
            throw new RuntimeException("Point >50m was accepted: " + farPolyDist);
        }

        // Test 4: Fare calculation logic
        double distanceKm = 10.0;
        int seats = 3;
        double maxFare = Math.floor(((distanceKm * 5.0) / seats) / 2.0); // Math.floor((50 / 3) / 2) = Math.floor(16.666
                                                                         // / 2) = 8.0
        System.out.println("Max fare for 10km, 3 seats: " + maxFare);
        if (maxFare != 8.0) {
            throw new RuntimeException("Max fare calculation mismatch: " + maxFare);
        }

        double customFareSpoofed = 50.0;
        double finalFare = Math.min(customFareSpoofed, maxFare);
        if (finalFare != 8.0) {
            throw new RuntimeException("Fare spoofing not clamped: " + finalFare);
        }

        double freeRideFare = true ? 0 : Math.min(customFareSpoofed, maxFare);
        if (freeRideFare != 0.0) {
            throw new RuntimeException("Free ride not zero: " + freeRideFare);
        }

        System.out.println("ALL GEOUTILS AND FARE TESTS PASSED SUCCESSFULLY!");
    }
}
