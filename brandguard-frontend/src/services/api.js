
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

// Get the saved authentication token
export const getToken = () => {
  return localStorage.getItem("brandguard_token");
};

// Save login information
export const saveAuth = (token, user) => {
  localStorage.setItem("brandguard_token", token);
  localStorage.setItem("brandguard_user", JSON.stringify(user));
};

// Clear login information
export const clearAuth = () => {
  localStorage.removeItem("brandguard_token");
  localStorage.removeItem("brandguard_user");
};

// Get saved user
export const getSavedUser = () => {
  const user = localStorage.getItem("brandguard_user");
  return user ? JSON.parse(user) : null;
};

// Common API request function
export const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();

  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
};

// Login API
export const loginUser = async (email, password) => {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  saveAuth(data.token, data.user);
  return data;
};

// Get current logged-in user
export const getCurrentUser = () => {
  return apiRequest("/auth/me");
};

// Logout
export const logoutUser = () => {
  clearAuth();
};
