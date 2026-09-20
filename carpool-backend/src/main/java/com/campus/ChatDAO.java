package com.campus;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ChatDAO {

    public void savePublicMessage(String senderName, String message) {
        String sql = "INSERT INTO Public_Chat_Messages (sender_name, message) VALUES (?, ?)";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, senderName);
            pstmt.setString(2, message);
            pstmt.executeUpdate();
        } catch (SQLException e) {
            System.err.println("Error saving public chat message: " + e.getMessage());
        }
    }

    public List<Map<String, Object>> getRecentPublicMessages(int limit) {
        List<Map<String, Object>> messages = new ArrayList<>();
        // Fetch ordered by timestamp DESC, then reverse in Java, or use subquery
        String sql = "SELECT * FROM (SELECT id, sender_name, message, timestamp FROM Public_Chat_Messages ORDER BY timestamp DESC LIMIT ?) sub ORDER BY timestamp ASC";
        try (Connection conn = DatabaseConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, limit);
            ResultSet rs = pstmt.executeQuery();
            while (rs.next()) {
                Map<String, Object> msg = new HashMap<>();
                msg.put("id", rs.getInt("id"));
                msg.put("senderName", rs.getString("sender_name"));
                msg.put("message", rs.getString("message"));
                msg.put("timestamp", rs.getTimestamp("timestamp").toString());
                messages.add(msg);
            }
        } catch (SQLException e) {
            System.err.println("Error fetching public chat messages: " + e.getMessage());
        }
        return messages;
    }
}
