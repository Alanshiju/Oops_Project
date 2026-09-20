package com.campus;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.javalin.Javalin;
import io.javalin.http.UploadedFile;
import io.javalin.http.staticfiles.Location;
import io.javalin.websocket.WsContext;

public class Main {
    static Map<Integer, Coordinate> driverLocations = new ConcurrentHashMap<>();
    static Map<Integer, Coordinate> passengerLocations = new ConcurrentHashMap<>();
    static Map<Integer, Set<WsContext>> rideSessions = new ConcurrentHashMap<>();
    static Map<Integer, Set<WsContext>> userSessions = new ConcurrentHashMap<>();
    public static final Set<WsContext> publicChatSessions = ConcurrentHashMap.newKeySet();

    static Map<Integer, List<Map<String, Object>>> rideChats = new ConcurrentHashMap<>();

    public static void sendToUser(int userId, String payload) {
        Set<WsContext> sessions = userSessions.get(userId);
        if (sessions != null && !sessions.isEmpty()) {
            for (WsContext session : sessions) {
                if (session.session.isOpen()) {
                    try {
                        session.send(payload);
                    } catch (Exception ignore) {
                    }
                }
            }
        }
    }

    public static void main(String[] args) {
        ObjectMapper mapper = new ObjectMapper();
        RideDAO rideDAO = new RideDAO();
        ChatDAO chatDAO = new ChatDAO();
        UserDAO userDAO = new UserDAO();
        AuthService authService = new AuthService();

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
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                    "FOREIGN KEY (driver_id) REFERENCES Users(user_id)" +
                    ")");

            // Migration: Ensure created_at and fare exist on Rides table
            try {
                stmt.execute("ALTER TABLE Rides ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
            } catch (SQLException ignore) {
            }
            try {
                stmt.execute("ALTER TABLE Rides ADD COLUMN fare DOUBLE DEFAULT 0.0");
            } catch (SQLException ignore) {
            }

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

            // 0f. System_Settings Table
            stmt.execute("CREATE TABLE IF NOT EXISTS System_Settings (" +
                    "setting_key VARCHAR(100) PRIMARY KEY, " +
                    "setting_value JSON NOT NULL" +
                    ")");
            System.out.println("System_Settings table verified.");

            // 0g. Public Chat Table
            stmt.execute("CREATE TABLE IF NOT EXISTS Public_Chat_Messages (" +
                    "id INT AUTO_INCREMENT PRIMARY KEY, " +
                    "sender_name VARCHAR(255), " +
                    "message TEXT, " +
                    "timestamp DATETIME DEFAULT CURRENT_TIMESTAMP" +
                    ")");
            System.out.println("Public_Chat_Messages table verified.");

        } catch (SQLException e) {
            System.err.println("Error initializing DB schema: " + e.getMessage());
        }

        Javalin app = Javalin.create(config -> {
            config.bundledPlugins.enableCors(cors -> {
                cors.addRule(it -> {
                    it.allowHost("http://localhost:5173", "https://nexify.kaliwebworkspace.in");
                    it.allowCredentials = true;
                });
            });
            config.staticFiles.add(staticFiles -> {
                staticFiles.hostedPath = "/uploads";
                staticFiles.directory = "uploads";
                staticFiles.location = Location.EXTERNAL;
            });
        });

        System.out.println("SERVER IS RUNNING! Listening for frontend requests...");

        // 1. Status Endpoint
        app.get("/api/status", ctx -> ctx.result("Backend is live and ready!"));

