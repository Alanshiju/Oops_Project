package com.campus;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class DatabaseConnection {

    // Localhost URL for MySQL
    private static final String URL = "jdbc:mysql://localhost:3306/campus_carpool?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true";
    private static final String FALLBACK_URL = "jdbc:mysql://localhost:3306/carpool?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true";
    // Default local MySQL credentials
    private static final String USER = "root";
    private static final String PASSWORD = "0000";

    public static Connection getConnection() {
        Connection connection = null;
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
            try {
                connection = DriverManager.getConnection(URL, USER, PASSWORD);
            } catch (SQLException e) {
                // Try fallback database name "carpool" if campus_carpool does not exist
                connection = DriverManager.getConnection(FALLBACK_URL, USER, PASSWORD);
            }
        } catch (ClassNotFoundException | SQLException e) {
            System.err.println("Error: " + e.getMessage());
        }
        return connection;
    }
}