package com.campus;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class RideDAO {

    // 1. Method to Post a New Ride
    public boolean createRide(Ride ride) {
        String sql = "INSERT INTO Rides (driver_id, origin_lat, origin_lng, dest_lat, dest_lng, departure_time, total_seats, available_seats) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setInt(1, ride.getDriverId());
            pstmt.setDouble(2, ride.getOriginLat());
            pstmt.setDouble(3, ride.getOriginLng());
            pstmt.setDouble(4, ride.getDestLat());
            pstmt.setDouble(5, ride.getDestLng());
            // Hardcoding a time for testing purposes right now
            pstmt.setString(6, "2026-10-01 08:00:00");
            pstmt.setInt(7, ride.getTotalSeats());
            pstmt.setInt(8, ride.getAvailableSeats());

            int rows = pstmt.executeUpdate();
            return rows > 0;

        } catch (SQLException e) {
            System.err.println("Error: " + e.getMessage());
            return false;
        }
    }

    // 2. Method to Book a Seat (The Core Logic)
    public boolean bookSeatInDatabase(int rideId, int passengerId) {
        return bookSeatInDatabase(rideId, passengerId, null, null);
    }

    public boolean bookSeatInDatabase(int rideId, int passengerId, Double pickupLat, Double pickupLng) {
        // Step A: Check if seats are available with pessimistic row locking (MySQL FOR
        // UPDATE)
        String checkSeatsSql = "SELECT available_seats FROM Rides WHERE ride_id = ? FOR UPDATE";
        String updateRideSql = "UPDATE Rides SET available_seats = available_seats - 1 WHERE ride_id = ? AND available_seats > 0";
        // Step B: Record the booking
        String insertBookingSql = "INSERT INTO Bookings (ride_id, passenger_id, booking_status, pickup_lat, pickup_lng) VALUES (?, ?, 'PENDING', ?, ?)";

        try (Connection conn = DatabaseConnection.getConnection()) {
            // Disable auto-commit to treat as a single transaction with pessimistic locking
            conn.setAutoCommit(false);

            try (PreparedStatement checkStmt = conn.prepareStatement(checkSeatsSql);
                    PreparedStatement updateStmt = conn.prepareStatement(updateRideSql);
                    PreparedStatement insertStmt = conn.prepareStatement(insertBookingSql)) {

                // Step A: Acquire exclusive row lock and verify seats
                checkStmt.setInt(1, rideId);
                try (ResultSet rs = checkStmt.executeQuery()) {
                    if (!rs.next() || rs.getInt("available_seats") <= 0) {
                        conn.rollback();
                        return false;
                    }
                }

                // Step B: Decrement seat
                updateStmt.setInt(1, rideId);
                int updatedRows = updateStmt.executeUpdate();

                if (updatedRows == 0) {
                    // Ride was full or not found! Rollback any changes.
                    conn.rollback();
                    return false;
                }

                // Step C: Record the booking
                insertStmt.setInt(1, rideId);
                insertStmt.setInt(2, passengerId);
                if (pickupLat != null) {
                    insertStmt.setDouble(3, pickupLat);
                } else {
                    insertStmt.setNull(3, java.sql.Types.DOUBLE);
                }
                if (pickupLng != null) {
                    insertStmt.setDouble(4, pickupLng);
                } else {
                    insertStmt.setNull(4, java.sql.Types.DOUBLE);
                }
                insertStmt.executeUpdate();

                // If all succeeded, commit the changes permanently
                conn.commit();
                return true;

            } catch (SQLException ex) {
                conn.rollback(); // Undo everything if something broke
                throw ex;
            }
        } catch (SQLException e) {
            System.err.println("Error: " + e.getMessage());
            return false;
        }
    }

    // Constraint 1: WKT Axis Reversal in Java
    // Converts MySQL's WKT LINESTRING(X Y, ...) where X=longitude, Y=latitude
    // into Coordinate objects with lat=Y, lng=X for the frontend.
    public static List<Coordinate> parseLineStringToCoordinates(String wkt) {
        List<Coordinate> coordinates = new ArrayList<>();
        if (wkt == null || !wkt.toUpperCase().startsWith("LINESTRING(") || !wkt.endsWith(")")) {
            return coordinates;
        }
        try {
            int startIdx = wkt.indexOf('(') + 1;
            int endIdx = wkt.lastIndexOf(')');
            String pointsStr = wkt.substring(startIdx, endIdx).trim();
            String[] pairs = pointsStr.split(",");
            for (String pair : pairs) {
                String[] parts = pair.trim().split("\\s+");
                if (parts.length >= 2) {
                    double lng = Double.parseDouble(parts[0]); // X = Longitude
                    double lat = Double.parseDouble(parts[1]); // Y = Latitude
                    // Strictly maps to Coordinate(lat=Y, lng=X)
                    coordinates.add(new Coordinate(lat, lng));
                }
            }
        } catch (Exception e) {
            System.err.println("Error parsing LINESTRING WKT with axis reversal: " + e.getMessage());
        }
        return coordinates;
    }

    public boolean saveRouteDetails(int rideId, String routeJson, double distanceKm, boolean isFreeRide) {
        return saveRouteDetails(rideId, routeJson, distanceKm, isFreeRide, 0);
    }

    public boolean saveRouteDetails(int rideId, String routeJson, double distanceKm, boolean isFreeRide,
            int estimatedDurationMins) {
        return saveRouteDetails(rideId, routeJson, distanceKm, isFreeRide, estimatedDurationMins, null);
    }

    public boolean saveRouteDetails(int rideId, String routeJson, double distanceKm, boolean isFreeRide,
            int estimatedDurationMins, Double customCost) {
        // Constraint 1: Strictly enforce Longitude Latitude order (e.g.,
        // LINESTRING(76.21 10.52, 76.22 10.53))
        String linestringWkt = null;
        try {
            ObjectMapper mapper = new ObjectMapper();
            List<Coordinate> coords = mapper.readValue(routeJson, new TypeReference<List<Coordinate>>() {
            });
            if (coords != null && coords.size() >= 2) {
                StringBuilder sb = new StringBuilder("LINESTRING(");
                for (int i = 0; i < coords.size(); i++) {
                    Coordinate c = coords.get(i);
                    sb.append(c.getLng()).append(" ").append(c.getLat());
                    if (i < coords.size() - 1) {
                        sb.append(", ");
                    }
                }
                sb.append(")");
                linestringWkt = sb.toString();
            }
        } catch (Exception e) {
            System.err.println("Error constructing LINESTRING WKT: " + e.getMessage());
        }

        ensureFareColumnExists();
        int availableSeats = getAvailableSeats(rideId);
        if (availableSeats <= 0)
            availableSeats = 1; // Prevent division by zero

        double maxFare = Math.floor(((distanceKm * 5.0) / availableSeats) / 2.0);
        double finalFare = isFreeRide ? 0.0
                : (customCost != null ? Math.min(customCost, maxFare) : maxFare);
        if (finalFare < 0.0)
            finalFare = 0.0;

        String sql = (linestringWkt != null)
                ? "UPDATE Rides SET route_geometry = ?, distance_km = ?, cost_per_seat = ?, fare = ?, is_free_ride = ?, estimated_duration_mins = ?, route_linestring = ST_GeomFromText(?, 4326) WHERE ride_id = ?"
                : "UPDATE Rides SET route_geometry = ?, distance_km = ?, cost_per_seat = ?, fare = ?, is_free_ride = ?, estimated_duration_mins = ? WHERE ride_id = ?";

        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setString(1, routeJson);
            pstmt.setDouble(2, distanceKm);
            pstmt.setDouble(3, finalFare);
            pstmt.setDouble(4, finalFare);
            pstmt.setBoolean(5, isFreeRide);
            pstmt.setInt(6, estimatedDurationMins);
            if (linestringWkt != null) {
                pstmt.setString(7, linestringWkt);
                pstmt.setInt(8, rideId);
            } else {
                pstmt.setInt(7, rideId);
            }

            int rows = pstmt.executeUpdate();
            return rows > 0;

        } catch (SQLException e) {
            System.err.println("Error: " + e.getMessage());
            return false;
        }
    }

    // 4. Method to get all active rides for spatial matching
    public List<Ride> getAllActiveRides() {
        List<Ride> activeRides = new ArrayList<>();
        // Only fetch rides that actually have seats and a valid route saved
        String sql = "SELECT r.ride_id, r.driver_id, r.total_seats, r.available_seats, r.route_geometry, " +
                "r.status, r.distance_km, r.cost_per_seat, r.is_free_ride, " +
                "u.name AS driver_name, v.make, v.model, v.license_plate, v.color " +
                "FROM Rides r " +
                "JOIN Users u ON r.driver_id = u.user_id " +
                "LEFT JOIN Vehicles v ON u.user_id = v.user_id " +
                "WHERE r.available_seats > 0 AND r.route_geometry IS NOT NULL " +
                "AND (r.status IN ('PENDING', 'IN_TRANSIT') OR r.status IS NULL)";

        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql);
                ResultSet rs = pstmt.executeQuery()) {

            ObjectMapper mapper = new ObjectMapper();

            while (rs.next()) {
                Ride ride = new Ride();
                ride.setRideId(rs.getInt("ride_id"));
                ride.setDriverId(rs.getInt("driver_id"));
                ride.setTotalSeats(rs.getInt("total_seats"));
                ride.setAvailableSeats(rs.getInt("available_seats"));

                ride.setDriverName(rs.getString("driver_name"));
                ride.setVehicleMake(rs.getString("make"));
                ride.setVehicleModel(rs.getString("model"));
                ride.setLicensePlate(rs.getString("license_plate"));
                ride.setCarColor(rs.getString("color"));

                ride.setStatus(rs.getString("status"));
                ride.setDistanceKm(rs.getDouble("distance_km"));
                ride.setCostPerSeat(rs.getDouble("cost_per_seat"));
                ride.setFreeRide(rs.getBoolean("is_free_ride"));

                // Convert the raw JSON string back into a Java List<Coordinate>
                String jsonGeometry = rs.getString("route_geometry");
                List<Coordinate> geometry = mapper.readValue(jsonGeometry, new TypeReference<List<Coordinate>>() {
                });
                ride.setRouteGeometry(geometry);

                activeRides.add(ride);
            }
        } catch (SQLException | JsonProcessingException e) {
            System.err.println("Error: " + e.getMessage());
        }
        return activeRides;
    }

    // 4b. Method to search nearby rides using MySQL Spatial Engine
    public List<Ride> searchNearbyRides(double lat, double lng) {
        List<Ride> activeRides = new ArrayList<>();
        // Constraint 1: Parameter order is strictly POINT(lng, lat) with SRID 4326
        String sql = "SELECT r.ride_id, r.driver_id, r.available_seats, r.route_geometry, " +
                "ST_AsText(r.route_linestring) AS route_wkt, " +
                "r.status, r.distance_km, r.cost_per_seat, r.is_free_ride, " +
                "u.name AS driver_name, v.make, v.model, v.license_plate, v.color " +
                "FROM Rides r " +
                "JOIN Users u ON r.driver_id = u.user_id " +
                "LEFT JOIN Vehicles v ON u.user_id = v.user_id " +
                "WHERE r.available_seats > 0 AND r.route_linestring IS NOT NULL " +
                "AND r.status IN ('PENDING', 'IN_TRANSIT') " +
                "AND ST_Distance(ST_GeomFromText(?, 4326), r.route_linestring) <= 1500";

        // Build WKT POINT string in Java: strictly lng then lat
        String studentPoint = "POINT(" + lng + " " + lat + ")";

        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setString(1, studentPoint);

            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    Ride ride = new Ride();
                    ride.setRideId(rs.getInt("ride_id"));
                    ride.setDriverId(rs.getInt("driver_id"));
                    ride.setAvailableSeats(rs.getInt("available_seats"));

                    ride.setDriverName(rs.getString("driver_name"));
                    ride.setVehicleMake(rs.getString("make"));
                    ride.setVehicleModel(rs.getString("model"));
                    ride.setLicensePlate(rs.getString("license_plate"));
                    ride.setCarColor(rs.getString("color"));

                    ride.setStatus(rs.getString("status"));
                    ride.setDistanceKm(rs.getDouble("distance_km"));
                    ride.setCostPerSeat(rs.getDouble("cost_per_seat"));
                    ride.setFreeRide(rs.getBoolean("is_free_ride"));

                    // Task 2: Parse route_linestring to routeGeometry with Constraint 1 axis
                    // reversal
                    String routeWkt = rs.getString("route_wkt");
                    if (routeWkt != null) {
                        ride.setRouteGeometry(parseLineStringToCoordinates(routeWkt));
                    } else {
                        System.err.println("Error: route_linestring is null for ride ID " + ride.getRideId());
                        String jsonGeometry = rs.getString("route_geometry");
                        if (jsonGeometry != null) {
                            try {
                                ObjectMapper mapper = new ObjectMapper();
                                ride.setRouteGeometry(
                                        mapper.readValue(jsonGeometry, new TypeReference<List<Coordinate>>() {
                                        }));
                            } catch (Exception ignore) {
                                ride.setRouteGeometry(new ArrayList<>());
                            }
                        } else {
                            ride.setRouteGeometry(new ArrayList<>());
                        }
                    }

                    activeRides.add(ride);
                }
            }
        } catch (SQLException e) {
            System.err.println("Error searching nearby rides via MySQL spatial engine: " + e.getMessage());
        }
        return activeRides;
    }

    public static void ensureFareColumnExists() {
        try (Connection conn = DatabaseConnection.getConnection();
                java.sql.Statement stmt = conn.createStatement()) {
            stmt.execute("ALTER TABLE Rides ADD COLUMN fare DOUBLE DEFAULT 0.0");
        } catch (SQLException ignore) {
            // Column already exists
        }
    }

    // 5. Method to create a new ride and return the generated ID
    public int createRide(int driverId, int totalSeats) {
        return createRide(driverId, totalSeats, 0.0, 0.0, false);
    }

    public int createRide(int driverId, int totalSeats, double fare) {
        return createRide(driverId, totalSeats, fare, 0.0, false);
    }

    public int createRide(int driverId, int totalSeats, double fare, double distanceKm, boolean isFreeRide) {
        ensureFareColumnExists();
        String sql = "INSERT INTO Rides (driver_id, total_seats, available_seats, cost_per_seat, fare, distance_km, is_free_ride) VALUES (?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql, java.sql.Statement.RETURN_GENERATED_KEYS)) {

            int actualSeats = Math.max(1, totalSeats);
            pstmt.setInt(1, driverId);
            pstmt.setInt(2, actualSeats);
            pstmt.setInt(3, actualSeats);
            pstmt.setDouble(4, fare);
            pstmt.setDouble(5, fare);
            pstmt.setDouble(6, distanceKm);
            pstmt.setBoolean(7, isFreeRide);
            pstmt.executeUpdate();

            try (ResultSet rs = pstmt.getGeneratedKeys()) {
                if (rs.next()) {
                    return rs.getInt(1); // Return the brand new ride_id
                }
            }
        } catch (SQLException e) {
            System.err.println("Error inserting ride with fare: " + e.getMessage());
            // Fallback to basic insert
            String fallbackSql = "INSERT INTO Rides (driver_id, total_seats, available_seats) VALUES (?, ?, ?)";
            try (Connection conn = DatabaseConnection.getConnection();
                    PreparedStatement pstmt = conn.prepareStatement(fallbackSql,
                            java.sql.Statement.RETURN_GENERATED_KEYS)) {
                int actualSeats = Math.max(1, totalSeats);
                pstmt.setInt(1, driverId);
                pstmt.setInt(2, actualSeats);
                pstmt.setInt(3, actualSeats);
                pstmt.executeUpdate();
                try (ResultSet rs = pstmt.getGeneratedKeys()) {
                    if (rs.next()) {
                        return rs.getInt(1);
                    }
                }
            } catch (SQLException ex) {
                System.err.println("Fallback error: " + ex.getMessage());
            }
        }
        return -1;
    }

    public List<Map<String, Object>> getActiveRidesForScan() {
        ensureFareColumnExists();
        List<Map<String, Object>> activeRides = new ArrayList<>();
        String sql = "SELECT r.ride_id, r.driver_id, r.total_seats, r.available_seats, r.route_geometry, " +
                "r.status, r.distance_km, r.cost_per_seat, r.fare, r.is_free_ride, r.origin_lat, r.origin_lng, " +
                "u.name AS driver_name, u.email AS driver_email, u.phone_number AS driver_phone, " +
                "v.make, v.model, v.license_plate, v.color " +
                "FROM Rides r " +
                "JOIN Users u ON r.driver_id = u.user_id " +
                "LEFT JOIN Vehicles v ON u.user_id = v.user_id " +
                "WHERE r.available_seats > 0 AND r.route_geometry IS NOT NULL " +
                "AND (r.status IN ('PENDING', 'IN_TRANSIT') OR r.status IS NULL)";

        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql);
                ResultSet rs = pstmt.executeQuery()) {

            ObjectMapper mapper = new ObjectMapper();

            while (rs.next()) {
                Map<String, Object> ride = new java.util.HashMap<>();
                int rideId = rs.getInt("ride_id");
                int driverId = rs.getInt("driver_id");
                int totalSeats = rs.getInt("total_seats");
                int availableSeats = rs.getInt("available_seats");
                String status = rs.getString("status");
                double distanceKm = rs.getDouble("distance_km");
                double costPerSeat = rs.getDouble("cost_per_seat");
                double fare = rs.getDouble("fare");
                if (fare == 0.0 && costPerSeat > 0.0)
                    fare = costPerSeat;
                if (costPerSeat == 0.0 && fare > 0.0)
                    costPerSeat = fare;
                boolean isFreeRide = rs.getBoolean("is_free_ride");
                double originLat = rs.getDouble("origin_lat");
                double originLng = rs.getDouble("origin_lng");

                String driverName = rs.getString("driver_name");
                String driverEmail = rs.getString("driver_email");
                String driverPhone = rs.getString("driver_phone");

                String vehicleMake = rs.getString("make");
                String vehicleModel = rs.getString("model");
                String licensePlate = rs.getString("license_plate");
                String carColor = rs.getString("color");

                String routeGeometryStr = rs.getString("route_geometry");

                ride.put("rideId", rideId);
                ride.put("ride_id", rideId);
                ride.put("driverId", driverId);
                ride.put("driver_id", driverId);
                ride.put("totalSeats", totalSeats);
                ride.put("total_seats", totalSeats);
                ride.put("availableSeats", availableSeats);
                ride.put("available_seats", availableSeats);
                ride.put("status", status != null ? status : "PENDING");
                ride.put("distanceKm", distanceKm);
                ride.put("distance_km", distanceKm);
                ride.put("costPerSeat", costPerSeat);
                ride.put("cost_per_seat", costPerSeat);
                ride.put("fare", fare);
                ride.put("isFreeRide", isFreeRide);
                ride.put("is_free_ride", isFreeRide);
                ride.put("freeRide", isFreeRide);
                ride.put("origin_lat", originLat);
                ride.put("origin_lng", originLng);
                ride.put("originLat", originLat);
                ride.put("originLng", originLng);

                ride.put("driverName", driverName);
                ride.put("driver_name", driverName);
                ride.put("driverEmail", driverEmail);
                ride.put("driverPhone", driverPhone);

                ride.put("vehicleMake", vehicleMake);
                ride.put("make", vehicleMake);
                ride.put("vehicleModel", vehicleModel);
                ride.put("model", vehicleModel);
                ride.put("licensePlate", licensePlate);
                ride.put("license_plate", licensePlate);
                ride.put("carColor", carColor);
                ride.put("color", carColor);

                ride.put("route_geometry", routeGeometryStr != null ? routeGeometryStr : "[]");
                try {
                    if (routeGeometryStr != null && !routeGeometryStr.trim().isEmpty()) {
                        List<Coordinate> coords = mapper.readValue(routeGeometryStr,
                                new TypeReference<List<Coordinate>>() {
                                });
                        ride.put("routeGeometry", coords);
                    } else {
                        ride.put("routeGeometry", new ArrayList<>());
                    }
                } catch (Exception e) {
                    ride.put("routeGeometry", new ArrayList<>());
                }

                activeRides.add(ride);
            }
        } catch (SQLException e) {
            System.err.println("Error fetching active rides for scan: " + e.getMessage());
        }
        return activeRides;
    }

    // 6. Get Student Bookings (fully hydrated with driver, vehicle, and route data)
    public List<Map<String, Object>> getPassengerBookings(int passengerId) {
        List<Map<String, Object>> bookings = new ArrayList<>();
        String sql = "SELECT b.booking_id, b.ride_id, b.booking_status, " +
                "u.name AS driver_name, u.user_id AS driver_id, " +
                "u.phone_number AS driver_phone, u.email AS driver_email, " +
                "v.make AS vehicle_make, v.model AS vehicle_model, " +
                "v.license_plate, v.color AS vehicle_color, " +
                "r.departure_time, r.cost_per_seat, r.is_free_ride, r.distance_km, " +
                "ST_AsText(r.route_linestring) AS linestring_wkt " +
                "FROM Bookings b " +
                "JOIN Rides r ON b.ride_id = r.ride_id " +
                "JOIN Users u ON r.driver_id = u.user_id " +
                "LEFT JOIN Vehicles v ON u.user_id = v.user_id " +
                "WHERE b.passenger_id = ? " +
                "ORDER BY b.booking_id DESC";

        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setInt(1, passengerId);
            ResultSet rs = pstmt.executeQuery();

            while (rs.next()) {
                Map<String, Object> booking = new java.util.HashMap<>();
                booking.put("bookingId", rs.getInt("booking_id"));
                booking.put("rideId", rs.getInt("ride_id"));
                booking.put("status", rs.getString("booking_status"));
                booking.put("driverName", rs.getString("driver_name"));
                booking.put("driverId", rs.getInt("driver_id"));
                booking.put("driverPhone", rs.getString("driver_phone"));
                booking.put("driverEmail", rs.getString("driver_email"));
                booking.put("vehicleMake", rs.getString("vehicle_make"));
                booking.put("vehicleModel", rs.getString("vehicle_model"));
                booking.put("licensePlate", rs.getString("license_plate"));
                booking.put("vehicleColor", rs.getString("vehicle_color"));
                booking.put("costPerSeat", rs.getDouble("cost_per_seat"));
                booking.put("isFreeRide", rs.getBoolean("is_free_ride"));
                booking.put("distanceKm", rs.getDouble("distance_km"));

                java.sql.Timestamp depTime = rs.getTimestamp("departure_time");
                booking.put("departureTime", depTime != null ? depTime.toString() : null);

                // Historical route hydration: parse WKT linestring into routeGeometry
                String wkt = rs.getString("linestring_wkt");
                if (wkt != null) {
                    booking.put("routeGeometry", parseLineStringToCoordinates(wkt));
                } else {
                    booking.put("routeGeometry", new ArrayList<>());
                }

                bookings.add(booking);
            }
        } catch (SQLException e) {
            System.err.println("Error fetching passenger bookings: " + e.getMessage());
        }
        return bookings;
    }

    // 7. Check if user has an active offered ride
    public boolean hasActiveOfferedRide(int driverId) {
        String sql = "SELECT COUNT(*) FROM Rides WHERE driver_id = ? AND status != 'COMPLETED' AND status != 'CANCELLED'";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, driverId);
            ResultSet rs = pstmt.executeQuery();
            if (rs.next()) {
                return rs.getInt(1) > 0;
            }
        } catch (SQLException e) {
            System.err.println("Error: " + e.getMessage());
        }
        return false;
    }

    public List<Map<String, Object>> getRideBookingsForDriver(int rideId) {
        List<Map<String, Object>> bookings = new ArrayList<>();
        String sql = "SELECT b.booking_id, b.passenger_id, b.booking_status, u.name AS passenger_name " +
                "FROM Bookings b JOIN Users u ON b.passenger_id = u.user_id " +
                "WHERE b.ride_id = ? AND b.booking_status != 'CANCELLED'";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, rideId);
            ResultSet rs = pstmt.executeQuery();
            while (rs.next()) {
                Map<String, Object> booking = new java.util.HashMap<>();
                booking.put("bookingId", rs.getInt("booking_id"));
                booking.put("passengerId", rs.getInt("passenger_id"));
                booking.put("status", rs.getString("booking_status"));
                booking.put("passengerName", rs.getString("passenger_name"));
                bookings.add(booking);
            }
        } catch (SQLException e) {
            System.err.println("Error: " + e.getMessage());
        }
        return bookings;
    }

    // 8. Check if user has an active booking
    public boolean hasActiveBookedRide(int passengerId) {
        String sql = "SELECT COUNT(*) FROM Bookings b JOIN Rides r ON b.ride_id = r.ride_id WHERE b.passenger_id = ? AND r.status != 'COMPLETED' AND r.status != 'CANCELLED' AND b.booking_status != 'CANCELLED'";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, passengerId);
            ResultSet rs = pstmt.executeQuery();
            if (rs.next()) {
                return rs.getInt(1) > 0;
            }
        } catch (SQLException e) {
            System.err.println("Error: " + e.getMessage());
        }
        return false;
    }

    public boolean updateBookingStatus(int bookingId, String status) {
        String sql = "UPDATE Bookings SET booking_status = ? WHERE booking_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, status);
            pstmt.setInt(2, bookingId);
            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Error updating booking status: " + e.getMessage());
            return false;
        }
    }

    public boolean incrementAvailableSeats(int bookingId) {
        String sql = "UPDATE Rides r JOIN Bookings b ON r.ride_id = b.ride_id SET r.available_seats = r.available_seats + 1 WHERE b.booking_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, bookingId);
            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Error incrementing seats: " + e.getMessage());
            return false;
        }
    }

    public int getRideIdByBookingId(int bookingId) {
        String sql = "SELECT ride_id FROM Bookings WHERE booking_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, bookingId);
            ResultSet rs = pstmt.executeQuery();
            if (rs.next())
                return rs.getInt("ride_id");
        } catch (SQLException e) {
            System.err.println("Error getting ride_id: " + e.getMessage());
        }
        return -1;
    }

    public int getPassengerIdByBookingId(int bookingId) {
        String sql = "SELECT passenger_id FROM Bookings WHERE booking_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, bookingId);
            ResultSet rs = pstmt.executeQuery();
            if (rs.next())
                return rs.getInt("passenger_id");
        } catch (SQLException e) {
            System.err.println("Error getting passenger_id: " + e.getMessage());
        }
        return -1;
    }

    public int getDriverIdByRideId(int rideId) {
        String sql = "SELECT driver_id FROM Rides WHERE ride_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, rideId);
            ResultSet rs = pstmt.executeQuery();
            if (rs.next())
                return rs.getInt("driver_id");
        } catch (SQLException e) {
            System.err.println("Error getting driver_id: " + e.getMessage());
        }
        return -1;
    }

    // 9. Cancel Offered Ride
    public boolean cancelOfferedRide(int driverId) {
        String updateBookingsSql = "UPDATE Bookings SET booking_status = 'CANCELLED' WHERE ride_id IN (SELECT ride_id FROM Rides WHERE driver_id = ? AND status != 'COMPLETED' AND status != 'CANCELLED')";
        String updateRideSql = "UPDATE Rides SET status = 'CANCELLED' WHERE driver_id = ? AND status != 'COMPLETED' AND status != 'CANCELLED'";

        try (Connection conn = DatabaseConnection.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement updateBookings = conn.prepareStatement(updateBookingsSql);
                    PreparedStatement updateRide = conn.prepareStatement(updateRideSql)) {

                updateBookings.setInt(1, driverId);
                updateBookings.executeUpdate();

                updateRide.setInt(1, driverId);
                updateRide.executeUpdate();

                conn.commit();
                return true;
            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            }
        } catch (SQLException e) {
            System.err.println("Error: " + e.getMessage());
            return false;
        }
    }

    // 10. Cancel Booking
    public boolean cancelBooking(int passengerId) {
        String selectSql = "SELECT ride_id FROM Bookings WHERE passenger_id = ? AND booking_status != 'CANCELLED'";
        String updateSql = "UPDATE Bookings SET booking_status = 'CANCELLED' WHERE passenger_id = ? AND booking_status != 'CANCELLED'";
        String updateRideSql = "UPDATE Rides SET available_seats = available_seats + 1 WHERE ride_id = ?";

        try (Connection conn = DatabaseConnection.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement selectStmt = conn.prepareStatement(selectSql);
                    PreparedStatement updateStmt = conn.prepareStatement(updateSql);
                    PreparedStatement updateRideStmt = conn.prepareStatement(updateRideSql)) {

                selectStmt.setInt(1, passengerId);
                ResultSet rs = selectStmt.executeQuery();

                List<Integer> rideIds = new ArrayList<>();
                while (rs.next()) {
                    rideIds.add(rs.getInt("ride_id"));
                }

                updateStmt.setInt(1, passengerId);
                int updatedRows = updateStmt.executeUpdate();

                if (updatedRows > 0) {
                    for (int rideId : rideIds) {
                        updateRideStmt.setInt(1, rideId);
                        updateRideStmt.executeUpdate();
                    }
                }

                conn.commit();
                return true;
            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            }
        } catch (SQLException e) {
            System.err.println("Error: " + e.getMessage());
            return false;
        }
    }

    // 11. Get Available Seats
    public int getAvailableSeats(int rideId) {
        String sql = "SELECT available_seats FROM Rides WHERE ride_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, rideId);
            ResultSet rs = pstmt.executeQuery();
            if (rs.next()) {
                return rs.getInt("available_seats");
            }
        } catch (SQLException e) {
            System.err.println("Error: " + e.getMessage());
        }
        return -1;
    }

    // 12. Get Accepted Passengers for a ride
    public List<Map<String, Object>> getAcceptedPassengersForRide(int rideId) {
        List<Map<String, Object>> passengers = new ArrayList<>();
        String sql = "SELECT b.booking_id, b.passenger_id, b.booking_status, u.name, b.pickup_lat, b.pickup_lng FROM Bookings b JOIN Users u ON b.passenger_id = u.user_id WHERE b.ride_id = ? AND b.booking_status IN ('ACCEPTED', 'DRIVER_ARRIVED')";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, rideId);
            ResultSet rs = pstmt.executeQuery();
            while (rs.next()) {
                Map<String, Object> p = new java.util.HashMap<>();
                p.put("bookingId", rs.getInt("booking_id"));
                p.put("status", rs.getString("booking_status"));
                p.put("id", rs.getInt("passenger_id"));
                p.put("name", rs.getString("name"));
                if (rs.getObject("pickup_lat") != null) {
                    p.put("lat", rs.getDouble("pickup_lat"));
                }
                if (rs.getObject("pickup_lng") != null) {
                    p.put("lng", rs.getDouble("pickup_lng"));
                }
                passengers.add(p);
            }
        } catch (SQLException e) {
            System.err.println("Error: " + e.getMessage());
        }
        return passengers;
    }

    // 13. Get Active Ride ID for a driver
    public int getActiveRideIdByDriver(int driverId) {
        String sql = "SELECT ride_id FROM Rides WHERE driver_id = ? AND status != 'COMPLETED' AND status != 'CANCELLED' ORDER BY ride_id DESC LIMIT 1";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, driverId);
            ResultSet rs = pstmt.executeQuery();
            if (rs.next()) {
                return rs.getInt("ride_id");
            }
        } catch (SQLException e) {
            System.err.println("Error: " + e.getMessage());
        }
        return -1;
    }

    // 13b. Get Active Ride Details for a driver
    public Map<String, Object> getActiveRideDetailsForDriver(int driverId) {
        String sql = "SELECT ride_id, status, distance_km, available_seats, route_geometry FROM Rides " +
                "WHERE driver_id = ? AND status != 'COMPLETED' AND status != 'CANCELLED' " +
                "ORDER BY ride_id DESC LIMIT 1";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, driverId);
            ResultSet rs = pstmt.executeQuery();
            if (rs.next()) {
                Map<String, Object> details = new java.util.HashMap<>();
                details.put("driverRideId", rs.getInt("ride_id"));
                details.put("rideStatus", rs.getString("status"));
                details.put("distance_km", rs.getDouble("distance_km"));
                details.put("seats", rs.getInt("available_seats"));
                details.put("route_geometry", rs.getString("route_geometry"));
                return details;
            }
        } catch (SQLException e) {
            System.err.println("Error fetching active ride details: " + e.getMessage());
        }
        return null;
    }

    // 14. Get Campus Analytics
    public Map<String, Object> getCampusAnalytics() {
        Map<String, Object> stats = new java.util.HashMap<>();
        String sql = "SELECT COALESCE(SUM(distance_km), 0) AS total_km, COUNT(*) AS completed_count FROM Rides WHERE status = 'COMPLETED'";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql);
                ResultSet rs = pstmt.executeQuery()) {
            if (rs.next()) {
                stats.put("totalKm", rs.getDouble("total_km"));
                stats.put("completedCount", rs.getInt("completed_count"));
            }
        } catch (SQLException e) {
            System.err.println("Error fetching analytics: " + e.getMessage());
        }
        return stats;
    }

    // 15. Update Ride Status
    public boolean updateRideStatus(int rideId, String newStatus) {
        String sql = "UPDATE Rides SET status = ? WHERE ride_id = ?";
        String updateBookingsSql = "UPDATE Bookings SET booking_status = 'COMPLETED' WHERE ride_id = ? AND booking_status IN ('ACCEPTED', 'DRIVER_ARRIVED')";

        try (Connection conn = DatabaseConnection.getConnection()) {
            conn.setAutoCommit(false);

            try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                pstmt.setString(1, newStatus);
                pstmt.setInt(2, rideId);
                int rows = pstmt.executeUpdate();

                if (rows > 0 && "COMPLETED".equals(newStatus)) {
                    try (PreparedStatement bookingPstmt = conn.prepareStatement(updateBookingsSql)) {
                        bookingPstmt.setInt(1, rideId);
                        bookingPstmt.executeUpdate();
                    }
                }

                conn.commit();
                return rows > 0;
            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            }
        } catch (SQLException e) {
            System.err.println("Error updating status: " + e.getMessage());
            return false;
        }
    }

    // 16. Report SOS
    public boolean reportSos(int rideId, int reporterId, double lat, double lng) {
        String updateRide = "UPDATE Rides SET is_emergency = TRUE, emergency_reported_at = CURRENT_TIMESTAMP WHERE ride_id = ?";
        String insertIncident = "INSERT INTO Incident_Reports (ride_id, reporter_id, last_known_lat, last_known_lng) VALUES (?, ?, ?, ?)";

        try (Connection conn = DatabaseConnection.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement uStmt = conn.prepareStatement(updateRide);
                    PreparedStatement iStmt = conn.prepareStatement(insertIncident)) {

                uStmt.setInt(1, rideId);
                uStmt.executeUpdate();

                iStmt.setInt(1, rideId);
                iStmt.setInt(2, reporterId);
                iStmt.setDouble(3, lat);
                iStmt.setDouble(4, lng);
                iStmt.executeUpdate();

                conn.commit();
                return true;
            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            }
        } catch (SQLException e) {
            System.err.println("Error reporting SOS: " + e.getMessage());
            return false;
        }
    }

    // 17. Admin Audit Logs (MySQL Pagination)
    public List<Map<String, Object>> getAuditLogs() {
        return getAuditLogs(0, 100);
    }

    public List<Map<String, Object>> getAuditLogs(int offset, int limit) {
        List<Map<String, Object>> logs = new ArrayList<>();
        String sql = "SELECT r.ride_id, r.status, r.departure_time, r.is_emergency, r.emergency_reported_at, " +
                "r.distance_km, r.route_geometry, " +
                "u.name AS driver_name, u.email AS driver_email, " +
                "i.incident_id, i.last_known_lat, i.last_known_lng, i.reported_at " +
                "FROM Rides r " +
                "JOIN Users u ON r.driver_id = u.user_id " +
                "LEFT JOIN Incident_Reports i ON r.ride_id = i.ride_id " +
                "ORDER BY r.ride_id DESC " +
                "LIMIT ? OFFSET ?";

        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setInt(1, limit > 0 ? limit : 100);
            pstmt.setInt(2, Math.max(0, offset));
            ResultSet rs = pstmt.executeQuery();

            ObjectMapper mapper = new ObjectMapper();

            while (rs.next()) {
                Map<String, Object> log = new java.util.HashMap<>();
                log.put("rideId", rs.getInt("ride_id"));
                log.put("status", rs.getString("status"));
                log.put("departureTime", rs.getString("departure_time"));
                log.put("isEmergency", rs.getBoolean("is_emergency"));
                log.put("emergencyReportedAt", rs.getString("emergency_reported_at"));
                log.put("distanceKm", rs.getDouble("distance_km"));
                log.put("driverName", rs.getString("driver_name"));
                log.put("driverEmail", rs.getString("driver_email"));

                String jsonGeometry = rs.getString("route_geometry");
                if (jsonGeometry != null) {
                    List<Coordinate> geometry = mapper.readValue(jsonGeometry, new TypeReference<List<Coordinate>>() {
                    });
                    log.put("routeGeometry", geometry);
                } else {
                    log.put("routeGeometry", new ArrayList<>());
                }

                if (rs.getInt("incident_id") > 0) {
                    Map<String, Object> incident = new java.util.HashMap<>();
                    incident.put("incidentId", rs.getInt("incident_id"));
                    incident.put("lat", rs.getDouble("last_known_lat"));
                    incident.put("lng", rs.getDouble("last_known_lng"));
                    incident.put("reportedAt", rs.getString("reported_at"));
                    log.put("incident", incident);
                } else {
                    log.put("incident", null);
                }

                logs.add(log);
            }
        } catch (SQLException | JsonProcessingException e) {
            System.err.println("Error fetching audit logs: " + e.getMessage());
        }
        return logs;
    }

    // Constraint 2: Idempotent geofenced auto-arrival update
    public boolean markBookingArrivedIfAccepted(int bookingId) {
        String sql = "UPDATE Bookings SET booking_status = 'DRIVER_ARRIVED' WHERE booking_id = ? AND booking_status = 'ACCEPTED'";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, bookingId);
            int rowsAffected = pstmt.executeUpdate();
            return rowsAffected == 1;
        } catch (SQLException e) {
            System.err.println("Error auto-updating arrival status: " + e.getMessage());
            return false;
        }
    }

    // Constraint 3: Transactional Ride Reaper Cascade & 24-Hour Auto-Cancel
    public int reapOrphanedRides() {
        // 1. Task 3: 24-Hour Auto-Cancel: automatically cancel any ride older than 24
        // hours that hasn't been completed
        String autoCancel24hSql = "UPDATE Rides SET status = 'CANCELLED' " +
                "WHERE status NOT IN ('COMPLETED', 'CANCELLED') " +
                "AND (" +
                "  (created_at IS NOT NULL AND created_at < (NOW() - INTERVAL 24 HOUR)) " +
                "  OR (departure_time IS NOT NULL AND departure_time < (NOW() - INTERVAL 24 HOUR))" +
                ")";
        String cancelBookings24hSql = "UPDATE Bookings b JOIN Rides r ON b.ride_id = r.ride_id " +
                "SET b.booking_status = 'CANCELLED' " +
                "WHERE r.status = 'CANCELLED' AND b.booking_status NOT IN ('COMPLETED', 'CANCELLED')";

        try (Connection conn = DatabaseConnection.getConnection()) {
            try (PreparedStatement stmt24 = conn.prepareStatement(autoCancel24hSql)) {
                int cancelled24 = stmt24.executeUpdate();
                if (cancelled24 > 0) {
                    System.out
                            .println("24-Hour Auto-Cancel: Cancelled " + cancelled24 + " ride(s) older than 24 hours.");
                    try (PreparedStatement bStmt = conn.prepareStatement(cancelBookings24hSql)) {
                        bStmt.executeUpdate();
                    }
                }
            }
        } catch (SQLException e) {
            System.err.println("Error running 24-hour auto-cancel: " + e.getMessage());
        }

        String selectOrphanedSql = "SELECT ride_id FROM Rides " +
                "WHERE (status = 'PENDING' OR status = 'IN_TRANSIT') " +
                "AND departure_time IS NOT NULL " +
                "AND TIMESTAMPDIFF(HOUR, departure_time, NOW()) >= 3";

        try (Connection conn = DatabaseConnection.getConnection()) {
            conn.setAutoCommit(false);

            List<Integer> orphanedRideIds = new ArrayList<>();
            try (PreparedStatement selectStmt = conn.prepareStatement(selectOrphanedSql);
                    ResultSet rs = selectStmt.executeQuery()) {
                while (rs.next()) {
                    orphanedRideIds.add(rs.getInt("ride_id"));
                }
            }

            if (orphanedRideIds.isEmpty()) {
                conn.commit();
                return 0;
            }

            StringBuilder placeholders = new StringBuilder();
            for (int i = 0; i < orphanedRideIds.size(); i++) {
                placeholders.append("?");
                if (i < orphanedRideIds.size() - 1) {
                    placeholders.append(", ");
                }
            }

            String updateBookingsSql = "UPDATE Bookings SET booking_status = 'CANCELLED' " +
                    "WHERE ride_id IN (" + placeholders + ") AND booking_status != 'CANCELLED'";
            String updateRidesSql = "UPDATE Rides SET status = 'CANCELLED' " +
                    "WHERE ride_id IN (" + placeholders + ")";

            try (PreparedStatement updateBookings = conn.prepareStatement(updateBookingsSql);
                    PreparedStatement updateRides = conn.prepareStatement(updateRidesSql)) {

                for (int i = 0; i < orphanedRideIds.size(); i++) {
                    updateBookings.setInt(i + 1, orphanedRideIds.get(i));
                    updateRides.setInt(i + 1, orphanedRideIds.get(i));
                }

                int bookingsCancelled = updateBookings.executeUpdate();
                int ridesCancelled = updateRides.executeUpdate();

                conn.commit();
                System.out.println("RideReaper reaped " + ridesCancelled + " orphaned rides and cancelled "
                        + bookingsCancelled + " bookings.");
                return ridesCancelled;
            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            }
        } catch (SQLException e) {
            System.err.println("Error reaping orphaned rides: " + e.getMessage());
            return 0;
        }
    }

    // Task 2: Get Route Geometry parsed from ST_AsText(route_linestring) with WKT
    // axis reversal
    public List<Coordinate> getRouteGeometryByRideId(int rideId) {
        String sql = "SELECT ST_AsText(route_linestring) AS route_wkt, route_geometry FROM Rides WHERE ride_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, rideId);
            ResultSet rs = pstmt.executeQuery();
            if (rs.next()) {
                String routeWkt = rs.getString("route_wkt");
                if (routeWkt != null) {
                    return parseLineStringToCoordinates(routeWkt);
                }
                String geomJson = rs.getString("route_geometry");
                if (geomJson != null) {
                    ObjectMapper mapper = new ObjectMapper();
                    return mapper.readValue(geomJson, new TypeReference<List<Coordinate>>() {
                    });
                }
            }
        } catch (Exception e) {
            System.err.println("Error fetching route geometry for ride " + rideId + ": " + e.getMessage());
        }
        return new ArrayList<>();
    }

    // Task 4: Dynamic Admin CMS Destination Settings
    public boolean saveSetting(String key, String jsonValue) {
        String sql = "INSERT INTO System_Settings (setting_key, setting_value) VALUES (?, ?) " +
                "ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, key);
            pstmt.setString(2, jsonValue);
            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Error saving system setting " + key + ": " + e.getMessage());
            return false;
        }
    }

    public String getSetting(String key) {
        String sql = "SELECT setting_value FROM System_Settings WHERE setting_key = ?";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, key);
            ResultSet rs = pstmt.executeQuery();
            if (rs.next()) {
                return rs.getString("setting_value");
            }
        } catch (SQLException e) {
            System.err.println("Error getting system setting " + key + ": " + e.getMessage());
        }
        return null;
    }

    // Task 3: Gather Full Ride Details for SOS
    public Map<String, Object> getFullRideDetailsForSos(int rideId) {
        Map<String, Object> details = new HashMap<>();
        Map<String, Object> driverMap = new HashMap<>();
        Map<String, Object> vehicleMap = new HashMap<>();
        List<Map<String, Object>> passengersList = new ArrayList<>();

        details.put("rideId", rideId);
        details.put("driver", driverMap);
        details.put("vehicle", vehicleMap);
        details.put("passengers", passengersList);

        // 1. Fetch Driver and Vehicle Details
        String driverSql = "SELECT r.driver_id, u.name AS driver_name, u.phone_number AS driver_phone, u.email AS driver_email, "
                +
                "v.make, v.model, v.license_plate, v.color " +
                "FROM Rides r " +
                "JOIN Users u ON r.driver_id = u.user_id " +
                "LEFT JOIN Vehicles v ON u.user_id = v.user_id " +
                "WHERE r.ride_id = ?";

        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(driverSql)) {
            pstmt.setInt(1, rideId);
            ResultSet rs = pstmt.executeQuery();
            if (rs.next()) {
                driverMap.put("id", rs.getInt("driver_id"));
                driverMap.put("name", rs.getString("driver_name"));
                driverMap.put("phone", rs.getString("driver_phone"));
                driverMap.put("email", rs.getString("driver_email"));

                vehicleMap.put("make", rs.getString("make"));
                vehicleMap.put("model", rs.getString("model"));
                vehicleMap.put("license_plate", rs.getString("license_plate"));
                vehicleMap.put("color", rs.getString("color"));
            }
        } catch (SQLException e) {
            System.err.println("Error fetching driver/vehicle for SOS: " + e.getMessage());
        }

        // 2. Fetch Accepted Passengers
        String passengerSql = "SELECT u.user_id, u.name, u.phone_number, u.email " +
                "FROM Bookings b " +
                "JOIN Users u ON b.passenger_id = u.user_id " +
                "WHERE b.ride_id = ? AND b.booking_status IN ('ACCEPTED', 'DRIVER_ARRIVED', 'IN_TRANSIT')";

        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(passengerSql)) {
            pstmt.setInt(1, rideId);
            ResultSet rs = pstmt.executeQuery();
            while (rs.next()) {
                Map<String, Object> p = new HashMap<>();
                p.put("id", rs.getInt("user_id"));
                p.put("name", rs.getString("name"));
                p.put("phone", rs.getString("phone_number"));
                p.put("email", rs.getString("email"));
                passengersList.add(p);
            }
        } catch (SQLException e) {
            System.err.println("Error fetching passengers for SOS: " + e.getMessage());
        }

        return details;
    }
}