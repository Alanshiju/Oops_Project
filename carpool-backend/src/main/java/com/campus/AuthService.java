package com.campus;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.auth0.jwt.interfaces.JWTVerifier;
import com.auth0.jwt.exceptions.JWTVerificationException;
import java.util.Date;

public class AuthService {

    // In a real production app, this secret would be hidden in an environment
    // variable!
    private static final String SECRET_KEY = "campus_carpool_super_secret_key_2026";
    private static final Algorithm algorithm = Algorithm.HMAC256(SECRET_KEY);
    private static final long EXPIRATION_TIME_MS = 86400000; // 24 hours

    /**
     * Generates a secure JWT containing the user's ID and Role.
     */
    public String generateToken(User user) {
        return JWT.create()
                .withIssuer("campus-carpool-backend")
                .withClaim("userId", user.getUserId())
                .withClaim("role", user.getRole())
                .withClaim("isVerified", user.isVerified())
                .withExpiresAt(new Date(System.currentTimeMillis() + EXPIRATION_TIME_MS))
                .sign(algorithm);
    }

    /**
     * NEW: Verifies the token signature and extracts the embedded User ID.
     */
    public int validateTokenAndGetUserId(String token) {
        try {
            // Strip the "Bearer " prefix that HTTP headers use
            if (token != null && token.startsWith("Bearer ")) {
                token = token.substring(7);
            }

            JWTVerifier verifier = JWT.require(algorithm)
                    .withIssuer("campus-carpool-backend")
                    .build();

            DecodedJWT jwt = verifier.verify(token);
            return jwt.getClaim("userId").asInt();

        } catch (JWTVerificationException | NullPointerException | IllegalArgumentException e) {
            System.err.println("Token validation error: " + e.getMessage());
            return -1;
        }
    }

    // NEW: Extracts the Role from the mathematically verified token
    public String validateTokenAndGetRole(String token) {
        try {
            if (token != null && token.startsWith("Bearer "))
                token = token.substring(7);
            JWTVerifier verifier = JWT.require(algorithm).withIssuer("campus-carpool-backend").build();
            return verifier.verify(token).getClaim("role").asString();
        } catch (JWTVerificationException | NullPointerException | IllegalArgumentException e) {
            System.err.println("Role validation error: " + e.getMessage());
            return null;
        }
    }

    public boolean validateTokenAndGetIsVerified(String token) {
        try {
            if (token != null && token.startsWith("Bearer "))
                token = token.substring(7);
            JWTVerifier verifier = JWT.require(algorithm).withIssuer("campus-carpool-backend").build();
            return verifier.verify(token).getClaim("isVerified").asBoolean();
        } catch (JWTVerificationException | NullPointerException | IllegalArgumentException e) {
            System.err.println("Verification status validation error: " + e.getMessage());
            return false;
        }
    }
}