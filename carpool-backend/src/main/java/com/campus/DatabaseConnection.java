package com.campus;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class DatabaseConnection {

    // Localhost URL for your PC
    private static final String URL = "jdbc:mysql://localhost:3306/campus_carpool";
    // Default local MySQL username is usually "root"
    private static final String USER = "root";
    // Type your actual local MySQL password here
    private static final String PASSWORD = "0000";

    public static Connection getConnection() {
        Connection connection = null;
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
            connection = DriverManager.getConnection(URL, USER, PASSWORD);
            System.out.println("SUCCESS: Connected to the local MySQL database!");
        } catch (ClassNotFoundException | SQLException e) {
            System.err.println("Error: " + e.getMessage());
        }
        return connection;
    }
}