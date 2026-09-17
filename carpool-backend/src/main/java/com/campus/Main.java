package com.campus;

import io.javalin.Javalin;
import io.javalin.http.Cookie;
import io.javalin.http.SameSite;
import io.javalin.http.UploadedFile;
import io.javalin.http.staticfiles.Location;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.ArrayList;
import java.util.concurrent.ConcurrentHashMap;
import io.javalin.websocket.WsContext;

public class Main {
    static Map<Integer, Coordinate> driverLocations = new ConcurrentHashMap<>();
    static Map<Integer, Coordinate> passengerLocations = new ConcurrentHashMap<>();
    static Map<Integer, Set<WsContext>> rideSessions = new ConcurrentHashMap<>();
    static Map<Integer, List<Map<String, Object>>> rideChats = new ConcurrentHashMap<>();

    public static void main(String[] args) {
        ObjectMapper mapper = new ObjectMapper();
        RideDAO rideDAO = new RideDAO();
        UserDAO userDAO = new UserDAO();
        AuthService authService = new AuthService();
        LocationService locationService = new LocationService();

        // 1. Create a physical 'uploads' folder on your hard drive if it doesn't exist
        File uploadDir = new File("uploads");
        if (!uploadDir.exists()) {
            uploadDir.mkdir();
        }

        // 0. Initialize Database Tables if they don't exist
        try (java.sql.Connection conn = DatabaseConnection.getConnection();
                java.sql.Statement stmt = conn.createStatement()) {
            stmt.execute("CREATE TABLE IF NOT EXISTS Vehicles (" +
                    "user_id INT PRIMARY KEY, " +
                    "make VARCHAR(50), " +
                    "model VARCHAR(50), " +
                    "license_plate VARCHAR(20), " +
                    "color VARCHAR(20), " +
                    "FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE" +
                    ")");
            System.out.println("Vehicles table verified.");

            try {
                stmt.execute(
                        "ALTER TABLE Rides ADD COLUMN status ENUM('PENDING', 'DRIVER_ARRIVED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING'");
            } catch (Exception ignore) {
                // If the column already exists with the old ENUM, we need to modify it
                try {
                    stmt.execute(
                            "ALTER TABLE Rides MODIFY COLUMN status ENUM('PENDING', 'DRIVER_ARRIVED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING'");
                } catch (Exception ignore2) {
                }
            }
            try {
                stmt.execute("ALTER TABLE Rides ADD COLUMN distance_km DOUBLE DEFAULT 0.0");
            } catch (Exception ignore) {
            }
            try {
                stmt.execute("ALTER TABLE Rides ADD COLUMN cost_per_seat DOUBLE DEFAULT 0.0");
            } catch (Exception ignore) {
            }
            try {
                stmt.execute("ALTER TABLE Rides ADD COLUMN is_free_ride BOOLEAN DEFAULT FALSE");
            } catch (Exception ignore) {
            }
            try {
                stmt.execute("ALTER TABLE Rides ADD COLUMN is_emergency BOOLEAN DEFAULT FALSE");
            } catch (Exception ignore) {
            }
            try {
                stmt.execute("ALTER TABLE Rides ADD COLUMN emergency_reported_at TIMESTAMP NULL");
            } catch (Exception ignore) {
            }
            System.out.println("Rides table schema verified.");

            try {
                stmt.execute("ALTER TABLE Users ADD COLUMN otp_code VARCHAR(6)");
            } catch (Exception ignore) {
            }
            try {
                stmt.execute("ALTER TABLE Users ADD COLUMN otp_expires_at TIMESTAMP");
            } catch (Exception ignore) {
            }
            try {
                stmt.execute("ALTER TABLE Users ADD COLUMN is_email_verified BOOLEAN DEFAULT FALSE");
            } catch (Exception ignore) {
            }
            try {
                stmt.execute("ALTER TABLE Users ADD COLUMN favorite_route VARCHAR(2000)");
            } catch (Exception ignore) {
            }
            System.out.println("Users table schema verified.");

            // Clean slate for bookings testing
            try {
                stmt.execute("DELETE FROM Bookings");
                System.out.println("Cleared Bookings table for clean state.");
            } catch (Exception e) {
                System.out.println("Error clearing Bookings: " + e.getMessage());
            }

            try {
                stmt.execute("ALTER TABLE Bookings ADD COLUMN booking_status VARCHAR(50) DEFAULT 'CONFIRMED'");
            } catch (Exception ignore) {
            }
            System.out.println("Bookings table schema verified.");

            stmt.execute("CREATE TABLE IF NOT EXISTS Incident_Reports (" +
                    "incident_id INT AUTO_INCREMENT PRIMARY KEY, " +
                    "ride_id INT, " +
                    "reporter_id INT, " +
                    "reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                    "last_known_lat DOUBLE, " +
                    "last_known_lng DOUBLE, " +
                    "status VARCHAR(50) DEFAULT 'ACTIVE'" +
                    ")");
            System.out.println("Incident_Reports table verified.");

        } catch (SQLException e) {
            System.err.println("Error initializing DB schema: " + e.getMessage());
        }

        Javalin app = Javalin.create(config -> {
            config.bundledPlugins.enableCors(cors -> {
                cors.addRule(it -> {
                    it.allowHost("http://localhost:5173");
                    it.allowCredentials = true;
                });
            });
            // 2. Tell Javalin to serve the images publicly so React can load them
            config.staticFiles.add(staticFiles -> {
                staticFiles.hostedPath = "/uploads";
                staticFiles.directory = "uploads";
                staticFiles.location = Location.EXTERNAL;
            });
        }).start(7070);

        System.out.println("SERVER IS RUNNING! Listening for frontend requests...");

        // 1. Status Endpoint
        app.get("/api/status", ctx -> ctx.result("Backend is live and ready!"));

        // 2. Booking Endpoint
        app.post("/api/book", ctx -> {
            try {
                String token = ctx.cookie("jwt");
                if (token == null) {
                    ctx.status(401).json(Map.of("error", "Unauthorized."));
                    return;
                }
                int passengerId = authService.validateTokenAndGetUserId(token);
                if (passengerId == -1) {
                    ctx.status(401).json(Map.of("error", "Invalid session."));
                    return;
                }

                if (!authService.validateTokenAndGetIsVerified(token)) {
                    ctx.status(403).json(Map.of("error", "Your account is pending verification"));
                    return;
                }

                Map<String, Double> requestBody = mapper.readValue(ctx.body(),
                        new TypeReference<Map<String, Double>>() {
                        });
                int rideId = requestBody.get("rideId").intValue();

                if (rideDAO.hasActiveBookedRide(passengerId)) {
                    ctx.status(400).json(Map.of("error",
                            "You can only book one ride at a time. Please cancel your existing booking first."));
                    return;
                }

                boolean success = rideDAO.bookSeatInDatabase(rideId, passengerId);
                if (success) {
                    ctx.status(200).json(Map.of("message", "Booking requested! Waiting for driver approval."));
                    Set<WsContext> sessions = rideSessions.get(rideId);
                    if (sessions != null && !sessions.isEmpty()) {
                        String passengerName = userDAO.getUserNameById(passengerId);
                        for (WsContext session : sessions) {
                            try {
                                session.send("{\"type\": \"NEW_BOOKING_REQUEST\", \"passengerId\": " + passengerId
                                        + ", \"name\": \"" + passengerName + "\"}");
                            } catch (Exception e) {
                            }
                        }
                    }
                } else {
                    ctx.status(400).json(Map.of("error", "Failed to book seat."));
                }
            } catch (JsonProcessingException | NullPointerException e) {
                System.err.println("Error processing booking: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error processing booking."));
            }
        });