        // 2. Booking Endpoint
        io.javalin.http.Handler bookingHandler = ctx -> {
            try {
                String token = authService.extractToken(ctx);
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

                    int driverId = rideDAO.getDriverIdByRideId(rideId);
                    String passengerName = userDAO.getUserNameById(passengerId);
                    if (passengerName == null || passengerName.isBlank()) {
                        passengerName = "A Passenger";
                    }

                    String bookingMsg = "{\"type\": \"NEW_BOOKING_REQUEST\", \"passengerId\": " + passengerId
                            + ", \"name\": \"" + passengerName + "\"}";

                    if (driverId != -1) {
                        sendToUser(driverId, bookingMsg);
                    }

                    Set<WsContext> sessions = rideSessions.get(rideId);
                    if (sessions != null && !sessions.isEmpty()) {
                        for (WsContext session : sessions) {
                            if (session.session.isOpen()) {
                                try {
                                    session.send(bookingMsg);
                                } catch (Exception e) {
                                }
                            }
                        }
                    }
                } else {
                    ctx.status(400).json(Map.of("error", "Failed to book seat."));
                }
            } catch (Exception e) {
                System.err.println("Error processing booking: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error processing booking."));
            }
        };

        app.post("/api/book", bookingHandler);
        app.post("/api/rides/book", bookingHandler);

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

                Double customCost = null;
                if (payload.containsKey("customFare") && payload.get("customFare") != null) {
                    try {
                        customCost = Double.parseDouble(payload.get("customFare").toString());
                    } catch (Exception ignore) {
                    }
                } else if (payload.containsKey("costPerSeat") && payload.get("costPerSeat") != null) {
                    try {
                        customCost = Double.parseDouble(payload.get("costPerSeat").toString());
                    } catch (Exception ignore) {
                    }
                }

                boolean isSaved = rideDAO.saveRouteDetails(rideId, routeGeometryJson, distanceKm, isFreeRide,
                        estimatedDurationMins, customCost);
                if (isSaved)
                    ctx.status(200).json(Map.of("message", "Route saved!"));
                else
                    ctx.status(400).json(Map.of("error", "Database failed to save the route."));
            } catch (Exception e) {
                System.err.println("Error saving route: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Failed to parse route data."));
            }
        });

        // 4. Search & Scan Nearby Rides Endpoint (50m polyline filter & ETA sorting)
        io.javalin.http.Handler scanRidesHandler = ctx -> {
            try {
                double studentLat = 0.0;
                double studentLng = 0.0;

                if (ctx.body() != null && !ctx.body().trim().isEmpty()) {
                    try {
                        Map<String, Object> body = mapper.readValue(ctx.body(),
                                new TypeReference<Map<String, Object>>() {
                                });
                        if (body.containsKey("lat") && body.get("lat") != null) {
                            studentLat = Double.parseDouble(body.get("lat").toString());
                        } else if (body.containsKey("latitude") && body.get("latitude") != null) {
                            studentLat = Double.parseDouble(body.get("latitude").toString());
                        }
                        if (body.containsKey("lng") && body.get("lng") != null) {
                            studentLng = Double.parseDouble(body.get("lng").toString());
                        } else if (body.containsKey("longitude") && body.get("longitude") != null) {
                            studentLng = Double.parseDouble(body.get("longitude").toString());
                        }
                    } catch (Exception ignore) {
                    }
                }

                if (studentLat == 0.0 && studentLng == 0.0) {
                    String latParam = ctx.queryParam("lat");
                    String lngParam = ctx.queryParam("lng");
                    if (latParam != null && lngParam != null) {
                        try {
                            studentLat = Double.parseDouble(latParam);
                            studentLng = Double.parseDouble(lngParam);
                        } catch (Exception ignore) {
                        }
                    }
                }

                List<Map<String, Object>> activeRides = rideDAO.getActiveRidesForScan();
                List<Map<String, Object>> matchingRides = new ArrayList<>();

                for (Map<String, Object> ride : activeRides) {
                    Object routeGeomObj = ride.get("route_geometry");
                    String routeGeomStr = routeGeomObj != null ? routeGeomObj.toString() : "[]";
                    double dist = GeoUtils.distanceToPolyline(studentLat, studentLng, routeGeomStr);

                    // Filter out any ride where dist > 0.05 (50 meters)
                    if (dist <= 0.05) {
                        int rideId = Integer.parseInt(ride.get("rideId").toString());
                        double driverLat = 0.0;
                        double driverLng = 0.0;

                        if (driverLocations.containsKey(rideId)) {
                            Coordinate dLoc = driverLocations.get(rideId);
                            driverLat = dLoc.getLat();
                            driverLng = dLoc.getLng();
                        } else if (ride.containsKey("origin_lat") && ride.get("origin_lat") != null
                                && Double.parseDouble(ride.get("origin_lat").toString()) != 0.0) {
                            driverLat = Double.parseDouble(ride.get("origin_lat").toString());
                            driverLng = Double.parseDouble(ride.get("origin_lng").toString());
                        } else if (ride.get("routeGeometry") instanceof List
                                && !((List<?>) ride.get("routeGeometry")).isEmpty()) {
                            Object first = ((List<?>) ride.get("routeGeometry")).get(0);
                            if (first instanceof Coordinate) {
                                driverLat = ((Coordinate) first).getLat();
                                driverLng = ((Coordinate) first).getLng();
                            }
                        }

                        double driverDistance = GeoUtils.haversine(driverLat, driverLng, studentLat, studentLng);
                        ride.put("driverDistanceKm", driverDistance);
                        int etaMins = (int) Math.max(1, Math.round((driverDistance / 30.0) * 60.0));
                        ride.put("etaMinutes", etaMins);

                        matchingRides.add(ride);
                    }
                }

                // Sort ascending by driver distance to student (fastest ETA first)
                matchingRides.sort((r1, r2) -> Double.compare(
                        (Double) r1.get("driverDistanceKm"),
                        (Double) r2.get("driverDistanceKm")));

                ctx.status(200).json(matchingRides);
            } catch (Exception e) {
                System.err.println("Error in rides scan/search endpoint: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Failed to scan for nearby rides."));
            }
        };

        app.post("/api/rides/scan", scanRidesHandler);
        app.post("/api/rides/search", scanRidesHandler);
        app.get("/api/rides/search", scanRidesHandler);

        // 5. Admin: Get Pending Users
        app.get("/api/admin/pending", ctx -> {
            try {
                List<User> pendingUsers = userDAO.getPendingVerifications();
                ctx.status(200).json(pendingUsers);
            } catch (Exception e) {
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
            } catch (Exception e) {
                System.err.println("Error approving user: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error."));
            }
        });

        // 6b. Admin: Audit Logs
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
                    authService.setAuthCookie(ctx, token);
                    ctx.status(200).json(Map.of("message", "Welcome back!", "role", user.getRole()));
                } else {
                    ctx.status(401).json(Map.of("error", "Invalid email or password."));
                }
            } catch (Exception e) {
                System.err.println("Error during login: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error during login."));
            }
        });

        // 7b. Logout Endpoint
        app.post("/api/logout", ctx -> {
            authService.clearAuthCookie(ctx);
            ctx.status(200).json(Map.of("message", "Logged out securely."));
        });

        // 8. Create a New Ride
        app.post("/api/rides/create", ctx -> {
            try {
                String token = authService.extractToken(ctx);
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

                Map<String, Object> request = mapper.readValue(ctx.body(), new TypeReference<Map<String, Object>>() {
                });

                int seats = 3;
                if (request.containsKey("seats") && request.get("seats") != null) {
                    try {
                        seats = Integer.parseInt(request.get("seats").toString());
                    } catch (Exception ignore) {
                    }
                }
                if (seats <= 0)
                    seats = 1;

                double distanceKm = 0.0;
                if (request.containsKey("distanceKm") && request.get("distanceKm") != null) {
                    try {
                        distanceKm = Double.parseDouble(request.get("distanceKm").toString());
                    } catch (Exception ignore) {
                    }
                }

                boolean isFreeRide = false;
                if (request.containsKey("isFreeRide") && request.get("isFreeRide") != null) {
                    try {
                        isFreeRide = Boolean.parseBoolean(request.get("isFreeRide").toString());
                    } catch (Exception ignore) {
                    }
                }

                double customFare = 0.0;
                if (request.containsKey("customFare") && request.get("customFare") != null) {
                    try {
                        customFare = Double.parseDouble(request.get("customFare").toString());
                    } catch (Exception ignore) {
                    }
                } else if (request.containsKey("fare") && request.get("fare") != null) {
                    try {
                        customFare = Double.parseDouble(request.get("fare").toString());
                    } catch (Exception ignore) {
                    }
                } else if (request.containsKey("costPerSeat") && request.get("costPerSeat") != null) {
                    try {
                        customFare = Double.parseDouble(request.get("costPerSeat").toString());
                    } catch (Exception ignore) {
                    }
                }

                // Strict server-side recalculation of max allowed fare to prevent spoofing
                double maxFare = Math.floor(((distanceKm * 5.0) / seats) / 2.0);
                double finalFare = isFreeRide ? 0.0 : Math.min(customFare, maxFare);
                if (finalFare < 0.0)
                    finalFare = 0.0;

                int newRideId = rideDAO.createRide(driverId, seats, finalFare, distanceKm, isFreeRide);

                if (newRideId > 0)
                    ctx.status(200)
                            .json(Map.of("message", "Ride initialized!", "rideId", newRideId, "fare", finalFare));
                else
                    ctx.status(400).json(Map.of("error", "Failed to create ride."));
            } catch (Exception e) {
                System.err.println("Error creating ride: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error."));
            }
        });

        // 9. Registration Endpoint
        app.post("/api/register", ctx -> {
            try {
                String name = ctx.formParam("name");
                String email = ctx.formParam("email");
                String password = ctx.formParam("password");
                String role = "USER";

                if (email == null || !email.matches("^[a-zA-Z0-9_]+\\.[a-zA-Z]{2}\\d{2}@jecc\\.ac\\.in$")) {
                    ctx.status(400).json(Map.of("error", "Invalid college email format"));
                    return;
                }

                UploadedFile collegeIdFile = ctx.uploadedFile("collegeId");
                UploadedFile selfieFile = ctx.uploadedFile("selfie");

                String collegeIdUrl = saveUploadedFile(ctx, collegeIdFile, "id");
                String selfieUrl = saveUploadedFile(ctx, selfieFile, "selfie");

                boolean success = userDAO.registerUser(name, email, password, role, collegeIdUrl, selfieUrl);

                if (success) {
                    String otp = userDAO.generateAndStoreOtp(email);
                    EmailService.sendOtpEmail(email, otp);
                    ctx.status(200)
                            .json(Map.of("message", "Registration successful! Please check your email for the OTP.",
                                    "requireOtp", true, "email", email));
                } else {
                    ctx.status(400).json(Map.of("error", "Registration failed. Email might already exist."));
                }
            } catch (Exception e) {
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
            } catch (Exception e) {
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
                    EmailService.sendOtpEmail(email, newOtp);
                    ctx.status(200).json(Map.of("message", "A new OTP has been sent."));
                } else {
                    ctx.status(400).json(Map.of("error", "Failed to generate OTP. User might not exist."));
                }
            } catch (Exception e) {
                ctx.status(500).json(Map.of("error", "Server error"));
            }
        });

        // 10. Student: Get Booking History
        app.get("/api/bookings/my-rides", ctx -> {
            try {
                String token = authService.extractToken(ctx);
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
            } catch (Exception e) {
                System.err.println("Error fetching bookings: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error fetching bookings."));
            }
        });

        // 11. User Profile APIs
        app.get("/api/user/profile", ctx -> {
            String token = authService.extractToken(ctx);
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
            String token = authService.extractToken(ctx);
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
            } catch (Exception e) {
                ctx.status(400).json(Map.of("error", "Invalid request body"));
            }
        });

        app.post("/api/user/change-password", ctx -> {
            String token = authService.extractToken(ctx);
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
            } catch (Exception e) {
                ctx.status(400).json(Map.of("error", "Invalid request body"));
            }
        });

        // 12. Check Auth Status
        app.get("/api/check-auth", ctx -> {
            try {
                String token = authService.extractToken(ctx);
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
                int userId = authService.validateTokenAndGetUserId(token);
                String name = userDAO.getUserNameById(userId);

                ctx.status(200).json(Map.of(
                        "isAuthenticated", true,
                        "role", role,
                        "isVerified", isVerified,
                        "name", name != null ? name : "User"));
            } catch (Exception e) {
                System.err.println("Error checking auth status: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error"));
            }
        });

        // 12b. Check Active Status
        app.get("/api/user/active-status", ctx -> {
            try {
                String token = authService.extractToken(ctx);
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
            } catch (Exception e) {
                System.err.println("Error checking active status: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error checking active status."));
            }
        });

        // 13. Cancel Offered Ride
        app.post("/api/rides/cancel", ctx -> {
            try {
                String token = authService.extractToken(ctx);
                if (token == null) {
                    ctx.status(401).json(Map.of("error", "Unauthorized."));
                    return;
                }
                int userId = authService.validateTokenAndGetUserId(token);
                if (userId == -1) {
                    ctx.status(401).json(Map.of("error", "Invalid session."));
                    return;
                }
                int currentRideId = rideDAO.getActiveRideIdByDriver(userId);
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
            } catch (Exception e) {
                System.err.println("Error cancelling ride: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error cancelling ride."));
            }
        });

        // 14. Cancel Booking
        app.post("/api/bookings/cancel", ctx -> {
            try {
                String token = authService.extractToken(ctx);
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
            } catch (Exception e) {
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

        io.javalin.http.Handler bookingActionHandler = ctx -> {
            try {
                String bIdStr = ctx.pathParamMap().containsKey("bookingId") ? ctx.pathParam("bookingId")
                        : (ctx.pathParamMap().containsKey("id") ? ctx.pathParam("id") : null);
                if (bIdStr == null) {
                    ctx.status(400).json(Map.of("error", "Missing booking ID"));
                    return;
                }
                int bookingId = Integer.parseInt(bIdStr);

                String action = ctx.pathParamMap().get("action");
                if (action == null) {
                    if (ctx.path().endsWith("/accept")) {
                        action = "accept";
                    } else if (ctx.path().endsWith("/arrived")) {
                        action = "arrived";
                    }
                }

                int rideId = rideDAO.getRideIdByBookingId(bookingId);
                if (rideId == -1) {
                    ctx.status(404).json(Map.of("error", "Booking not found"));
                    return;
                }

                int studentId = rideDAO.getPassengerIdByBookingId(bookingId);

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
                    String eventPayload = "{\"type\": \"" + wsType + "\"}";

                    // Dispatch to Student's active private WebSocket connection
                    if (studentId != -1) {
                        sendToUser(studentId, eventPayload);
                    }

                    // Also dispatch to active sessions on the ride
                    Set<WsContext> sessions = rideSessions.get(rideId);
                    if (sessions != null && !sessions.isEmpty()) {
                        for (WsContext session : sessions) {
                            if (session.session.isOpen()) {
                                try {
                                    session.send(eventPayload);
                                } catch (Exception e) {
                                }
                            }
                        }
                    }
                } else {
                    ctx.status(400).json(Map.of("error", "Failed to update booking"));
                }
            } catch (Exception e) {
                ctx.status(500).json(Map.of("error", "Server error"));
            }
        };

        app.post("/api/bookings/{bookingId}/{action}", bookingActionHandler);
        app.post("/api/bookings/{id}/accept", bookingActionHandler);
        app.post("/api/bookings/{id}/arrived", bookingActionHandler);

        // 15. Live Location Updates
        app.post("/api/location/update", ctx -> {
            try {
                String token = authService.extractToken(ctx);
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
                                            + ", \"lng\": " + lng + ", \"role\": \"DRIVER\""
                                            + (sessionEta != null ? ", \"eta_minutes\": " + sessionEta : "")
                                            + "}";
                                    session.send(telemetryJson);
                                } catch (Exception e) {
                                    System.err.println("Error broadcasting location via WS: " + e.getMessage());
                                }
                            }
                        }

                        for (Map<String, Object> passenger : acceptedPassengers) {
                            String bStatus = (String) passenger.get("status");
                            if ("ACCEPTED".equals(bStatus) && passenger.get("lat") != null
                                    && passenger.get("lng") != null) {
                                double pLat = (Double) passenger.get("lat");
                                double pLng = (Double) passenger.get("lng");
                                double distMeters = LocationService.calculateDistance(lat, lng, pLat, pLng);

                                if (distMeters <= 50.0) {
                                    int bookingId = (Integer) passenger.get("bookingId");
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
            } catch (Exception e) {
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
            } catch (Exception e) {
                System.err.println("Error fetching live ride data: " + e.getMessage());
                ctx.status(500);
            }
        });

        // Admin User Management APIs
        app.get("/api/admin/users", ctx -> {
            String token = authService.extractToken(ctx);
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
            String token = authService.extractToken(ctx);
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
            } catch (Exception e) {
                ctx.status(400).json(Map.of("error", "Invalid user ID"));
            }
        });

        app.delete("/api/admin/users/{id}", ctx -> {
            String token = authService.extractToken(ctx);
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
            } catch (Exception e) {
                ctx.status(400).json(Map.of("error", "Invalid user ID"));
            }
        });

        app.get("/api/public-chat/history", ctx -> {
            ctx.status(200).json(chatDAO.getRecentPublicMessages(50));
        });

        // Unified CMS Settings Endpoints
        app.get("/api/settings/config", ctx -> {
            try {
                String locJson = rideDAO.getSetting("COLLEGE_DESTINATION");
                String contactJson = rideDAO.getSetting("CONTACT_INFO");

                Map<String, Object> config = new java.util.HashMap<>();
                if (locJson != null && !locJson.trim().isEmpty()) {
                    config.put("location", mapper.readValue(locJson, new TypeReference<Map<String, Double>>() {
                    }));
                } else {
                    config.put("location", Map.of("lat", 10.728, "lng", 76.2792));
                }

                if (contactJson != null && !contactJson.trim().isEmpty()) {
                    config.put("contact", mapper.readValue(contactJson, new TypeReference<Map<String, String>>() {
                    }));
                } else {
                    config.put("contact", Map.of("phone", "", "email", "", "facebook", "", "instagram", ""));
                }

                ctx.status(200).json(config);
            } catch (Exception e) {
                System.err.println("Error fetching settings config: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Failed to fetch settings config"));
            }
        });

        app.post("/api/admin/settings/location", ctx -> {
            try {
                String token = authService.extractToken(ctx);
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

                String jsonSetting = mapper
                        .writeValueAsString(Map.of("lat", payload.get("lat"), "lng", payload.get("lng")));
                boolean saved = rideDAO.saveSetting("COLLEGE_DESTINATION", jsonSetting);
                if (saved) {
                    ctx.status(200).json(Map.of("message", "Location updated successfully!"));
                } else {
                    ctx.status(500).json(Map.of("error", "Failed to update location"));
                }
            } catch (Exception e) {
                System.err.println("Error setting location: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error updating location"));
            }
        });

        app.post("/api/admin/settings/contact", ctx -> {
            try {
                String token = authService.extractToken(ctx);
                if (token == null) {
                    ctx.status(401).json(Map.of("error", "Unauthorized"));
                    return;
                }
                String role = authService.validateTokenAndGetRole(token);
                if (!"ADMIN".equalsIgnoreCase(role)) {
                    ctx.status(403).json(Map.of("error", "Admin privileges required"));
                    return;
                }

                Map<String, String> payload = mapper.readValue(ctx.body(), new TypeReference<Map<String, String>>() {
                });
                String jsonSetting = mapper.writeValueAsString(payload);
                boolean saved = rideDAO.saveSetting("CONTACT_INFO", jsonSetting);
                if (saved) {
                    ctx.status(200).json(Map.of("message", "Contact details updated successfully!"));
                } else {
                    ctx.status(500).json(Map.of("error", "Failed to update contact details"));
                }
            } catch (Exception e) {
                System.err.println("Error setting contact: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error updating contact details"));
            }
        });

        // Vehicle Profile APIs
        app.post("/api/profile/vehicle", ctx -> {
            try {
                String token = authService.extractToken(ctx);
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
            } catch (Exception e) {
                System.err.println("Error saving vehicle profile: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error"));
            }
        });

        app.get("/api/profile/vehicle", ctx -> {
            try {
                String token = authService.extractToken(ctx);
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
            } catch (Exception e) {
                System.err.println("Error fetching vehicle profile: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error"));
            }
        });

        // Favorite Routes APIs
        app.post("/api/user/route/favorite", ctx -> {
            try {
                String token = authService.extractToken(ctx);
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

        app.get("/api/user/route/favorite", ctx -> {
            try {
                String token = authService.extractToken(ctx);
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

        // Update Ride Status
        app.post("/api/rides/{id}/status", ctx -> {
            try {
                String token = authService.extractToken(ctx);
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
            } catch (Exception e) {
                System.err.println("Error updating status: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error"));
            }
        });

        // Analytics Endpoint
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

        // SOS Emergency Endpoint
        app.post("/api/rides/{id}/sos", ctx -> {
            try {
                String token = authService.extractToken(ctx);
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

                    // Task 4: Gather Full Ride Details & Send SOS Email
                    try {
                        Map<String, Object> fullDetails = rideDAO.getFullRideDetailsForSos(rideId);
                        String adminEmail = "admin@jecc.ac.in";
                        String contactJson = rideDAO.getSetting("CONTACT_INFO");
                        if (contactJson != null && !contactJson.trim().isEmpty()) {
                            Map<String, String> contactMap = mapper.readValue(contactJson,
                                    new TypeReference<Map<String, String>>() {
                                    });
                            if (contactMap.containsKey("email") && !contactMap.get("email").isBlank()) {
                                adminEmail = contactMap.get("email");
                            }
                        }
                        EmailService.sendSosEmail(adminEmail, fullDetails, lat, lng);
                    } catch (Exception e) {
                        System.err.println("Error triggering SOS email dispatch: " + e.getMessage());
                    }

                    ctx.status(200).json(Map.of("message", "Emergency alert dispatched."));
                } else {
                    ctx.status(400).json(Map.of("error", "Failed to dispatch SOS."));
                }
            } catch (Exception e) {
                System.err.println("Error reporting SOS: " + e.getMessage());
                ctx.status(500).json(Map.of("error", "Server error"));
            }
        });

        // Chat History Endpoint
        app.get("/api/rides/{rideId}/chat", ctx -> {
            try {
                int rideId = Integer.parseInt(ctx.pathParam("rideId"));
                List<Map<String, Object>> chatHistory = rideChats.getOrDefault(rideId, new ArrayList<>());
                ctx.status(200).json(chatHistory);
            } catch (Exception e) {
                ctx.status(500).json(Map.of("error", "Server error"));
            }
        });

        // WebSocket Live Tracking Endpoint
        app.ws("/ws/rides/{rideId}/live", ws -> {
            ws.onConnect(ctx -> {
                ctx.session.setIdleTimeout(java.time.Duration.ofMillis(3600000));
                try {
                    String token = ctx.cookie("token") != null ? ctx.cookie("token") : ctx.cookie("jwt");
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
                            userSessions.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(ctx);
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
                            }
                        }

                        rideChats.computeIfAbsent(rideId, k -> new ArrayList<>()).add(message);

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
                    Integer uId = ctx.attribute("userId");
                    if (uId != null) {
                        Set<WsContext> uSessions = userSessions.get(uId);
                        if (uSessions != null) {
                            uSessions.remove(ctx);
                            if (uSessions.isEmpty()) {
                                userSessions.remove(uId);
                            }
                        }
                    }
                } catch (Exception e) {
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
                    Integer uId = ctx.attribute("userId");
                    if (uId != null) {
                        Set<WsContext> uSessions = userSessions.get(uId);
                        if (uSessions != null) {
                            uSessions.remove(ctx);
                            if (uSessions.isEmpty()) {
                                userSessions.remove(uId);
                            }
                        }
                    }
                } catch (Exception e) {
                }
            });
        });

        // Public Global Chat WebSocket
        app.ws("/ws/public-chat", ws -> {
            ws.onConnect(ctx -> {
                int userId = -1;
                try {
                    String token = ctx.cookie("token") != null ? ctx.cookie("token") : ctx.cookie("jwt");
                    if (token == null) {
                        ctx.session.close(1008, "Unverified users cannot access global chat.");
                        return;
                    }
                    userId = authService.validateTokenAndGetUserId(token);
                    if (userId == -1 || !userDAO.isUserVerified(userId)) {
                        ctx.session.close(1008, "Unverified users cannot access global chat.");
                        return;
                    }
                    String name = userDAO.getUserNameById(userId);
                    if (name != null && !name.isBlank()) {
                        ctx.attribute("userName", name);
                        ctx.attribute("userId", userId);
                    }
                    userSessions.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(ctx);
                } catch (Exception e) {
                    System.err.println("Public chat onConnect auth error: " + e.getMessage());
                    try {
                        ctx.session.close(1008, "Unverified users cannot access global chat.");
                    } catch (Exception ignore) {
                    }
                    return;
                }
                publicChatSessions.add(ctx);
                System.out.println("New public chat connection: " + ctx.sessionId());
            });
            ws.onMessage(ctx -> {
                try {
                    Map<String, String> payload = mapper.readValue(ctx.message(),
                            new TypeReference<Map<String, String>>() {
                            });
                    String sessionName = ctx.attribute("userName");
                    String sender = sessionName != null ? sessionName : payload.getOrDefault("senderName", "Anonymous");
                    String msg = payload.getOrDefault("text", "");
                    String timestamp = payload.getOrDefault("timestamp",
                            new java.text.SimpleDateFormat("hh:mm a").format(new java.util.Date()));

                    // Save to DB
                    chatDAO.savePublicMessage(sender, msg);

                    // Construct strict JSON response map before broadcasting
                    Map<String, Object> broadcastMap = new HashMap<>();
                    broadcastMap.put("senderName", sender);
                    broadcastMap.put("text", msg);
                    broadcastMap.put("timestamp", timestamp);
                    String broadcastJson = mapper.writeValueAsString(broadcastMap);

                    // Re-broadcast formatted JSON safely
                    for (WsContext session : publicChatSessions) {
                        if (session.session.isOpen()) {
                            session.send(broadcastJson);
                        }
                    }
                } catch (Exception e) {
                    System.err.println("Error parsing public chat message: " + e.getMessage());
                }
            });
            ws.onClose(ctx -> {
                publicChatSessions.remove(ctx);
                Integer uId = ctx.attribute("userId");
                if (uId != null) {
                    Set<WsContext> uSessions = userSessions.get(uId);
                    if (uSessions != null) {
                        uSessions.remove(ctx);
                        if (uSessions.isEmpty()) {
                            userSessions.remove(uId);
                        }
                    }
                }
                System.out.println("Public chat connection closed: " + ctx.sessionId());
            });
            ws.onError(ctx -> {
                publicChatSessions.remove(ctx);
                Integer uId = ctx.attribute("userId");
                if (uId != null) {
                    Set<WsContext> uSessions = userSessions.get(uId);
                    if (uSessions != null) {
                        uSessions.remove(ctx);
                        if (uSessions.isEmpty()) {
                            userSessions.remove(uId);
                        }
                    }
                }
            });
        });

        // Start server after all routes are registered
        app.start(7070);
    }

    // Helper for generating dynamic public upload URLs (Cloudflare safe)
    private static String saveUploadedFile(io.javalin.http.Context ctx, UploadedFile file, String prefix)
            throws IOException {
        if (file == null)
            return null;
        String filename = System.currentTimeMillis() + "_" + prefix + "_"
                + file.filename().replaceAll("[^a-zA-Z0-9\\.\\-]", "_");
        Files.copy(file.content(), Path.of("uploads/" + filename), StandardCopyOption.REPLACE_EXISTING);

        String scheme = ctx.header("X-Forwarded-Proto") != null ? ctx.header("X-Forwarded-Proto") : ctx.scheme();
        String host = ctx.header("X-Forwarded-Host") != null ? ctx.header("X-Forwarded-Host") : ctx.host();

        return scheme + "://" + host + "/uploads/" + filename;
    }
}