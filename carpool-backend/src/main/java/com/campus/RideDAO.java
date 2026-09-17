package com.campus;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import java.util.ArrayList;
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
        // Step A: Check if seats are available and decrement by 1
        String updateRideSql = "UPDATE Rides SET available_seats = available_seats - 1 WHERE ride_id = ? AND available_seats > 0";
        // Step B: Record the booking
        String insertBookingSql = "INSERT INTO Bookings (ride_id, passenger_id, booking_status) VALUES (?, ?, 'PENDING')";

        try (Connection conn = DatabaseConnection.getConnection()) {
            // Disable auto-commit to treat both queries as a single "Transaction"
            conn.setAutoCommit(false);

            try (PreparedStatement updateStmt = conn.prepareStatement(updateRideSql);
                    PreparedStatement insertStmt = conn.prepareStatement(insertBookingSql)) {

                // Execute Step A
                updateStmt.setInt(1, rideId);
                int updatedRows = updateStmt.executeUpdate();

                if (updatedRows == 0) {
                    // Ride was full or not found! Rollback any changes.
                    conn.rollback();
                    return false;
                }

                // Execute Step B
                insertStmt.setInt(1, rideId);
                insertStmt.setInt(2, passengerId);
                insertStmt.executeUpdate();

                // If both succeeded, commit the changes permanently
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

    public boolean saveRouteDetails(int rideId, String routeJson, double distanceKm, boolean isFreeRide) {
        String sql = "UPDATE Rides SET route_geometry = ?, distance_km = ?, cost_per_seat = ?, is_free_ride = ? WHERE ride_id = ?";

        int availableSeats = getAvailableSeats(rideId);
        if (availableSeats <= 0)
            availableSeats = 1; // Prevent division by zero

        double costPerSeat = isFreeRide ? 0.0 : Math.round(((distanceKm * 5.0) / availableSeats) * 100.0) / 100.0;

        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setString(1, routeJson);
            pstmt.setDouble(2, distanceKm);
            pstmt.setDouble(3, costPerSeat);
            pstmt.setBoolean(4, isFreeRide);
            pstmt.setInt(5, rideId);

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
        String sql = "SELECT r.ride_id, r.driver_id, r.available_seats, r.route_geometry, " +
                "r.status, r.distance_km, r.cost_per_seat, r.is_free_ride, " +
                "u.name AS driver_name, v.make, v.model, v.license_plate, v.color " +
                "FROM Rides r " +
                "JOIN Users u ON r.driver_id = u.user_id " +
                "LEFT JOIN Vehicles v ON u.user_id = v.user_id " +
                "WHERE r.available_seats > 0 AND r.route_geometry IS NOT NULL " +
                "AND (r.status = 'PENDING' OR r.status IS NULL)";

        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql);
                ResultSet rs = pstmt.executeQuery()) {

            ObjectMapper mapper = new ObjectMapper();

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

    // 5. Method to create a new ride and return the generated ID
    public int createRide(int driverId, int totalSeats) {
        String sql = "INSERT INTO Rides (driver_id, total_seats, available_seats) VALUES (?, ?, ?)";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql, java.sql.Statement.RETURN_GENERATED_KEYS)) {

            pstmt.setInt(1, driverId);
            pstmt.setInt(2, totalSeats);
            pstmt.setInt(3, totalSeats);
            pstmt.executeUpdate();

            try (ResultSet rs = pstmt.getGeneratedKeys()) {
                if (rs.next()) {
                    return rs.getInt(1); // Return the brand new ride_id
                }
            }
        } catch (SQLException e) {
            System.err.println("Error: " + e.getMessage());
        }
        return -1;
    }

    // 6. Get Student Bookings
    public List<Map<String, Object>> getPassengerBookings(int passengerId) {
        List<Map<String, Object>> bookings = new ArrayList<>();
        String sql = "SELECT b.booking_id, b.ride_id, b.booking_status, u.name AS driver_name " +
                "FROM Bookings b " +
                "JOIN Rides r ON b.ride_id = r.ride_id " +
                "JOIN Users u ON r.driver_id = u.user_id " +
                "WHERE b.passenger_id = ?";

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
                bookings.add(booking);
            }
        } catch (SQLException e) {
            System.err.println("Error: " + e.getMessage());
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
        String sql = "SELECT b.passenger_id, u.name FROM Bookings b JOIN Users u ON b.passenger_id = u.user_id WHERE b.ride_id = ? AND b.booking_status IN ('ACCEPTED', 'DRIVER_ARRIVED')";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, rideId);
            ResultSet rs = pstmt.executeQuery();
            while (rs.next()) {
                Map<String, Object> p = new java.util.HashMap<>();
                p.put("id", rs.getInt("passenger_id"));
                p.put("name", rs.getString("name"));
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
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, newStatus);
            pstmt.setInt(2, rideId);
            int rows = pstmt.executeUpdate();
            return rows > 0;
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

    // 17. Admin Audit Logs
    public List<Map<String, Object>> getAuditLogs() {
        List<Map<String, Object>> logs = new ArrayList<>();
        // Note: Using a left join to Incident_Reports just to get incident data if any
        String sql = "SELECT r.ride_id, r.status, r.departure_time, r.is_emergency, r.emergency_reported_at, " +
                "r.distance_km, r.route_geometry, " +
                "u.name AS driver_name, u.email AS driver_email, " +
                "i.incident_id, i.last_known_lat, i.last_known_lng, i.reported_at " +
                "FROM Rides r " +
                "JOIN Users u ON r.driver_id = u.user_id " +
                "LEFT JOIN Incident_Reports i ON r.ride_id = i.ride_id " +
                "ORDER BY r.ride_id DESC";

        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql);
                ResultSet rs = pstmt.executeQuery()) {

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
}