        // 3. Save Custom Route Endpoint
        app.post("/api/route/save/{rideId}", ctx -> {
            try {
                int rideId = Integer.parseInt(ctx.pathParam("rideId"));
                String rawJson = ctx.body();
                Map<String, Object> payload = mapper.readValue(rawJson, new TypeReference<Map<String, Object>>() {
                });
                String routeGeometryJson = mapper.writeValueAsString(payload.get("routeGeometry"));
                double distanceKm = Double.parseDouble(payload.get("distanceKm").toString());
                boolean isFreeRide = (Boolean) payload.get("isFreeRide");

                boolean isSaved = rideDAO.saveRouteDetails(rideId, routeGeometryJson, distanceKm, isFreeRide);

                if (isSaved)
                    ctx.status(200).json(Map.of("message", "Route saved!"));
                else
                    ctx.status(400).json(Map.of("error", "Database failed to save the route."));
            } catch (NumberFormatException | JsonProcessingException | NullPointerException e) {
                System.err.println("Error saving route: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Failed to parse route data."));
            }
        });

        // 4. Search Nearby Rides Endpoint
        app.post("/api/rides/search", ctx -> {
            try {
                Coordinate studentLoc = mapper.readValue(ctx.body(), Coordinate.class);
                List<Ride> allRides = rideDAO.getAllActiveRides();
                List<Ride> matchingRides = new java.util.ArrayList<>();

                for (Ride ride : allRides) {
                    if (locationService.isPassengerOnRoute(studentLoc, ride.getRouteGeometry())) {
                        ride.setRouteGeometry(null);
                        matchingRides.add(ride);
                    }
                }
                ctx.status(200).json(matchingRides);
            } catch (JsonProcessingException e) {
                System.err.println("Error searching rides: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Failed to search for rides."));
            }
        });

        // 5. Admin: Get Pending Users
        app.get("/api/admin/pending", ctx -> {
            try {
                List<User> pendingUsers = userDAO.getPendingVerifications();
                ctx.status(200).json(pendingUsers);
            } catch (NullPointerException | IllegalArgumentException e) {
                System.err.println("Error fetching pending users: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Failed to fetch pending users."));
            }
        });

        // 6. Admin: Approve User
        app.post("/api/admin/approve/{id}", ctx -> {
            try {
                int userId = Integer.parseInt(ctx.pathParam("id"));
                boolean success = userDAO.approveUser(userId);
                if (success)
                    ctx.status(200).json(Map.of("message", "User verified!"));
                else
                    ctx.status(400).json(Map.of("error", "Failed to verify user."));
            } catch (NumberFormatException e) {
                System.err.println("Error approving user: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error."));
            }
        });

        // 6b. Admin: Audit Logs
        app.get("/api/admin/rides/audit", ctx -> {
            try {
                List<Map<String, Object>> logs = rideDAO.getAuditLogs();
                ctx.status(200).json(logs);
            } catch (Exception e) {
                System.err.println("Error fetching audit logs: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error fetching audit logs."));
            }
        });

        // 7. Authentication: Login Endpoint
        app.post("/api/login", ctx -> {
            try {
                Map<String, String> credentials = mapper.readValue(ctx.body(),
                        new TypeReference<Map<String, String>>() {
                        });
                String email = credentials.get("email");
                String password = credentials.get("password");
                User user = userDAO.getUserByEmail(email);

                if (user != null && user.getPassword() != null && user.getPassword().equals(password)) {
                    String token = authService.generateToken(user);
                    Cookie cookie = new Cookie("jwt", token);
                    cookie.setHttpOnly(true);
                    cookie.setPath("/");
                    cookie.setSameSite(SameSite.LAX);
                    ctx.cookie(cookie);

                    ctx.status(200).json(Map.of("message", "Welcome back!", "role", user.getRole()));
                } else {
                    ctx.status(401).json(Map.of("error", "Invalid email or password."));
                }
            } catch (JsonProcessingException | NullPointerException e) {
                System.err.println("Error during login: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error during login."));
            }
        });

        // 7b. Logout Endpoint
        app.post("/api/logout", ctx -> {
            ctx.removeCookie("jwt");
            ctx.status(200).json(Map.of("message", "Logged out securely."));
        });

        // 8. Create a New Ride
        app.post("/api/rides/create", ctx -> {
            try {
                String token = ctx.cookie("jwt");
                if (token == null) {
                    ctx.status(401).json(Map.of("error", "Unauthorized."));
                    return;
                }
                int driverId = authService.validateTokenAndGetUserId(token);
                if (driverId == -1) {
                    ctx.status(401).json(Map.of("error", "Invalid session."));
                    return;
                }

                if (!authService.validateTokenAndGetIsVerified(token)) {
                    ctx.status(403).json(Map.of("error", "Your account is pending verification"));
                    return;
                }

                Map<String, Integer> request = mapper.readValue(ctx.body(), new TypeReference<Map<String, Integer>>() {
                });
                int seats = request.get("seats");
                int newRideId = rideDAO.createRide(driverId, seats);

                if (newRideId > 0)
                    ctx.status(200).json(Map.of("message", "Ride initialized!", "rideId", newRideId));
                else
                    ctx.status(400).json(Map.of("error", "Failed to create ride."));
            } catch (JsonProcessingException | NullPointerException e) {
                System.err.println("Error creating ride: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error."));
            }
        });

        // 9. Registration Endpoint - MASSIVE OVERHAUL FOR FILE UPLOADS
        app.post("/api/register", ctx -> {
            try {
                // Read text fields from the Multipart Form
                String name = ctx.formParam("name");
                String email = ctx.formParam("email");
                String password = ctx.formParam("password");
                String role = "USER";

                if (email == null || !email.matches("^[a-zA-Z0-9_]+\\.[a-zA-Z]{2}\\d{2}@jecc\\.ac\\.in$")) {
                    ctx.status(400).json(Map.of("error", "Invalid college email format"));
                    return;
                }

                // Read the actual image files
                UploadedFile collegeIdFile = ctx.uploadedFile("collegeId");
                UploadedFile selfieFile = ctx.uploadedFile("selfie");

                String collegeIdUrl = null;
                String selfieUrl = null;

                // Process and save the College ID image
                if (collegeIdFile != null) {
                    // Generate a unique filename using timestamp to prevent overwriting
                    String filename = System.currentTimeMillis() + "_id_"
                            + collegeIdFile.filename().replaceAll("[^a-zA-Z0-9\\.\\-]", "_");
                    Files.copy(collegeIdFile.content(), Path.of("uploads/" + filename),
                            StandardCopyOption.REPLACE_EXISTING);
                    collegeIdUrl = "http://localhost:7070/uploads/" + filename; // Save the full URL
                }

                // Process and save the Selfie image
                if (selfieFile != null) {
                    String filename = System.currentTimeMillis() + "_selfie_"
                            + selfieFile.filename().replaceAll("[^a-zA-Z0-9\\.\\-]", "_");
                    Files.copy(selfieFile.content(), Path.of("uploads/" + filename),
                            StandardCopyOption.REPLACE_EXISTING);
                    selfieUrl = "http://localhost:7070/uploads/" + filename; // Save the full URL
                }

                // Save user and image URLs to MySQL
                boolean success = userDAO.registerUser(name, email, password, role, collegeIdUrl, selfieUrl);

                if (success) {
                    // Generate and "send" OTP
                    String otp = userDAO.generateAndStoreOtp(email);
                    System.out.println("=================================================");
                    System.out.println("EMAIL OTP FOR " + email + ": " + otp);
                    System.out.println("=================================================");
                    ctx.status(200)
                            .json(Map.of("message", "Registration successful! Please check your email for the OTP.",
                                    "requireOtp", true, "email", email));
                } else {
                    ctx.status(400).json(Map.of("error", "Registration failed. Email might already exist."));
                }
            } catch (IOException | NullPointerException e) {
                System.err.println("Error processing file uploads: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error processing file uploads."));
            }
        });

        // 9b. Verify OTP
        app.post("/api/auth/verify-otp", ctx -> {
            try {
                Map<String, String> payload = mapper.readValue(ctx.body(), new TypeReference<Map<String, String>>() {
                });
                String email = payload.get("email");
                String otp = payload.get("otp");

                boolean verified = userDAO.verifyOtp(email, otp);
                if (verified) {
                    ctx.status(200).json(Map.of("message",
                            "Email verified successfully! Your account is now pending admin approval."));
                } else {
                    ctx.status(400).json(Map.of("error", "Invalid or expired OTP."));
                }
            } catch (JsonProcessingException e) {
                ctx.status(500).json(Map.of("error", "Server error"));
            }
        });

        // 9c. Resend OTP
        app.post("/api/auth/resend-otp", ctx -> {
            try {
                Map<String, String> payload = mapper.readValue(ctx.body(), new TypeReference<Map<String, String>>() {
                });
                String email = payload.get("email");

                String newOtp = userDAO.generateAndStoreOtp(email);
                if (newOtp != null) {
                    System.out.println("=================================================");
                    System.out.println("RESENT EMAIL OTP FOR " + email + ": " + newOtp);
                    System.out.println("=================================================");
                    ctx.status(200).json(Map.of("message", "A new OTP has been sent."));
                } else {
                    ctx.status(400).json(Map.of("error", "Failed to generate OTP. User might not exist."));
                }
            } catch (JsonProcessingException e) {
                ctx.status(500).json(Map.of("error", "Server error"));
            }
        });

        // 10. Student: Get Booking History
        app.get("/api/bookings/my-rides", ctx -> {
            try {
                String token = ctx.cookie("jwt");
                if (token == null) {
                    ctx.status(401).json(Map.of("error", "Unauthorized."));
                    return;
                }
                int passengerId = authService.validateTokenAndGetUserId(token);
                if (passengerId == -1) {
                    ctx.status(401).json(Map.of("error", "Invalid session."));
                    return;
                }

                List<Map<String, Object>> myBookings = rideDAO.getPassengerBookings(passengerId);
                ctx.status(200).json(myBookings);
            } catch (NullPointerException | IllegalArgumentException e) {
                System.err.println("Error fetching bookings: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error fetching bookings."));
            }
        });

        // 11. Check Auth Status
        app.get("/api/check-auth", ctx -> {
            try {
                String token = ctx.cookie("jwt");
                if (token == null) {
                    ctx.status(401).json(Map.of("isAuthenticated", false));
                    return;
                }

                String role = authService.validateTokenAndGetRole(token);
                if (role == null) {
                    ctx.status(401).json(Map.of("isAuthenticated", false));
                    return;
                }

                boolean isVerified = authService.validateTokenAndGetIsVerified(token);

                ctx.status(200).json(Map.of(
                        "isAuthenticated", true,
                        "role", role,
                        "isVerified", isVerified));
            } catch (NullPointerException | IllegalArgumentException e) {
                System.err.println("Error checking auth status: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error"));
            }
        });

        // 12. Check Active Status (is driver offering, or passenger booked)
        app.get("/api/user/active-status", ctx -> {
            try {
                String token = ctx.cookie("jwt");
                if (token == null) {
                    ctx.status(401).json(Map.of("error", "Unauthorized."));
                    return;
                }
                int userId = authService.validateTokenAndGetUserId(token);
                if (userId == -1) {
                    ctx.status(401).json(Map.of("error", "Invalid session."));
                    return;
                }

                boolean isDriver = rideDAO.hasActiveOfferedRide(userId);
                boolean isPassenger = rideDAO.hasActiveBookedRide(userId);
                int driverRideId = isDriver ? rideDAO.getActiveRideIdByDriver(userId) : -1;

                ctx.status(200).json(Map.of(
                        "isDriver", isDriver,
                        "isPassenger", isPassenger,
                        "driverRideId", driverRideId));
            } catch (NullPointerException | IllegalArgumentException e) {
                System.err.println("Error checking active status: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error checking active status."));
            }
        });

        // 13. Cancel Offered Ride
        app.post("/api/rides/cancel", ctx -> {
            try {
                String token = ctx.cookie("jwt");
                if (token == null) {
                    ctx.status(401).json(Map.of("error", "Unauthorized."));
                    return;
                }
                int userId = authService.validateTokenAndGetUserId(token);
                if (userId == -1) {
                    ctx.status(401).json(Map.of("error", "Invalid session."));
                    return;
                }
                int currentRideId = rideDAO.getActiveRideIdByDriver(userId); // Get before cancelling
                boolean success = rideDAO.cancelOfferedRide(userId);
                if (success) {
                    ctx.status(200).json(Map.of("message", "Ride cancelled successfully."));
                    if (currentRideId != -1) {
                        Set<WsContext> sessions = rideSessions.get(currentRideId);
                        if (sessions != null && !sessions.isEmpty()) {
                            for (WsContext session : sessions) {
                                try {
                                    session.send("{\"type\": \"DRIVER_CANCELLED\"}");
                                } catch (Exception e) {
                                }
                            }
                        }
                    }
                } else {
                    ctx.status(400).json(Map.of("error", "Failed to cancel ride."));
                }
            } catch (NullPointerException | IllegalArgumentException e) {
                System.err.println("Error cancelling ride: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error cancelling ride."));
            }
        });

        // 14. Cancel Booking
        app.post("/api/bookings/cancel", ctx -> {
            try {
                String token = ctx.cookie("jwt");
                if (token == null) {
                    ctx.status(401).json(Map.of("error", "Unauthorized."));
                    return;
                }
                int userId = authService.validateTokenAndGetUserId(token);
                if (userId == -1) {
                    ctx.status(401).json(Map.of("error", "Invalid session."));
                    return;
                }

                boolean success = rideDAO.cancelBooking(userId);
                if (success) {
                    ctx.status(200).json(Map.of("message", "Booking cancelled successfully."));
                } else {
                    ctx.status(400).json(Map.of("error", "Failed to cancel booking."));
                }
            } catch (NullPointerException | IllegalArgumentException e) {
                System.err.println("Error cancelling booking: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error cancelling booking."));
            }
        });

        // 14b. Booking Management Endpoints
        app.get("/api/rides/{rideId}/bookings", ctx -> {
            try {
                int rideId = Integer.parseInt(ctx.pathParam("rideId"));
                List<Map<String, Object>> bookings = rideDAO.getRideBookingsForDriver(rideId);
                ctx.status(200).json(bookings);
            } catch (Exception e) {
                ctx.status(500).json(Map.of("error", "Server error"));
            }
        });

        app.post("/api/bookings/{bookingId}/{action}", ctx -> {
            try {
                int bookingId = Integer.parseInt(ctx.pathParam("bookingId"));
                String action = ctx.pathParam("action"); // "accept", "reject", "arrived"
                int rideId = rideDAO.getRideIdByBookingId(bookingId);
                if (rideId == -1) {
                    ctx.status(404).json(Map.of("error", "Booking not found"));
                    return;
                }

                String newStatus;
                String wsType;
                if ("accept".equals(action)) {
                    newStatus = "ACCEPTED";
                    wsType = "BOOKING_ACCEPTED";
                } else if ("reject".equals(action)) {
                    newStatus = "REJECTED";
                    wsType = "BOOKING_REJECTED";
                    rideDAO.incrementAvailableSeats(bookingId);
                } else if ("arrived".equals(action)) {
                    newStatus = "DRIVER_ARRIVED";
                    wsType = "DRIVER_ARRIVED";
                } else {
                    ctx.status(400).json(Map.of("error", "Invalid action"));
                    return;
                }

                boolean success = rideDAO.updateBookingStatus(bookingId, newStatus);
                if (success) {
                    ctx.status(200).json(Map.of("message", "Booking updated to " + newStatus));
                    // Broadcast to student
                    Set<WsContext> sessions = rideSessions.get(rideId);
                    if (sessions != null && !sessions.isEmpty()) {
                        for (WsContext session : sessions) {
                            try {
                                session.send("{\"type\": \"" + wsType + "\"}");
                            } catch (Exception e) {
                            }
                        }
                    }
                } else {
                    ctx.status(400).json(Map.of("error", "Failed to update booking"));
                }
            } catch (Exception e) {
                ctx.status(500).json(Map.of("error", "Server error"));
            }
        });

        // 15. Live Location Updates
        app.post("/api/location/update", ctx -> {
            try {
                String token = ctx.cookie("jwt");
                if (token == null) {
                    ctx.status(401);
                    return;
                }
                int userId = authService.validateTokenAndGetUserId(token);
                if (userId == -1) {
                    ctx.status(401);
                    return;
                }

                Map<String, Double> payload = mapper.readValue(ctx.body(), new TypeReference<Map<String, Double>>() {
                });
                double lat = payload.get("lat");
                double lng = payload.get("lng");
                Coordinate loc = new Coordinate();
                loc.setLat(lat);
                loc.setLng(lng);

                if (rideDAO.hasActiveOfferedRide(userId)) {
                    int rideId;
                    if (payload.containsKey("rideId")) {
                        rideId = payload.get("rideId").intValue();
                    } else {
                        rideId = rideDAO.getActiveRideIdByDriver(userId);
                    }

                    if (rideId != -1) {
                        driverLocations.put(rideId, loc);

                        Set<WsContext> sessions = rideSessions.get(rideId);
                        if (sessions != null && !sessions.isEmpty()) {
                            for (WsContext session : sessions) {
                                try {
                                    session.send("{\"lat\": " + lat + ", \"lng\": " + lng + "}");
                                } catch (org.eclipse.jetty.websocket.api.exceptions.WebSocketException
                                        | IllegalStateException e) {
                                    System.err.println("Error broadcasting location via WS: " + e.getMessage());
                                }
                            }
                        }
                    }
                }
                if (rideDAO.hasActiveBookedRide(userId)) {
                    passengerLocations.put(userId, loc);
                }
                ctx.status(200).json(Map.of("status", "ok"));
            } catch (JsonProcessingException | NullPointerException e) {
                System.err.println("Error updating location: " + e.getMessage());
                ctx.status(500);
            }
        });

        // 16. Get Live Data for a Ride
        app.get("/api/rides/{rideId}/live", ctx -> {
            try {
                int rideId = Integer.parseInt(ctx.pathParam("rideId"));

                int availableSeats = rideDAO.getAvailableSeats(rideId);
                Coordinate driverLoc = driverLocations.get(rideId);
                List<Map<String, Object>> accepted = rideDAO.getAcceptedPassengersForRide(rideId);

                List<Map<String, Object>> passengers = new ArrayList<>();
                for (Map<String, Object> p : accepted) {
                    int pid = (int) p.get("id");
                    if (passengerLocations.containsKey(pid)) {
                        Map<String, Object> passengerData = new java.util.HashMap<>(p);
                        Coordinate loc = passengerLocations.get(pid);
                        passengerData.put("lat", loc.getLat());
                        passengerData.put("lng", loc.getLng());
                        passengers.add(passengerData);
                    }
                }

                ctx.status(200).json(Map.of(
                        "availableSeats", availableSeats,
                        "driverLocation", driverLoc != null ? driverLoc : "null",
                        "passengers", passengers));
            } catch (NumberFormatException e) {
                System.err.println("Error fetching live ride data: " + e.getMessage());
                ctx.status(500);
            }
        });

        // 17. Save Vehicle Profile
        app.post("/api/profile/vehicle", ctx -> {
            try {
                String token = ctx.cookie("jwt");
                if (token == null) {
                    ctx.status(401);
                    return;
                }
                int userId = authService.validateTokenAndGetUserId(token);
                if (userId == -1) {
                    ctx.status(401);
                    return;
                }

                Map<String, String> payload = mapper.readValue(ctx.body(), new TypeReference<Map<String, String>>() {
                });
                boolean success = userDAO.saveVehicle(userId, payload.get("make"), payload.get("model"),
                        payload.get("licensePlate"), payload.get("color"));
                if (success) {
                    ctx.status(200).json(Map.of("message", "Vehicle profile saved!"));
                } else {
                    ctx.status(400).json(Map.of("error", "Failed to save vehicle profile."));
                }
            } catch (JsonProcessingException | NullPointerException e) {
                System.err.println("Error saving vehicle profile: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error"));
            }
        });

        // 18. Get Vehicle Profile
        app.get("/api/profile/vehicle", ctx -> {
            try {
                String token = ctx.cookie("jwt");
                if (token == null) {
                    ctx.status(401);
                    return;
                }
                int userId = authService.validateTokenAndGetUserId(token);
                if (userId == -1) {
                    ctx.status(401);
                    return;
                }

                Map<String, String> vehicle = userDAO.getVehicle(userId);
                if (vehicle != null) {
                    ctx.status(200).json(vehicle);
                } else {
                    ctx.status(404).json(Map.of("error", "No vehicle profile found."));
                }
            } catch (NullPointerException | IllegalArgumentException e) {
                System.err.println("Error fetching vehicle profile: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error"));
            }
        });

        // 18b. Save Favorite Route
        app.post("/api/user/route/favorite", ctx -> {
            try {
                String token = ctx.cookie("jwt");
                if (token == null) {
                    ctx.status(401);
                    return;
                }
                int userId = authService.validateTokenAndGetUserId(token);
                if (userId == -1) {
                    ctx.status(401);
                    return;
                }

                Map<String, Object> payload = mapper.readValue(ctx.body(), new TypeReference<Map<String, Object>>() {
                });
                String routeName = (String) payload.get("name");
                String waypointsJson = mapper.writeValueAsString(payload.get("waypoints"));

                boolean success = userDAO.saveFavoriteRoute(userId, routeName, waypointsJson);
                if (success) {
                    ctx.status(200).json(Map.of("message", "Route favorited!"));
                } else {
                    ctx.status(400).json(Map.of("error", "Failed to save favorite route."));
                }
            } catch (Exception e) {
                System.err.println("Error saving favorite route: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error"));
            }
        });

        // 18c. Get Favorite Route
        app.get("/api/user/route/favorite", ctx -> {
            try {
                String token = ctx.cookie("jwt");
                if (token == null) {
                    ctx.status(401);
                    return;
                }
                int userId = authService.validateTokenAndGetUserId(token);
                if (userId == -1) {
                    ctx.status(401);
                    return;
                }

                String routeJson = userDAO.getFavoriteRoute(userId);
                if (routeJson != null) {
                    ctx.status(200).result(routeJson).contentType("application/json");
                } else {
                    ctx.status(404).json(Map.of("error", "No favorite route found."));
                }
            } catch (Exception e) {
                System.err.println("Error fetching favorite route: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error"));
            }
        });

        // 20. Update Ride Status
        app.post("/api/rides/{id}/status", ctx -> {
            try {
                String token = ctx.cookie("jwt");
                if (token == null) {
                    ctx.status(401).json(Map.of("error", "Unauthorized."));
                    return;
                }
                int driverId = authService.validateTokenAndGetUserId(token);
                if (driverId == -1) {
                    ctx.status(401).json(Map.of("error", "Invalid session."));
                    return;
                }

                int rideId = Integer.parseInt(ctx.pathParam("id"));
                Map<String, String> payload = mapper.readValue(ctx.body(), new TypeReference<Map<String, String>>() {
                });
                String newStatus = payload.get("status");

                boolean success = rideDAO.updateRideStatus(rideId, newStatus);
                if (success) {
                    Set<WsContext> sessions = rideSessions.get(rideId);
                    if (sessions != null && !sessions.isEmpty()) {
                        String msg = mapper.writeValueAsString(Map.of(
                                "type", "STATUS_UPDATE",
                                "status", newStatus,
                                "rideId", rideId));
                        for (WsContext session : sessions) {
                            try {
                                session.send(msg);
                            } catch (Exception e) {
                                System.err.println("Error broadcasting status via WS: " + e.getMessage());
                            }
                        }
                    }
                    ctx.status(200).json(Map.of("message", "Status updated to " + newStatus));
                } else {
                    ctx.status(400).json(Map.of("error", "Failed to update status."));
                }
            } catch (JsonProcessingException | NullPointerException | IllegalArgumentException e) {
                System.err.println("Error updating status: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error"));
            }
        });

        // 21. Analytics Endpoint
        app.get("/api/analytics", ctx -> {
            try {
                Map<String, Object> stats = rideDAO.getCampusAnalytics();
                double totalKmShared = Double.parseDouble(stats.getOrDefault("totalKm", 0.0).toString());
                int completedRides = Integer.parseInt(stats.getOrDefault("completedCount", 0).toString());

                double co2SavedKg = totalKmShared * 0.120;
                double moneySavedInr = totalKmShared * 10.0;

                ctx.status(200).json(Map.of(
                        "totalKmShared", totalKmShared,
                        "co2SavedKg", co2SavedKg,
                        "moneySavedInr", moneySavedInr,
                        "completedRides", completedRides));
            } catch (Exception e) {
                System.err.println("Error fetching analytics: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error"));
            }
        });

        // 23. SOS Emergency Endpoint
        app.post("/api/rides/{id}/sos", ctx -> {
            try {
                String token = ctx.cookie("jwt");
                if (token == null) {
                    ctx.status(401).json(Map.of("error", "Unauthorized."));
                    return;
                }
                int reporterId = authService.validateTokenAndGetUserId(token);
                if (reporterId == -1) {
                    ctx.status(401).json(Map.of("error", "Invalid session."));
                    return;
                }

                int rideId = Integer.parseInt(ctx.pathParam("id"));
                Map<String, Double> payload = mapper.readValue(ctx.body(), new TypeReference<Map<String, Double>>() {
                });
                double lat = payload.get("lat");
                double lng = payload.get("lng");

                boolean success = rideDAO.reportSos(rideId, reporterId, lat, lng);
                if (success) {
                    Set<WsContext> sessions = rideSessions.get(rideId);
                    if (sessions != null && !sessions.isEmpty()) {
                        String msg = mapper.writeValueAsString(Map.of("type", "SOS_ALERT", "rideId", rideId));
                        for (WsContext session : sessions) {
                            try {
                                if (session.session.isOpen())
                                    session.send(msg);
                            } catch (Exception e) {
                                System.err.println("Error broadcasting SOS via WS: " + e.getMessage());
                            }
                        }
                    }
                    ctx.status(200).json(Map.of("message", "Emergency alert dispatched."));
                } else {
                    ctx.status(400).json(Map.of("error", "Failed to dispatch SOS."));
                }
            } catch (JsonProcessingException | NullPointerException | IllegalArgumentException e) {
                System.err.println("Error reporting SOS: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error"));
            }
        });

        // 22. Chat History Endpoint
        app.get("/api/rides/{rideId}/chat", ctx -> {
            try {
                int rideId = Integer.parseInt(ctx.pathParam("rideId"));
                List<Map<String, Object>> chatHistory = rideChats.getOrDefault(rideId, new ArrayList<>());
                ctx.status(200).json(chatHistory);
            } catch (NumberFormatException e) {
                ctx.status(500).json(Map.of("error", "Server error"));
            }
        });

        // 19. WebSocket Live Tracking Endpoint
        app.ws("/ws/rides/{rideId}/live", ws -> {
            ws.onConnect(ctx -> {
                try {
                    int rideId = Integer.parseInt(ctx.pathParam("rideId"));
                    rideSessions.computeIfAbsent(rideId, k -> ConcurrentHashMap.newKeySet()).add(ctx);
                    System.out
                            .println("WebSocket connected for ride " + rideId + " (session: " + ctx.sessionId() + ")");
                } catch (NumberFormatException e) {
                    System.err.println("WebSocket onConnect error: " + e.getMessage());
                }
            });

            ws.onMessage(ctx -> {
                try {
                    int rideId = Integer.parseInt(ctx.pathParam("rideId"));
                    Map<String, Object> message = mapper.readValue(ctx.message(),
                            new TypeReference<Map<String, Object>>() {
                            });

                    if ("CHAT_MESSAGE".equals(message.get("type"))) {
                        // Save to history
                        rideChats.computeIfAbsent(rideId, k -> new ArrayList<>()).add(message);

                        // Broadcast to everyone in this ride session
                        Set<WsContext> sessions = rideSessions.get(rideId);
                        if (sessions != null) {
                            String msgJson = mapper.writeValueAsString(message);
                            for (WsContext session : sessions) {
                                if (session.session.isOpen()) {
                                    session.send(msgJson);
                                }
                            }
                        }
                    }
                } catch (Exception e) {
                    System.err.println("WebSocket onMessage error: " + e.getMessage());
                }
            });

            ws.onClose(ctx -> {
                try {
                    int rideId = Integer.parseInt(ctx.pathParam("rideId"));
                    Set<WsContext> sessions = rideSessions.get(rideId);
                    if (sessions != null) {
                        sessions.remove(ctx);
                        if (sessions.isEmpty()) {
                            rideSessions.remove(rideId);
                        }
                    }
                    System.out.println("WebSocket closed for ride " + rideId + " (session: " + ctx.sessionId() + ")");
                } catch (NumberFormatException e) {
                    System.err.println("WebSocket onClose error: " + e.getMessage());
                }
            });

            ws.onError(ctx -> {
                try {
                    int rideId = Integer.parseInt(ctx.pathParam("rideId"));
                    Set<WsContext> sessions = rideSessions.get(rideId);
                    if (sessions != null) {
                        sessions.remove(ctx);
                        if (sessions.isEmpty()) {
                            rideSessions.remove(rideId);
                        }
                    }
                    Throwable err = ctx.error();
                    if (err != null) {
                        System.err
                                .println("WebSocket error for ride " + rideId + " (session: " + ctx.sessionId() + "): "
                                        + err.getMessage());
                    } else {
                        System.err
                                .println("WebSocket error for ride " + rideId + " (session: " + ctx.sessionId() + ")");
                    }
                } catch (NumberFormatException e) {
                    System.err.println("WebSocket onError error: " + e.getMessage());
                }
            });
        });
    }
}