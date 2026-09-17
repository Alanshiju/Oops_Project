// Derived Class (Demonstrating Inheritance)
package com.campus;

public class Driver extends User {
    private String vehicleDetails;

    public Driver(int userId, String name, String email, String phoneNumber, String vehicleDetails) {
        // The 'super' keyword calls the constructor of the parent 'User' class
        super(userId, name, email, phoneNumber);
        this.vehicleDetails = vehicleDetails;
    }

    public String getVehicleDetails() {
        return vehicleDetails;
    }
}

// Derived Class (Demonstrating Inheritance)
