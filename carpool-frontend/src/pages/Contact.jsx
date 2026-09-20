import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useSettings } from "../context/SettingsContext";
import { useState } from "react";

const Contact = () => {
  const { settings } = useSettings();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSendMessage = (e) => {
    e.preventDefault();
    const destination = settings?.contact?.email || "support@jecc.ac.in";
    const subject = encodeURIComponent(`CampusPool Inquiry from ${name}`);
    const body = encodeURIComponent(
      `${message}\n\n---\nSender: ${name}\nEmail: ${email}`,
    );
    window.location.href = `mailto:${destination}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-16 px-6">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 dark:text-white mb-6 tracking-tight">
            Get in touch.
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 leading-relaxed">
            Have a question about the platform? Want to report an issue or
            suggest a feature? We'd love to hear from you. Drop us a line and
            our campus support team will respond shortly.
          </p>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-xl shadow-sm border border-slate-100 dark:border-slate-700 text-teal-600 dark:text-teal-400 shrink-0">
                📍
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white">
                  Campus Office
                </h4>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  Jyothi Engineering College
                  <br />
                  Cheruthuruthy, Thrissur
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-xl shadow-sm border border-slate-100 dark:border-slate-700 text-teal-600 dark:text-teal-400 shrink-0">
                📞
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white">
                  Call Us
                </h4>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  {settings?.contact?.phone || "+91 (555) 000-0000"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-xl shadow-sm border border-slate-100 dark:border-slate-700 text-teal-600 dark:text-teal-400 shrink-0">
                ✉️
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white">
                  Email Us
                </h4>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  {settings?.contact?.email || "support@campuspool.jecc.ac.in"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700">
          <form onSubmit={handleSendMessage} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                Your Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-400"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                College Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-400"
                placeholder="john@jecc.ac.in"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                Message
              </label>
              <textarea
                required
                rows="4"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 resize-none"
                placeholder="How can we help?"
              ></textarea>
            </div>
            <button
              type="submit"
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl shadow-md active:scale-95 transition-transform"
            >
              Send Message
            </button>
          </form>
        </div>
      </div>
      {settings?.location && (
        <div className="max-w-5xl mx-auto mt-16">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">
            Our Campus Location
          </h2>
          <div className="h-[300px] w-full rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-700 relative z-0">
            <MapContainer
              center={[settings.location.lat, settings.location.lng]}
              zoom={15}
              className="w-full h-full"
              zoomControl={false}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              <Marker position={[settings.location.lat, settings.location.lng]}>
                <Popup>Campus Drop-Off Destination</Popup>
              </Marker>
            </MapContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contact;
