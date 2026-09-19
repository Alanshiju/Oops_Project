package com.campus;

import java.sql.Connection;
import java.sql.Statement;

public class TestAlter {
    public static void main(String[] args) {
        try (Connection conn = DatabaseConnection.getConnection();
                Statement stmt = conn.createStatement()) {

            stmt.execute(
                    "ALTER TABLE Bookings MODIFY booking_status ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'DRIVER_ARRIVED', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING'");
            stmt.execute(
                    "UPDATE Bookings SET booking_status = 'COMPLETED' WHERE booking_status IN ('ACCEPTED', 'DRIVER_ARRIVED', 'IN_TRANSIT')");
            System.out.println("UPDATE query succeeded.");

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
