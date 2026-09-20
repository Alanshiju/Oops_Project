import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { API_BASE_URL } from "../config/api";

const Login = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // NEW: State for file uploads
  const [collegeId, setCollegeId] = useState(null);
  const [selfie, setSelfie] = useState(null);

  // OTP State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");

  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();

    if (isRegistering) {
      if (password !== confirmPassword) {
        alert("❌ Passwords do not match! Please try again.");
        return;
      }

      // --- REGISTRATION FLOW (Multipart Form Data for File Uploads) ---
      const formData = new FormData();
      formData.append("name", name);
      formData.append("email", email);
      formData.append("password", password);
      formData.append("collegeId", collegeId);
      formData.append("selfie", selfie);

      fetch(`${API_BASE_URL}/api/register`, {
        method: "POST",
        credentials: "include",
        body: formData,
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.message) {
            alert("✅ " + data.message);
            if (data.requireOtp) {
              setShowOtpModal(true);
              setRegisteredEmail(data.email);
            } else {
              setIsRegistering(false);
              setPassword("");
              setConfirmPassword("");
              setCollegeId(null);
              setSelfie(null);
            }
          } else {
            alert("❌ " + data.error);
          }
        });
    } else {
      // --- LOGIN FLOW (Standard JSON) ---
      fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.role) {
            // Securely route based on the role the Java backend tells us we have
            if (data.role === "ADMIN") navigate("/admin");
            else navigate("/student");
          } else {
            alert("❌ " + data.error);
          }
        });
    }
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: registeredEmail, otp: otpCode }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          alert("✅ " + data.message);
          setShowOtpModal(false);
          setIsRegistering(false);
          setPassword("");
          setConfirmPassword("");
          setCollegeId(null);
          setSelfie(null);
        } else {
          alert("❌ " + data.error);
        }
      });
  };

  const handleResendOtp = () => {
    fetch(`${API_BASE_URL}/api/auth/resend-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: registeredEmail }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          alert("✅ " + data.message);
        } else {
          alert("❌ " + data.error);
        }
      });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 transition-colors duration-300">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-black/40 p-8"
      >
        {showOtpModal ? (
          <div>
            <h2 className="text-2xl font-extrabold text-teal-900 dark:text-white text-center mb-2">
              Verify Your Email
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-center mb-6 text-sm">
              We sent a 6-digit OTP to <strong>{registeredEmail}</strong>.<br />
              Check your inbox (or the server terminal).
            </p>
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
              <input
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Enter 6-digit OTP"
                className="w-full px-4 py-3 text-center tracking-widest text-2xl font-bold rounded-xl border border-slate-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 transition-shadow"
                required
              />
              <button
                type="submit"
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-full shadow-md shadow-teal-700/20 active:scale-95 transition-transform"
              >
                Verify Email
              </button>
            </form>
            <div className="mt-4 text-center">
              <button
                onClick={handleResendOtp}
                className="text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400"
              >
                Didn't receive it? Resend OTP
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-3xl font-extrabold text-teal-900 dark:text-white text-center mb-2">
              {isRegistering ? "Join the Carpool" : "Welcome Back"}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-center mb-8 text-sm">
              {isRegistering
                ? "Register and verify your identity."
                : "Sign in to your secure account."}
            </p>

            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              {isRegistering && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 bg-white dark:bg-slate-700 dark:text-white dark:placeholder-slate-400"
                      required={isRegistering}
                    />
                  </div>

                  {/* NEW: File Upload Inputs */}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-3">
                      Identity Verification
                    </h3>

                    <div className="mb-3">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Upload College ID
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setCollegeId(e.target.files[0])}
                        className="w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-teal-50 dark:file:bg-slate-700 file:text-teal-700 dark:file:text-teal-300 hover:file:bg-teal-100 dark:hover:file:bg-slate-600"
                        required={isRegistering}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Upload Selfie (Matching ID)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setSelfie(e.target.files[0])}
                        className="w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-teal-50 dark:file:bg-slate-700 file:text-teal-700 dark:file:text-teal-300 hover:file:bg-teal-100 dark:hover:file:bg-slate-600"
                        required={isRegistering}
                      />
                    </div>
                  </div>
                </>
              )}

              <div
                className={
                  isRegistering
                    ? "border-t border-slate-200 dark:border-slate-700 pt-4 mt-2"
                    : ""
                }
              >
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  College Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student.cs25@jecc.ac.in"
                  pattern="^[a-zA-Z0-9_]+\.[a-zA-Z]{2}\d{2}@jecc\.ac\.in$"
                  title="Format: name.deptYY@jecc.ac.in (e.g., student.cs25@jecc.ac.in)"
                  className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 bg-white dark:bg-slate-700 dark:text-white dark:placeholder-slate-400"
                  required
                />
                {isRegistering && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Must use format: <strong>name.deptYY@jecc.ac.in</strong>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 bg-white dark:bg-slate-700 dark:text-white dark:placeholder-slate-400"
                  required
                />
              </div>

              {isRegistering && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 bg-white dark:bg-slate-700 dark:text-white dark:placeholder-slate-400"
                    required={isRegistering}
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-lg mt-4 shadow-md active:scale-95 transition-colors"
              >
                {isRegistering ? "Submit Registration" : "Sign In"}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
              <button
                type="button"
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-teal-600 dark:text-teal-400 font-bold hover:underline"
              >
                {isRegistering ? "Back to Login" : "Register a new account"}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default Login;
