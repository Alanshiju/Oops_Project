package com.campus;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.javalin.Javalin;
import io.javalin.http.Cookie;
import io.javalin.http.SameSite;
import io.javalin.http.UploadedFile;
import io.javalin.http.staticfiles.Location;
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
        // LocationService locationService = new LocationService();

        // Task 2 & Constraint 3: Orphaned Ride Reaper background daemon (runs every 10
        // minutes)
        ScheduledExecutorService reaperScheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "RideReaper-Thread");
            t.setDaemon(true);
            return t;
        });
        reaperScheduler.scheduleAtFixedRate(() -> {
            try {
                rideDAO.reapOrphanedRides();
            } catch (Exception e) {
                System.err.println("Error running RideReaper: " + e.getMessage());
            }
        }, 1, 10, TimeUnit.MINUTES);

        // 1. Create a physical 'uploads' folder on your hard drive if it doesn't exist
        File uploadDir = new File("uploads");
        if (!uploadDir.exists()) {
            uploadDir.mkdir();
        }

        // 0. Initialize Database Tables if they don't exist (MySQL)
        try (java.sql.Connection conn = DatabaseConnection.getConnection();
                java.sql.Statement stmt = conn.createStatement()) {

            // 0a. Users Table
            stmt.execute("CREATE TABLE IF NOT EXISTS Users (" +
                    "user_id INT AUTO_INCREMENT PRIMARY KEY, " +
                    "name VARCHAR(100) NOT NULL, " +
                    "email VARCHAR(100) NOT NULL UNIQUE, " +
                    "password VARCHAR(255) NULL, " +
                    "phone_number VARCHAR(20) NULL, " +
                    "role VARCHAR(20) DEFAULT 'USER', " +
                    "vehicle_details VARCHAR(255) NULL, " +
                    "is_verified BOOLEAN DEFAULT FALSE, " +
                    "college_id_url VARCHAR(255) NULL, " +
                    "verification_photo_url VARCHAR(255) NULL, " +
                    "otp_code VARCHAR(6) NULL, " +
                    "otp_expires_at TIMESTAMP NULL, " +
                    "is_email_verified BOOLEAN DEFAULT FALSE, " +
                    "favorite_route VARCHAR(2000) NULL" +
                    ")");

            // 0b. Rides Table
            stmt.execute("CREATE TABLE IF NOT EXISTS Rides (" +
                    "ride_id INT AUTO_INCREMENT PRIMARY KEY, " +
                    "driver_id INT NOT NULL, " +
                    "origin_lat DOUBLE NULL, " +
                    "origin_lng DOUBLE NULL, " +
                    "dest_lat DOUBLE NULL, " +
                    "dest_lng DOUBLE NULL, " +
                    "departure_time TIMESTAMP NULL, " +
                    "total_seats INT NOT NULL DEFAULT 3, " +
                    "available_seats INT NOT NULL DEFAULT 3, " +
                    "route_geometry JSON NULL, " +
                    "distance_km DOUBLE DEFAULT 0.0, " +
                    "cost_per_seat DOUBLE DEFAULT 0.0, " +
                    "is_free_ride BOOLEAN DEFAULT FALSE, " +
                    "is_emergency BOOLEAN DEFAULT FALSE, " +
                    "emergency_reported_at TIMESTAMP NULL, " +
                    "route_linestring LINESTRING NULL, " +
                    "estimated_duration_mins INT DEFAULT 0, " +
                    "status ENUM('PENDING', 'DRIVER_ARRIVED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING', "
                    +
                    "FOREIGN KEY (driver_id) REFERENCES Users(user_id)" +
                    ")");

            // 0c. Bookings Table
            stmt.execute("CREATE TABLE IF NOT EXISTS Bookings (" +
                    "booking_id INT AUTO_INCREMENT PRIMARY KEY, " +
                    "ride_id INT NOT NULL, " +
                    "passenger_id INT NOT NULL, " +
                    "booking_status ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'DRIVER_ARRIVED', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING', "
                    +
                    "pickup_lat DOUBLE NULL, " +
                    "pickup_lng DOUBLE NULL, " +
                    "FOREIGN KEY (ride_id) REFERENCES Rides(ride_id), " +
                    "FOREIGN KEY (passenger_id) REFERENCES Users(user_id)" +
                    ")");

            // 0d. Vehicles Table
            stmt.execute("CREATE TABLE IF NOT EXISTS Vehicles (" +
                    "user_id INT PRIMARY KEY, " +
                    "make VARCHAR(50), " +
                    "model VARCHAR(50), " +
                    "license_plate VARCHAR(20), " +
                    "color VARCHAR(20), " +
                    "FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE" +
                    ")");
            System.out.println("Vehicles table verified.");

            // 0e. Incident_Reports Table
            stmt.execute("CREATE TABLE IF NOT EXISTS Incident_Reports (" +
                    "incident_id INT AUTO_INCREMENT PRIMARY KEY, " +
                    "ride_id INT NULL, " +
                    "reporter_id INT NULL, " +
                    "reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                    "last_known_lat DOUBLE NULL, " +
                    "last_known_lng DOUBLE NULL, " +
                    "status VARCHAR(50) DEFAULT 'ACTIVE'" +
                    ")");
            System.out.println("Incident_Reports table verified.");

            // 0f. System_Settings Table (Task 4: Dynamic Admin CMS Destination)
            stmt.execute("CREATE TABLE IF NOT EXISTS System_Settings (" +
                    "setting_key VARCHAR(100) PRIMARY KEY, " +
                    "setting_value JSON NOT NULL" +
                    ")");
            System.out.println("System_Settings table verified.");

            // Incremental column verification for MySQL
            try {
                stmt.execute(
                        "ALTER TABLE Rides MODIFY COLUMN status ENUM('PENDING', 'DRIVER_ARRIVED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING'");
            } catch (Exception ignore) {
                try {
                    stmt.execute(
                            "ALTER TABLE Rides ADD COLUMN status ENUM('PENDING', 'DRIVER_ARRIVED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING'");
                } catch (Exception ignore2) {
                }
            }
            try {
                stmt.execute(
                        "ALTER TABLE Bookings MODIFY booking_status ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'DRIVER_ARRIVED', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING'");
            } catch (Exception ignore) {
                System.err.println("Error modifying Bookings ENUM: " + ignore.getMessage());
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
            try {
                stmt.execute("ALTER TABLE Rides ADD COLUMN route_linestring LINESTRING NULL");
            } catch (Exception ignore) {
            }
            try {
                stmt.execute("ALTER TABLE Rides MODIFY route_linestring LINESTRING SRID 4326");
            } catch (Exception ignore) {
            }
            try {
                stmt.execute("CREATE SPATIAL INDEX sx_route_linestring ON Rides(route_linestring)");
            } catch (Exception ignore) {
            }
            try {
                stmt.execute("ALTER TABLE Rides ADD COLUMN estimated_duration_mins INT DEFAULT 0");
            } catch (Exception ignore) {
            }

            try {
                stmt.execute("ALTER TABLE Users ADD COLUMN otp_code VARCHAR(6)");
            } catch (Exception ignore) {
            }
            try {
                stmt.execute("ALTER TABLE Users ADD COLUMN otp_expires_at TIMESTAMP NULL");
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

            try {
                stmt.execute(
                        "ALTER TABLE Bookings MODIFY COLUMN booking_status ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'DRIVER_ARRIVED', 'CANCELLED') DEFAULT 'PENDING'");
            } catch (Exception ignore) {
                try {
                    stmt.execute(
                            "ALTER TABLE Bookings ADD COLUMN booking_status ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'DRIVER_ARRIVED', 'CANCELLED') DEFAULT 'PENDING'");
                } catch (Exception ignore2) {
                }
            }
            try {
                stmt.execute("ALTER TABLE Bookings ADD COLUMN pickup_lat DOUBLE");
            } catch (Exception ignore) {
            }
            try {
                stmt.execute("ALTER TABLE Bookings ADD COLUMN pickup_lng DOUBLE");
            } catch (Exception ignore) {
            }
            System.out.println("MySQL table schemas and constraints verified.");

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

                Double pickupLat = requestBody.get("lat");
                Double pickupLng = requestBody.get("lng");
                boolean success = rideDAO.bookSeatInDatabase(rideId, passengerId, pickupLat, pickupLng);
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
                int estimatedDurationMins = 0;
                if (payload.containsKey("estimatedDurationMins") && payload.get("estimatedDurationMins") != null) {
                    try {
                        estimatedDurationMins = Integer.parseInt(payload.get("estimatedDurationMins").toString());
                    } catch (Exception ignore) {
                    }
                }

                boolean isSaved = rideDAO.saveRouteDetails(rideId, routeGeometryJson, distanceKm, isFreeRide,
                        estimatedDurationMins);

                if (isSaved)
                    ctx.status(200).json(Map.of("message", "Route saved!"));
                else
                    ctx.status(400).json(Map.of("error", "Database failed to save the route."));
            } catch (NumberFormatException | JsonProcessingException | NullPointerException e) {
                System.err.println("Error saving route: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Failed to parse route data."));
            }
        });

        // 4. Search Nearby Rides Endpoint (Task 1 & Task 2: MySQL Spatial Engine &
        // Route Projection)
        app.post("/api/rides/search", ctx -> {
            try {
                Coordinate studentLoc = mapper.readValue(ctx.body(), Coordinate.class);
                List<Ride> matchingRides = rideDAO.searchNearbyRides(studentLoc.getLat(), studentLoc.getLng());
                ctx.status(200).json(matchingRides);
            } catch (JsonProcessingException e) {
                System.err.println("Error searching rides: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Failed to search for rides."));
            }
        });

        app.get("/api/rides/search", ctx -> {
            try {
                String latParam = ctx.queryParam("lat");
                String lngParam = ctx.queryParam("lng");
                if (latParam != null && lngParam != null) {
                    double lat = Double.parseDouble(latParam);
                    double lng = Double.parseDouble(lngParam);
                    List<Ride> matchingRides = rideDAO.searchNearbyRides(lat, lng);
                    ctx.status(200).json(matchingRides);
                } else {
                    List<Ride> allRides = rideDAO.getAllActiveRides();
                    ctx.status(200).json(allRides);
                }
            } catch (Exception e) {
                System.err.println("Error searching rides via GET: " + e.getMessage());
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

        // 6b. Admin: Audit Logs with T-SQL Pagination support
        app.get("/api/admin/rides/audit", ctx -> {
            try {
                String offsetParam = ctx.queryParam("offset");
                String limitParam = ctx.queryParam("limit");
                List<Map<String, Object>> logs;
                if (offsetParam != null || limitParam != null) {
                    int offset = offsetParam != null ? Integer.parseInt(offsetParam) : 0;
                    int limit = limitParam != null ? Integer.parseInt(limitParam) : 50;
                    logs = rideDAO.getAuditLogs(offset, limit);
                } else {
                    logs = rideDAO.getAuditLogs();
                }
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

                if (user != null && user.getPassword() != null && userDAO.verifyLogin(password, user.getPassword())) {
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

        // 11. User Profile APIs (Task 1)
        app.get("/api/user/profile", ctx -> {
            String token = ctx.cookie("jwt");
            if (token == null) {
                ctx.status(401).json(Map.of("error", "Unauthorized"));
                return;
            }
            int userId = authService.validateTokenAndGetUserId(token);
            if (userId == -1) {
                ctx.status(401).json(Map.of("error", "Invalid session"));
                return;
            }
            Map<String, Object> profile = userDAO.getUserProfile(userId);
            if (profile != null) {
                ctx.status(200).json(profile);
            } else {
                ctx.status(404).json(Map.of("error", "User not found"));
            }
        });

        app.put("/api/user/profile", ctx -> {
            String token = ctx.cookie("jwt");
            if (token == null) {
                ctx.status(401).json(Map.of("error", "Unauthorized"));
                return;
            }
            int userId = authService.validateTokenAndGetUserId(token);
            if (userId == -1) {
                ctx.status(401).json(Map.of("error", "Invalid session"));
                return;
            }

            try {
                Map<String, String> body = mapper.readValue(ctx.body(), new TypeReference<Map<String, String>>() {
                });
                String name = body.get("name");
                String phone = body.get("phone");

                if (userDAO.updateUserProfile(userId, name, phone)) {
                    ctx.status(200).json(Map.of("message", "Profile updated successfully"));
                } else {
                    ctx.status(400).json(Map.of("error", "Failed to update profile"));
                }
            } catch (JsonProcessingException e) {
                ctx.status(400).json(Map.of("error", "Invalid request body"));
            }
        });

        app.post("/api/user/change-password", ctx -> {
            String token = ctx.cookie("jwt");
            if (token == null) {
                ctx.status(401).json(Map.of("error", "Unauthorized"));
                return;
            }
            int userId = authService.validateTokenAndGetUserId(token);
            if (userId == -1) {
                ctx.status(401).json(Map.of("error", "Invalid session"));
                return;
            }

            try {
                Map<String, String> body = mapper.readValue(ctx.body(), new TypeReference<Map<String, String>>() {
                });
                String currentPassword = body.get("currentPassword");
                String newPassword = body.get("newPassword");

                if (currentPassword == null || newPassword == null || newPassword.length() < 6) {
                    ctx.status(400).json(Map.of("error", "Valid current and new password (min 6 chars) are required."));
                    return;
                }

                if (userDAO.updatePassword(userId, currentPassword, newPassword)) {
                    ctx.status(200).json(Map.of("message", "Password changed successfully."));
                } else {
                    ctx.status(400).json(Map.of("error", "Incorrect current password or server error."));
                }
            } catch (JsonProcessingException e) {
                ctx.status(400).json(Map.of("error", "Invalid request body"));
            }
        });

        // 12. Check Auth Status
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

                Map<String, Object> response = new java.util.HashMap<>();
                response.put("isDriver", isDriver);
                response.put("isPassenger", isPassenger);
                response.put("driverRideId", driverRideId);

                if (isDriver && driverRideId != -1) {
                    Map<String, Object> rideDetails = rideDAO.getActiveRideDetailsForDriver(userId);
                    if (rideDetails != null) {
                        response.put("rideStatus", rideDetails.get("rideStatus"));
                        response.put("distance_km", rideDetails.get("distance_km"));
                        response.put("seats", rideDetails.get("seats"));
                        String geomStr = (String) rideDetails.get("route_geometry");
                        if (geomStr != null && !geomStr.trim().isEmpty()) {
                            try {
                                response.put("route_geometry", mapper.readTree(geomStr));
                            } catch (Exception e) {
                                response.put("route_geometry", geomStr);
                            }
                        } else {
                            response.put("route_geometry", null);
                        }
                    }
                }

                ctx.status(200).json(response);
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

                        List<Map<String, Object>> acceptedPassengers = rideDAO.getAcceptedPassengersForRide(rideId);

                        // Task 3 & Constraint 2: Calculate live ETA with 1.4 tortuosity factor for
                        // accepted passengers
                        Map<Integer, Integer> passengerEtas = new java.util.HashMap<>();
                        Integer generalEta = null;
                        for (Map<String, Object> passenger : acceptedPassengers) {
                            if (passenger.get("lat") != null && passenger.get("lng") != null) {
                                double pLat = (Double) passenger.get("lat");
                                double pLng = (Double) passenger.get("lng");
                                int eta = LocationService.calculateLiveEtaMinutes(lat, lng, pLat, pLng);
                                passengerEtas.put((Integer) passenger.get("id"), eta);
                                if (generalEta == null && "ACCEPTED".equals(passenger.get("status"))) {
                                    generalEta = eta;
                                }
                            }
                        }

                        Set<WsContext> sessions = rideSessions.get(rideId);
                        if (sessions != null && !sessions.isEmpty()) {
                            for (WsContext session : sessions) {
                                try {
                                    Integer sessionUserId = session.attribute("userId");
                                    Integer sessionEta = (sessionUserId != null
                                            && passengerEtas.containsKey(sessionUserId))
                                                    ? passengerEtas.get(sessionUserId)
                                                    : generalEta;
                                    String telemetryJson = "{\"type\": \"TELEMETRY_UPDATE\", \"lat\": " + lat
                                            + ", \"lng\": "
                                            + lng + ", \"role\": \"DRIVER\""
                                            + (sessionEta != null ? ", \"eta_minutes\": " + sessionEta : "")
                                            + "}";
                                    session.send(telemetryJson);
                                } catch (org.eclipse.jetty.websocket.api.exceptions.WebSocketException
                                        | IllegalStateException e) {
                                    System.err.println("Error broadcasting location via WS: " + e.getMessage());
                                }
                            }
                        }

                        // Task 4 & Constraint 2: Geofenced Auto-Arrival (< 50m) with strict idempotency
                        for (Map<String, Object> passenger : acceptedPassengers) {
                            String bStatus = (String) passenger.get("status");
                            if ("ACCEPTED".equals(bStatus) && passenger.get("lat") != null
                                    && passenger.get("lng") != null) {
                                double pLat = (Double) passenger.get("lat");
                                double pLng = (Double) passenger.get("lng");
                                double distMeters = LocationService.calculateDistance(lat, lng, pLat, pLng);

                                if (distMeters <= 50.0) {
                                    int bookingId = (Integer) passenger.get("bookingId");
                                    // Strictly updates only if booking_status == 'ACCEPTED'; returns true only if
                                    // rows affected == 1
                                    boolean markedArrived = rideDAO.markBookingArrivedIfAccepted(bookingId);
                                    if (markedArrived && sessions != null && !sessions.isEmpty()) {
                                        for (WsContext session : sessions) {
                                            try {
                                                session.send("{\"type\": \"DRIVER_ARRIVED\", \"bookingId\": "
                                                        + bookingId + "}");
                                            } catch (Exception wsErr) {
                                                System.err.println("Error broadcasting DRIVER_ARRIVED via WS: "
                                                        + wsErr.getMessage());
                                            }
                                        }
                                    }
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

        // 16. Get Live Data for a Ride (Task 2: Student Route Projection)
        app.get("/api/rides/{rideId}/live", ctx -> {
            try {
                int rideId = Integer.parseInt(ctx.pathParam("rideId"));

                int availableSeats = rideDAO.getAvailableSeats(rideId);
                Coordinate driverLoc = driverLocations.get(rideId);
                List<Map<String, Object>> accepted = rideDAO.getAcceptedPassengersForRide(rideId);

                List<Map<String, Object>> passengers = new ArrayList<>();
                for (Map<String, Object> p : accepted) {
                    int pid = (int) p.get("id");
                    Map<String, Object> passengerData = new java.util.HashMap<>(p);
                    if (passengerLocations.containsKey(pid)) {
                        Coordinate loc = passengerLocations.get(pid);
                        passengerData.put("lat", loc.getLat());
                        passengerData.put("lng", loc.getLng());
                    }
                    if (passengerData.containsKey("lat") && passengerData.get("lat") != null) {
                        passengers.add(passengerData);
                    }
                }

                List<Coordinate> routeGeometry = rideDAO.getRouteGeometryByRideId(rideId);

                Map<String, Object> responseData = new java.util.HashMap<>();
                responseData.put("availableSeats", availableSeats);
                responseData.put("driverLocation", driverLoc != null ? driverLoc : "null");
                responseData.put("passengers", passengers);
                responseData.put("routeGeometry", routeGeometry);

                ctx.status(200).json(responseData);
            } catch (NumberFormatException e) {
                System.err.println("Error fetching live ride data: " + e.getMessage());
                ctx.status(500);
            }
        });

        // Task 2: Admin User Management APIs
        app.get("/api/admin/users", ctx -> {
            String token = ctx.cookie("jwt");
            if (token == null) {
                ctx.status(401).json(Map.of("error", "Unauthorized"));
                return;
            }
            String role = authService.validateTokenAndGetRole(token);
            if (!"ADMIN".equalsIgnoreCase(role)) {
                ctx.status(403).json(Map.of("error", "Admin privileges required"));
                return;
            }

            List<Map<String, Object>> users = userDAO.getAllUsers();
            ctx.status(200).json(users);
        });

        app.put("/api/admin/users/{id}/status", ctx -> {
            String token = ctx.cookie("jwt");
            if (token == null) {
                ctx.status(401).json(Map.of("error", "Unauthorized"));
                return;
            }
            if (!"ADMIN".equalsIgnoreCase(authService.validateTokenAndGetRole(token))) {
                ctx.status(403).json(Map.of("error", "Admin privileges required"));
                return;
            }

            try {
                int targetId = Integer.parseInt(ctx.pathParam("id"));
                if (userDAO.toggleUserVerification(targetId)) {
                    ctx.status(200).json(Map.of("message", "User verification status toggled"));
                } else {
                    ctx.status(400).json(Map.of("error", "Failed to update user"));
                }
            } catch (NumberFormatException e) {
                ctx.status(400).json(Map.of("error", "Invalid user ID"));
            }
        });

        app.delete("/api/admin/users/{id}", ctx -> {
            String token = ctx.cookie("jwt");
            if (token == null) {
                ctx.status(401).json(Map.of("error", "Unauthorized"));
                return;
            }
            if (!"ADMIN".equalsIgnoreCase(authService.validateTokenAndGetRole(token))) {
                ctx.status(403).json(Map.of("error", "Admin privileges required"));
                return;
            }

            try {
                int targetId = Integer.parseInt(ctx.pathParam("id"));
                if (userDAO.deleteUserWithCascade(targetId)) {
                    ctx.status(200).json(Map.of("message", "User and all related data deleted successfully"));
                } else {
                    ctx.status(400).json(Map.of("error", "Failed to delete user"));
                }
            } catch (NumberFormatException e) {
                ctx.status(400).json(Map.of("error", "Invalid user ID"));
            }
        });

        // Task 4: Dynamic Admin CMS Destination Endpoints
        app.post("/api/admin/settings/destination", ctx -> {
            try {
                String token = ctx.cookie("jwt");
                if (token == null) {
                    ctx.status(401).json(Map.of("error", "Unauthorized"));
                    return;
                }
                String role = authService.validateTokenAndGetRole(token);
                if (!"ADMIN".equalsIgnoreCase(role)) {
                    ctx.status(403).json(Map.of("error", "Admin privileges required"));
                    return;
                }

                Map<String, Double> payload = mapper.readValue(ctx.body(), new TypeReference<Map<String, Double>>() {
                });
                if (!payload.containsKey("lat") || !payload.containsKey("lng")) {
                    ctx.status(400).json(Map.of("error", "lat and lng are required"));
                    return;
                }

                double lat = payload.get("lat");
                double lng = payload.get("lng");
                String jsonSetting = mapper.writeValueAsString(Map.of("lat", lat, "lng", lng));

                boolean saved = rideDAO.saveSetting("COLLEGE_DESTINATION", jsonSetting);
                if (saved) {
                    ctx.status(200).json(
                            Map.of("message", "Campus destination updated successfully!", "lat", lat, "lng", lng));
                } else {
                    ctx.status(500).json(Map.of("error", "Failed to update destination in database"));
                }
            } catch (Exception e) {
                System.err.println("Error setting campus destination: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error updating destination"));
            }
        });

        app.get("/api/settings/destination", ctx -> {
            try {
                String settingJson = rideDAO.getSetting("COLLEGE_DESTINATION");
                if (settingJson != null && !settingJson.trim().isEmpty()) {
                    ctx.status(200).result(settingJson).contentType("application/json");
                } else {
                    // Default fallback destination (Jyothi Engineering College)
                    ctx.status(200).json(Map.of("lat", 10.728, "lng", 76.2792));
                }
            } catch (Exception e) {
                System.err.println("Error fetching campus destination: " + e.getMessage());
                ctx.status(200).json(Map.of("lat", 10.728, "lng", 76.2792));
            }
        });

        app.post("/api/admin/settings/social", ctx -> {
            try {
                String token = ctx.cookie("jwt");
                if (token == null) {
                    ctx.status(401).json(Map.of("error", "Unauthorized"));
                    return;
                }
                String role = authService.validateTokenAndGetRole(token);
                if (!"ADMIN".equalsIgnoreCase(role)) {
                    ctx.status(403).json(Map.of("error", "Admin privileges required"));
                    return;
                }

                Map<String, String> payload = mapper.readValue(ctx.body(), new TypeReference<Map<String, String>>() {});
                String jsonSetting = mapper.writeValueAsString(payload);

                boolean saved = rideDAO.saveSetting("SOCIAL_LINKS", jsonSetting);
                if (saved) {
                    ctx.status(200).json(Map.of("message", "Social links updated successfully!"));
                } else {
                    ctx.status(500).json(Map.of("error", "Failed to update social links in database"));
                }
            } catch (Exception e) {
                System.err.println("Error setting social links: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error updating social links"));
            }
        });

        app.get("/api/settings/social", ctx -> {
            try {
                String settingJson = rideDAO.getSetting("SOCIAL_LINKS");
                if (settingJson != null && !settingJson.trim().isEmpty()) {
                    ctx.status(200).result(settingJson).contentType("application/json");
                } else {
                    ctx.status(200).json(Map.of(
                        "whatsapp", "",
                        "facebook", "",
                        "instagram", ""
                    ));
                }
            } catch (Exception e) {
                System.err.println("Error fetching social links: " + e.getMessage());
                ctx.status(200).json(Map.of(
                    "whatsapp", "",
                    "facebook", "",
                    "instagram", ""
                ));
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
                    ctx.status(200).result("null").contentType("application/json");
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
                    ctx.status(200).result("[]").contentType("application/json");
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
                ctx.session.setIdleTimeout(java.time.Duration.ofMillis(3600000));
                try {
                    String token = ctx.cookie("jwt");
                    if (token != null) {
                        int userId = authService.validateTokenAndGetUserId(token);
                        if (userId != -1) {
                            String role = authService.validateTokenAndGetRole(token);
                            String name = userDAO.getUserNameById(userId);
                            if (name != null) {
                                ctx.attribute("userId", userId);
                                ctx.attribute("userName", name);
                                ctx.attribute("userRole", role);
                            }
                        }
                    }
                    int rideId = Integer.parseInt(ctx.pathParam("rideId"));
                    rideSessions.computeIfAbsent(rideId, k -> ConcurrentHashMap.newKeySet()).add(ctx);
                    System.out
                            .println("WebSocket connected for ride " + rideId + " (session: " + ctx.sessionId() + ")");
                } catch (Exception e) {
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
                        // Secure WebSocket Identity Verification
                        Object sessionName = ctx.attribute("userName");
                        Object sessionId = ctx.attribute("userId");
                        if (sessionName != null) {
                            message.put("senderName", sessionName);
                        }
                        if (sessionId != null) {
                            message.put("senderId", sessionId);
                        }

                        Integer targetUserId = null;
                        if (message.containsKey("targetUserId") && message.get("targetUserId") != null) {
                            try {
                                targetUserId = Integer.parseInt(message.get("targetUserId").toString());
                            } catch (NumberFormatException e) {
                                // Ignore
                            }
                        }

                        // Save to history
                        rideChats.computeIfAbsent(rideId, k -> new ArrayList<>()).add(message);

                        // Broadcast to sender and target only
                        Set<WsContext> sessions = rideSessions.get(rideId);
                        if (sessions != null) {
                            String msgJson = mapper.writeValueAsString(message);
                            for (WsContext session : sessions) {
                                if (session.session.isOpen()) {
                                    Integer sessionUserId = session.attribute("userId");
                                    if (targetUserId == null
                                            || (sessionUserId != null && (sessionUserId.equals(sessionId)
                                                    || sessionUserId.equals(targetUserId)))) {
                                        session.send(msgJson);
                                    }
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