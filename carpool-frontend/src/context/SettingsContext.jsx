import { createContext, useContext, useState, useEffect } from "react";
import { apiFetch } from "../config/api";

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    location: { lat: 10.728, lng: 76.2792 },
    contact: { phone: "", email: "", facebook: "", instagram: "" },
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch("/api/settings/config");
      const data = await res.json();
      if (data && !data.error) {
        setSettings(data);
      }
    } catch (err) {
      console.error("Failed to fetch settings config:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider
      value={{ settings, refreshSettings: fetchSettings, isLoading }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
