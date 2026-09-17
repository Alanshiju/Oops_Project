package com.campus;

public class User {
    private int userId;
    private String name;
    private String email;
    private String phoneNumber; // Restored from your original code

    // NEW: Variables for Admin Verification
    private String role;
    private boolean isVerified;
    private String collegeIdUrl;
    private String verificationPhotoUrl;
    private String password;

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    // 1. Empty constructor (Required by Jackson to convert JSON)
    public User() {
    }

    // 2. Your original constructor (Required by Driver.java and Passenger.java)
    public User(int userId, String name, String email, String phoneNumber) {
        this.userId = userId;
        this.name = name;
        this.email = email;
        this.phoneNumber = phoneNumber;
    }

    // --- GETTERS & SETTERS FOR ALL VARIABLES ---

    public int getUserId() {
        return userId;
    }

    public void setUserId(int userId) {
        this.userId = userId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public boolean isVerified() {
        return isVerified;
    }

    public void setVerified(boolean isVerified) {
        this.isVerified = isVerified;
    }

    public String getCollegeIdUrl() {
        return collegeIdUrl;
    }

    public void setCollegeIdUrl(String collegeIdUrl) {
        this.collegeIdUrl = collegeIdUrl;
    }

    public String getVerificationPhotoUrl() {
        return verificationPhotoUrl;
    }

    public void setVerificationPhotoUrl(String verificationPhotoUrl) {
        this.verificationPhotoUrl = verificationPhotoUrl;
    }
}