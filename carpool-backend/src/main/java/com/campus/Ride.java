package com.campus;

import java.util.List;

public class Ride {
    private int rideId;
    private int driverId;
    private double originLat;
    private double originLng;
    private double destLat;
    private double destLng;
    private int totalSeats;
    private int availableSeats;

    // NEW: The massive array of GPS points for the spatial math
    private List<Coordinate> routeGeometry;

    private String status = "PENDING";
    private double distanceKm;
    private double costPerSeat;
    private boolean isFreeRide;

    // Extra details for the UI
    private String driverName;
    private String vehicleMake;
    private String vehicleModel;
    private String licensePlate;
    private String carColor;

    // Empty constructor required by Jackson JSON converter
    public Ride() {
    }

    public Ride(int rideId, int driverId, double originLat, double originLng,
            double destLat, double destLng, int totalSeats) {
        this.rideId = rideId;
        this.driverId = driverId;
        this.originLat = originLat;
        this.originLng = originLng;
        this.destLat = destLat;
        this.destLng = destLng;
        this.totalSeats = totalSeats;
        this.availableSeats = totalSeats;
    }

    // Critical Seat Logic
    public boolean bookSeat() {
        if (this.availableSeats > 0) {
            this.availableSeats--;
            return true;
        }
        return false;
    }

    public void cancelSeat() {
        if (this.availableSeats < this.totalSeats) {
            this.availableSeats++;
        }
    }

    // --- GETTERS & SETTERS FOR ALL VARIABLES ---

    public int getRideId() {
        return rideId;
    }

    public void setRideId(int rideId) {
        this.rideId = rideId;
    }

    public int getDriverId() {
        return driverId;
    }

    public void setDriverId(int driverId) {
        this.driverId = driverId;
    }

    public double getOriginLat() {
        return originLat;
    }

    public void setOriginLat(double originLat) {
        this.originLat = originLat;
    }

    public double getOriginLng() {
        return originLng;
    }

    public void setOriginLng(double originLng) {
        this.originLng = originLng;
    }

    public double getDestLat() {
        return destLat;
    }

    public void setDestLat(double destLat) {
        this.destLat = destLat;
    }

    public double getDestLng() {
        return destLng;
    }

    public void setDestLng(double destLng) {
        this.destLng = destLng;
    }

    public int getTotalSeats() {
        return totalSeats;
    }

    public void setTotalSeats(int totalSeats) {
        this.totalSeats = totalSeats;
    }

    public int getAvailableSeats() {
        return availableSeats;
    }

    public void setAvailableSeats(int availableSeats) {
        this.availableSeats = availableSeats;
    }

    public List<Coordinate> getRouteGeometry() {
        return routeGeometry;
    }

    public void setRouteGeometry(List<Coordinate> routeGeometry) {
        this.routeGeometry = routeGeometry;
    }

    public String getDriverName() {
        return driverName;
    }

    public void setDriverName(String driverName) {
        this.driverName = driverName;
    }

    public String getVehicleMake() {
        return vehicleMake;
    }

    public void setVehicleMake(String vehicleMake) {
        this.vehicleMake = vehicleMake;
    }

    public String getVehicleModel() {
        return vehicleModel;
    }

    public void setVehicleModel(String vehicleModel) {
        this.vehicleModel = vehicleModel;
    }

    public String getLicensePlate() {
        return licensePlate;
    }

    public void setLicensePlate(String licensePlate) {
        this.licensePlate = licensePlate;
    }

    public String getCarColor() {
        return carColor;
    }

    public void setCarColor(String carColor) {
        this.carColor = carColor;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public double getDistanceKm() {
        return distanceKm;
    }

    public void setDistanceKm(double distanceKm) {
        this.distanceKm = distanceKm;
    }

    public double getCostPerSeat() {
        return costPerSeat;
    }

    public void setCostPerSeat(double costPerSeat) {
        this.costPerSeat = costPerSeat;
    }

    public boolean isFreeRide() {
        return isFreeRide;
    }

    public boolean getIsFreeRide() {
        return isFreeRide;
    }

    public void setFreeRide(boolean isFreeRide) {
        this.isFreeRide = isFreeRide;
    }

    private double fare;

    public double getFare() {
        return fare > 0 ? fare : costPerSeat;
    }

    public void setFare(double fare) {
        this.fare = fare;
        if (this.costPerSeat == 0.0) {
            this.costPerSeat = fare;
        }
    }
}