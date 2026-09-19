package com.campus;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

import org.mindrot.jbcrypt.BCrypt;

public class UserDAO {

    // Verify login password using BCrypt with plaintext fallback
    public boolean verifyLogin(String plaintext, String hashed) {
        if (plaintext == null || hashed == null) {
            return false;
        }
        try {
            return BCrypt.checkpw(plaintext, hashed);
        } catch (IllegalArgumentException e) {
            // Fallback for legacy unhashed passwords
            return plaintext.equals(hashed);
        }
    }

    // 1. Fetch users waiting for admin approval
    public List<User> getPendingVerifications() {
        List<User> pendingUsers = new ArrayList<>();
        String sql = "SELECT user_id, name, email, role, college_id_url, verification_photo_url FROM Users WHERE is_verified = FALSE AND is_email_verified = TRUE";

        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql);
                ResultSet rs = pstmt.executeQuery()) {

            while (rs.next()) {
                User user = new User();
                user.setUserId(rs.getInt("user_id"));
                user.setName(rs.getString("name"));
                user.setEmail(rs.getString("email"));
                user.setRole(rs.getString("role"));
                user.setCollegeIdUrl(rs.getString("college_id_url"));
                user.setVerificationPhotoUrl(rs.getString("verification_photo_url"));
                pendingUsers.add(user);
            }
        } catch (SQLException e) {
            System.err.println("Error: " + e.getMessage());
        }
        return pendingUsers;
    }

    // 2. Approve a user
    public boolean approveUser(int userId) {
        String sql = "UPDATE Users SET is_verified = TRUE WHERE user_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setInt(1, userId);
            int rows = pstmt.executeUpdate();
            return rows > 0;

        } catch (SQLException e) {
            System.err.println("Error: " + e.getMessage());
            return false;
        }
    }

    // 3. Find a user by their email (Used for Login)
    public User getUserByEmail(String email) {
        String sql = "SELECT user_id, name, email, password, role, is_verified FROM Users WHERE email = ?";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setString(1, email);
            ResultSet rs = pstmt.executeQuery();

            if (rs.next()) {
                User user = new User();
                user.setUserId(rs.getInt("user_id"));
                user.setName(rs.getString("name"));
                user.setEmail(rs.getString("email"));
                user.setPassword(rs.getString("password"));
                user.setRole(rs.getString("role"));
                user.setVerified(rs.getBoolean("is_verified"));
                return user;
            }
        } catch (SQLException e) {
            System.err.println("Error: " + e.getMessage());
        }
        return null;
    }

    // 4. Register a new user - UPDATED with BCrypt Password Hashing & Photo Upload
    // URLs
    public boolean registerUser(String name, String email, String password, String role, String collegeIdUrl,
            String selfieUrl) {
        String sql = "INSERT INTO Users (name, email, password, role, is_verified, college_id_url, verification_photo_url) VALUES (?, ?, ?, ?, FALSE, ?, ?)";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql, java.sql.Statement.RETURN_GENERATED_KEYS)) {

            String hashedPassword = (password != null && !password.isEmpty())
                    ? BCrypt.hashpw(password, BCrypt.gensalt())
                    : password;

            pstmt.setString(1, name);
            pstmt.setString(2, email);
            pstmt.setString(3, hashedPassword);
            pstmt.setString(4, role);
            pstmt.setString(5, collegeIdUrl);
            pstmt.setString(6, selfieUrl);

            int rows = pstmt.executeUpdate();
            return rows > 0;

        } catch (SQLException e) {
            System.err.println("Error: " + e.getMessage());
            return false;
        }
    }

    // 5. Save Vehicle Profile
    public boolean saveVehicle(int userId, String make, String model, String licensePlate, String color) {
        String sql = "INSERT INTO Vehicles (user_id, make, model, license_plate, color) VALUES (?, ?, ?, ?, ?) " +
                "ON DUPLICATE KEY UPDATE make = VALUES(make), model = VALUES(model), license_plate = VALUES(license_plate), color = VALUES(color)";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, userId);
            pstmt.setString(2, make);
            pstmt.setString(3, model);
            pstmt.setString(4, licensePlate);
            pstmt.setString(5, color);
            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Error: " + e.getMessage());
            return false;
        }
    }

    // 6. Get Vehicle Profile
    public java.util.Map<String, String> getVehicle(int userId) {
        String sql = "SELECT make, model, license_plate, color FROM Vehicles WHERE user_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, userId);
            ResultSet rs = pstmt.executeQuery();
            if (rs.next()) {
                java.util.Map<String, String> vehicle = new java.util.HashMap<>();
                vehicle.put("make", rs.getString("make"));
                vehicle.put("model", rs.getString("model"));
                vehicle.put("licensePlate", rs.getString("license_plate"));
                vehicle.put("color", rs.getString("color"));
                return vehicle;
            }
        } catch (SQLException e) {
            System.err.println("Error: " + e.getMessage());
        }
        return null;
    }

    // 7. OTP Generation and Storage
    public String generateAndStoreOtp(String email) {
        // Generate a 6-digit random number
        String otp = String.format("%06d", new java.util.Random().nextInt(1000000));
        String sql = "UPDATE Users SET otp_code = ?, otp_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE email = ?";

        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setString(1, otp);
            pstmt.setString(2, email);
            int rows = pstmt.executeUpdate();

            if (rows > 0)
                return otp;

        } catch (SQLException e) {
            System.err.println("Error storing OTP: " + e.getMessage());
        }
        return null;
    }

    // 8. Verify OTP
    public boolean verifyOtp(String email, String otpCode) {
        String selectSql = "SELECT otp_expires_at FROM Users WHERE email = ? AND otp_code = ?";
        String updateSql = "UPDATE Users SET is_email_verified = TRUE, otp_code = NULL WHERE email = ?";

        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement selectStmt = conn.prepareStatement(selectSql)) {

            selectStmt.setString(1, email);
            selectStmt.setString(2, otpCode);
            ResultSet rs = selectStmt.executeQuery();

            if (rs.next()) {
                java.sql.Timestamp expiresAt = rs.getTimestamp("otp_expires_at");
                if (expiresAt != null && expiresAt.after(new java.sql.Timestamp(System.currentTimeMillis()))) {
                    // OTP is valid and not expired, update user
                    try (PreparedStatement updateStmt = conn.prepareStatement(updateSql)) {
                        updateStmt.setString(1, email);
                        updateStmt.executeUpdate();
                        return true;
                    }
                }
            }
        } catch (SQLException e) {
            System.err.println("Error verifying OTP: " + e.getMessage());
        }
        return false;
    }

    // 9. Save Favorite Route
    public boolean saveFavoriteRoute(int userId, String routeName, String waypointsJson) {
        String existingJson = getFavoriteRoute(userId);

        StringBuilder newJson = new StringBuilder();
        if (existingJson == null || existingJson.trim().isEmpty() || existingJson.equals("[]")) {
            newJson.append("[{\"name\":\"").append(routeName).append("\", \"waypoints\":").append(waypointsJson)
                    .append("}]");
        } else {
            // Very hacky JSON append to avoid Jackson parsing just for this simple task
            String trimmed = existingJson.trim();
            if (trimmed.endsWith("]")) {
                newJson.append(trimmed.substring(0, trimmed.length() - 1));
                newJson.append(", {\"name\":\"").append(routeName).append("\", \"waypoints\":").append(waypointsJson)
                        .append("}]");
            } else {
                newJson.append("[{\"name\":\"").append(routeName).append("\", \"waypoints\":").append(waypointsJson)
                        .append("}]");
            }
        }

        String sql = "UPDATE Users SET favorite_route = ? WHERE user_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setString(1, newJson.toString());
            pstmt.setInt(2, userId);
            return pstmt.executeUpdate() > 0;

        } catch (SQLException e) {
            System.err.println("Error saving favorite route: " + e.getMessage());
            return false;
        }
    }

    // 10. Get Favorite Route
    public String getFavoriteRoute(int userId) {
        String sql = "SELECT favorite_route FROM Users WHERE user_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setInt(1, userId);
            ResultSet rs = pstmt.executeQuery();
            if (rs.next()) {
                return rs.getString("favorite_route");
            }
        } catch (SQLException e) {
            System.err.println("Error getting favorite route: " + e.getMessage());
        }
        return null;
    }

    // 11. Get User Name By ID
    public String getUserNameById(int userId) {
        String sql = "SELECT name FROM Users WHERE user_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, userId);
            ResultSet rs = pstmt.executeQuery();
            if (rs.next()) {
                return rs.getString("name");
            }
        } catch (SQLException e) {
            System.err.println("Error fetching user name: " + e.getMessage());
        }
        return "Student";
    }

    // --- Task 1: User Profile APIs ---

    public java.util.Map<String, Object> getUserProfile(int userId) {
        String sql = "SELECT user_id, name, email, phone_number, role, is_verified, college_id_url FROM Users WHERE user_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, userId);
            ResultSet rs = pstmt.executeQuery();
            if (rs.next()) {
                java.util.Map<String, Object> profile = new java.util.HashMap<>();
                profile.put("user_id", rs.getInt("user_id"));
                profile.put("name", rs.getString("name"));
                profile.put("email", rs.getString("email"));
                profile.put("phone", rs.getString("phone_number"));
                profile.put("role", rs.getString("role"));
                profile.put("is_verified", rs.getBoolean("is_verified"));
                profile.put("college_id_url", rs.getString("college_id_url"));
                return profile;
            }
        } catch (SQLException e) {
            System.err.println("Error fetching user profile: " + e.getMessage());
        }
        return null;
    }

    public boolean updateUserProfile(int userId, String name, String phone) {
        String sql = "UPDATE Users SET name = ?, phone_number = ? WHERE user_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, name);
            pstmt.setString(2, phone);
            pstmt.setInt(3, userId);
            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Error updating user profile: " + e.getMessage());
        }
        return false;
    }

    public boolean updatePassword(int userId, String currentPassword, String newPassword) {
        String fetchSql = "SELECT password FROM Users WHERE user_id = ?";
        String updateSql = "UPDATE Users SET password = ? WHERE user_id = ?";
        try (Connection conn = DatabaseConnection.getConnection()) {

            // 1. Fetch current hash
            String currentHash = null;
            try (PreparedStatement fetchStmt = conn.prepareStatement(fetchSql)) {
                fetchStmt.setInt(1, userId);
                ResultSet rs = fetchStmt.executeQuery();
                if (rs.next()) {
                    currentHash = rs.getString("password");
                }
            }

            if (currentHash == null || !BCrypt.checkpw(currentPassword, currentHash)) {
                return false; // Password mismatch
            }

            // 2. Hash new password and update
            String newHash = BCrypt.hashpw(newPassword, BCrypt.gensalt());
            try (PreparedStatement updateStmt = conn.prepareStatement(updateSql)) {
                updateStmt.setString(1, newHash);
                updateStmt.setInt(2, userId);
                return updateStmt.executeUpdate() > 0;
            }

        } catch (SQLException e) {
            System.err.println("Error updating password: " + e.getMessage());
        }
        return false;
    }

    // --- Task 2: Admin User Management APIs ---

    public List<java.util.Map<String, Object>> getAllUsers() {
        List<java.util.Map<String, Object>> users = new ArrayList<>();
        String sql = "SELECT user_id, name, email, phone_number, role, is_verified, is_email_verified FROM Users ORDER BY user_id DESC";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            ResultSet rs = pstmt.executeQuery();
            while (rs.next()) {
                java.util.Map<String, Object> user = new java.util.HashMap<>();
                user.put("user_id", rs.getInt("user_id"));
                user.put("name", rs.getString("name"));
                user.put("email", rs.getString("email"));
                user.put("phone", rs.getString("phone_number"));
                user.put("role", rs.getString("role"));
                user.put("is_verified", rs.getBoolean("is_verified"));
                user.put("is_email_verified", rs.getBoolean("is_email_verified"));
                users.add(user);
            }
        } catch (SQLException e) {
            System.err.println("Error fetching all users: " + e.getMessage());
        }
        return users;
    }

    public boolean toggleUserVerification(int userId) {
        String sql = "UPDATE Users SET is_verified = NOT is_verified WHERE user_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, userId);
            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Error toggling user verification: " + e.getMessage());
        }
        return false;
    }

    public boolean deleteUserWithCascade(int userId) {
        Connection conn = null;
        try {
            conn = DatabaseConnection.getConnection();
            conn.setAutoCommit(false); // Start transaction

            // Delete dependencies sequentially
            String[] queries = {
                    "DELETE FROM Incident_Reports WHERE reporter_id = ? OR ride_id IN (SELECT ride_id FROM Rides WHERE driver_id = ?)",
                    "DELETE FROM Bookings WHERE passenger_id = ? OR ride_id IN (SELECT ride_id FROM Rides WHERE driver_id = ?)",
                    "DELETE FROM Rides WHERE driver_id = ?",
                    "DELETE FROM Vehicles WHERE user_id = ?",
                    "DELETE FROM Users WHERE user_id = ?"
            };

            for (int i = 0; i < queries.length; i++) {
                try (PreparedStatement pstmt = conn.prepareStatement(queries[i])) {
                    pstmt.setInt(1, userId);
                    if (i < 2) { // Incident_Reports and Bookings have two placeholders
                        pstmt.setInt(2, userId);
                    }
                    pstmt.executeUpdate();
                }
            }

            conn.commit();
            return true;
        } catch (SQLException e) {
            System.err.println("Transaction Error deleting user: " + e.getMessage());
            if (conn != null) {
                try {
                    conn.rollback();
                } catch (SQLException ex) {
                    System.err.println("Rollback failed: " + ex.getMessage());
                }
            }
        } finally {
            if (conn != null) {
                try {
                    conn.setAutoCommit(true);
                    conn.close();
                } catch (SQLException ex) {
                    System.err.println("Failed to close connection: " + ex.getMessage());
                }
            }
        }
        return false;
    }
}