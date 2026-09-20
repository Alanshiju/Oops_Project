export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:7070";
export const WS_BASE_URL =
  import.meta.env.VITE_WS_BASE_URL || "ws://localhost:7070";

export const apiFetch = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const defaultOptions = {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  };

  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  return fetch(url, finalOptions);
};
