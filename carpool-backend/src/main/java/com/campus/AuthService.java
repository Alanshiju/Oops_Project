package com.campus;

import java.util.Date;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.auth0.jwt.interfaces.JWTVerifier;

import io.javalin.http.Context;

public class AuthService {

    private static final String SECRET_KEY = "campus_carpool_super_secret_key_2026";
    private static final Algorithm algorithm = Algorithm.HMAC256(SECRET_KEY);
    private static final long EXPIRATION_TIME_MS = 7 * 24 * 60 * 60 * 1000L; // 7 days in milliseconds

    private static final JWTVerifier verifier = JWT.require(algorithm)
            .withIssuer("campus-carpool-backend")
            .build();

    /**
     * Generates a secure JWT containing the user's ID, Role, and Verification
     * status.
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
     * Sets the JWT into an HttpOnly, Cross-Site compatible cookie.
     * Uses SameSite=None and Secure so cross-domain requests
     * (e.g. from nexify.kaliwebworkspace.in to trycloudflare.com) are accepted by
     * modern browsers.
     */
    public void setAuthCookie(Context ctx, String token) {
        // Formatted raw Set-Cookie header ensures exact cross-site compliance
        String cookieHeader = String.format(
                "token=%s; Path=/; Max-Age=%d; Secure; HttpOnly; SameSite=None",
                token, (int) (EXPIRATION_TIME_MS / 1000));
        ctx.header("Set-Cookie", cookieHeader);
    }

    /**
     * Clears the authentication cookie upon logout.
     */
    public void clearAuthCookie(Context ctx) {
        String cookieHeader = "token=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=None";
        ctx.header("Set-Cookie", cookieHeader);
    }

    /**
     * Extracts token from either the "token" Cookie OR the "Authorization: Bearer
     * <token>" header.
     */
    public String extractToken(Context ctx) {
        // 1. Check HttpOnly Cookie first
        String token = ctx.cookie("token");
        if (token != null && !token.isBlank()) {
            return token;
        }

        // 2. Fallback to Authorization header
        String authHeader = ctx.header("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7).trim();
        }

        return null;
    }

    /**
     * Verifies the token and returns the decoded payload.
     * Returns null if token is expired, tampered, or invalid.
     */
    public DecodedJWT verifyToken(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        try {
            if (token.startsWith("Bearer ")) {
                token = token.substring(7).trim();
            }
            return verifier.verify(token);
        } catch (JWTVerificationException e) {
            System.err.println("Token verification failed: " + e.getMessage());
            return null;
        }
    }

    public int validateTokenAndGetUserId(String token) {
        DecodedJWT jwt = verifyToken(token);
        if (jwt != null && !jwt.getClaim("userId").isNull()) {
            return jwt.getClaim("userId").asInt();
        }
        return -1;
    }

    public String validateTokenAndGetRole(String token) {
        DecodedJWT jwt = verifyToken(token);
        if (jwt != null && !jwt.getClaim("role").isNull()) {
            return jwt.getClaim("role").asString();
        }
        return null;
    }

    public boolean validateTokenAndGetIsVerified(String token) {
        DecodedJWT jwt = verifyToken(token);
        if (jwt != null && !jwt.getClaim("isVerified").isNull()) {
            Boolean verified = jwt.getClaim("isVerified").asBoolean();
            return verified != null && verified;
        }
        return false;
    }
}