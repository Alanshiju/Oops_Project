import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const Footer = () => {
  const [socialLinks, setSocialLinks] = useState({
    whatsapp: "",
    facebook: "",
    instagram: "",
  });

  useEffect(() => {
    fetch("http://localhost:7070/api/settings/social")
      .then((res) => res.json())
      .then((data) => {
        if (data) setSocialLinks(data);
      })
      .catch((err) => console.error("Error fetching social links", err));
  }, []);

  return (
    <footer className="bg-slate-900 text-slate-300 py-12 border-t border-slate-800 pb-24 md:pb-12">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Brand Column */}
        <div className="flex flex-col">
          <Link
            to="/"
            className="text-2xl font-extrabold tracking-wider text-white mb-4"
          >
            CAMPUS<span className="text-emerald-500">POOL</span>
          </Link>
          <p className="text-sm leading-relaxed text-slate-400 max-w-xs">
            The smart, secure, and eco-friendly carpool platform exclusively
            built for Jyothi Engineering College. Let's reduce campus traffic
            together.
          </p>
        </div>

        {/* Quick Links */}
        <div className="flex flex-col">
          <h3 className="text-lg font-bold text-white mb-4">Quick Links</h3>
          <ul className="space-y-2 text-sm font-medium">
            <li>
              <Link
                to="/about"
                className="hover:text-emerald-400 transition-colors"
              >
                About Us
              </Link>
            </li>
            <li>
              <Link
                to="/how-it-works"
                className="hover:text-emerald-400 transition-colors"
              >
                How it Works
              </Link>
            </li>
            <li>
              <Link
                to="/contact"
                className="hover:text-emerald-400 transition-colors"
              >
                Contact Support
              </Link>
            </li>
            <li>
              <Link
                to="/login"
                className="hover:text-emerald-400 transition-colors"
              >
                Driver Login
              </Link>
            </li>
          </ul>
        </div>

        {/* Social Contact */}
        <div className="flex flex-col">
          <h3 className="text-lg font-bold text-white mb-4">Connect With Us</h3>
          <p className="text-sm text-slate-400 mb-4">
            Follow us for updates and community stories.
          </p>
          <div className="flex gap-4">
            {socialLinks.whatsapp && (
              <a
                href={socialLinks.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-slate-800 hover:bg-emerald-500 hover:text-white rounded-full flex items-center justify-center transition-all shadow-md"
              >
                <span className="text-xl">💬</span>
              </a>
            )}
            {socialLinks.facebook && (
              <a
                href={socialLinks.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-slate-800 hover:bg-blue-600 hover:text-white rounded-full flex items-center justify-center transition-all shadow-md"
              >
                <span className="text-xl">📘</span>
              </a>
            )}
            {socialLinks.instagram && (
              <a
                href={socialLinks.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-slate-800 hover:bg-pink-600 hover:text-white rounded-full flex items-center justify-center transition-all shadow-md"
              >
                <span className="text-xl">📸</span>
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 mt-12 pt-6 border-t border-slate-800 text-xs text-center text-slate-500">
        &copy; {new Date().getFullYear()} CampusPool by Jyothi Engineering
        College. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
