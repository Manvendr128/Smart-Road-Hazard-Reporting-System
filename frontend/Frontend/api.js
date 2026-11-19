/**
 * Smart Road Hazard Reporting System - Centralized Frontend API Service
 * Centralizes communication with the Node.js / Express backend at http://localhost:5000
 */

const API_CONFIG = {
    BASE_URL: "http://localhost:5000/api",
    TOKEN_KEY: "sr_auth_token",
    USER_KEY: "sr_auth_user"
};

/**
 * Authentication storage utilities
 */
const AuthStorage = {
    getToken() {
        try {
            return localStorage.getItem(API_CONFIG.TOKEN_KEY);
        } catch (e) {
            console.error("Error reading token from storage:", e);
            return null;
        }
    },

    getUser() {
        try {
            const raw = localStorage.getItem(API_CONFIG.USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.error("Error reading user from storage:", e);
            return null;
        }
    },

    setAuth(token, user) {
        try {
            if (token) localStorage.setItem(API_CONFIG.TOKEN_KEY, token);
            if (user) localStorage.setItem(API_CONFIG.USER_KEY, JSON.stringify(user));
        } catch (e) {
            console.error("Error saving auth to storage:", e);
        }
    },

    clearAuth() {
        try {
            localStorage.removeItem(API_CONFIG.TOKEN_KEY);
            localStorage.removeItem(API_CONFIG.USER_KEY);
            // Also clean legacy demo keys if any
            localStorage.removeItem("isLoggedIn");
        } catch (e) {
            console.error("Error clearing auth from storage:", e);
        }
    },

    isAuthenticated() {
        return !!this.getToken();
    },

    isAdmin() {
        const user = this.getUser();
        return user && user.role === "admin";
    }
};

/**
 * Centralized HTTP request handler
 */
async function apiRequest(endpoint, options = {}) {
    const url = `${API_CONFIG.BASE_URL}${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`;

    const headers = {
        "Accept": "application/json",
        ...(options.headers || {})
    };

    // If body is present and not FormData, stringify and set Content-Type
    let body = options.body;
    if (body && !(body instanceof FormData) && typeof body === "object") {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(body);
    }

    // Attach Bearer JWT token if user is authenticated
    const token = AuthStorage.getToken();
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers,
            body
        });

        let data = null;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            data = await response.json();
        } else {
            const text = await response.text();
            data = { message: text };
        }

        // Handle expired or invalid session on protected calls
        if (response.status === 401 && endpoint !== "/users/login") {
            AuthStorage.clearAuth();
            if (!window.location.pathname.endsWith("login.html") && !window.location.pathname.endsWith("/login")) {
                window.location.href = `login.html?session_expired=true`;
            }
        }

        return {
            ok: response.ok,
            status: response.status,
            data: data,
            message: data?.message || (response.ok ? "Success" : "Request failed")
        };
    } catch (networkError) {
        console.error("Network communication error:", networkError);
        return {
            ok: false,
            status: 0,
            data: null,
            message: "Cannot connect to server. Please ensure the backend is running at http://localhost:5000."
        };
    }
}

/**
 * Authentication and User Services
 */
const authAPI = {
    /**
     * Register a new user
     * @param {{ name: string, email: string, phone: string, password: string }} userData
     */
    async register(userData) {
        return await apiRequest("/users/register", {
            method: "POST",
            body: userData
        });
    },

    /**
     * Log in user or admin
     * @param {{ email: string, password: string }} credentials
     */
    async login(credentials) {
        const result = await apiRequest("/users/login", {
            method: "POST",
            body: credentials
        });

        if (result.ok && result.data && result.data.token) {
            AuthStorage.setAuth(result.data.token, result.data.user);
        }

        return result;
    },

    /**
     * Fetch authenticated user's profile
     */
    async getProfile() {
        return await apiRequest("/users/profile", {
            method: "GET"
        });
    },

    /**
     * Log out current user
     */
    logout() {
        AuthStorage.clearAuth();
        window.location.href = "login.html";
    },

    // Storage utility aliases
    getToken: () => AuthStorage.getToken(),
    getUser: () => AuthStorage.getUser(),
    isAuthenticated: () => AuthStorage.isAuthenticated(),
    isAdmin: () => AuthStorage.isAdmin(),
    clearAuth: () => AuthStorage.clearAuth()
};

/**
 * Hazard Report Services
 */
const reportAPI = {
    /**
     * Submit a new hazard report
     * @param {FormData} formData
     */
    async createReport(formData) {
        return await apiRequest("/reports", {
            method: "POST",
            body: formData
        });
    },

    /**
     * Get all reports submitted by the authenticated citizen
     */
    async getMyReports() {
        return await apiRequest("/reports/my-reports", {
            method: "GET"
        });
    },

    /**
     * Get a single report by its MongoDB _id
     * @param {string} id
     */
    async getReportById(id) {
        return await apiRequest(`/reports/${id}`, {
            method: "GET"
        });
    },

    /**
     * Admin: Get all submitted reports
     */
    async getAllReports() {
        return await apiRequest("/reports", {
            method: "GET"
        });
    },

    /**
     * Admin: Update report status
     * @param {string} id - MongoDB _id
     * @param {{ status: string, remark: string }} updateData
     */
    async updateReportStatus(id, updateData) {
        return await apiRequest(`/reports/${id}/status`, {
            method: "PATCH",
            body: updateData
        });
    }
};

/**
 * Common Navbar State Synchronizer
 * Updates navigation buttons based on current authentication state
 */
function updateNavbarAuth() {
    const user = AuthStorage.getUser();
    const isAuth = AuthStorage.isAuthenticated() && user;

    // Update nav links for authenticated users
    const navLinksList = document.querySelectorAll(".nav-links");
    navLinksList.forEach(nav => {
        if (isAuth) {
            if (user.role === "admin") {
                const hasAdminLink = nav.querySelector('a[href="admin.html"]');
                if (!hasAdminLink) {
                    const adminA = document.createElement("a");
                    adminA.href = "admin.html";
                    adminA.textContent = "🛡️ Admin Dashboard";
                    adminA.style.fontWeight = "700";
                    adminA.style.color = "#1d4ed8";
                    if (window.location.pathname.endsWith("admin.html")) adminA.className = "active";
                    nav.appendChild(adminA);
                }
            } else {
                const hasReportLink = nav.querySelector('a[href="report.html"]');
                const hasMyReportsLink = nav.querySelector('a[href="my-reports.html"]');
                if (!hasReportLink) {
                    const reportA = document.createElement("a");
                    reportA.href = "report.html";
                    reportA.textContent = "Report Hazard";
                    if (window.location.pathname.endsWith("report.html")) reportA.className = "active";
                    nav.appendChild(reportA);
                }
                if (!hasMyReportsLink) {
                    const myReportsA = document.createElement("a");
                    myReportsA.href = "my-reports.html";
                    myReportsA.textContent = "My Reports";
                    if (window.location.pathname.endsWith("my-reports.html") || window.location.pathname.endsWith("report-details.html")) myReportsA.className = "active";
                    nav.appendChild(myReportsA);
                }
            }
        }
    });

    // Update nav-buttons container
    const navButtons = document.querySelectorAll(".nav-buttons");
    navButtons.forEach(container => {
        if (isAuth) {
            const roleBadge = user.role === "admin" ? "🛡️ Admin" : "👤 Citizen";
            const dashboardLink = user.role === "admin" ? "admin.html" : "features.html";

            container.innerHTML = `
                <a href="${dashboardLink}" class="login-btn" style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.1);">
                    <span>${roleBadge}: <strong>${escapeHtml(user.name.split(" ")[0])}</strong></span>
                </a>
                <button type="button" id="logoutNavBtn" class="signup-btn" style="cursor:pointer;border:none;">
                    Logout
                </button>
            `;

            const logoutBtn = container.querySelector("#logoutNavBtn");
            if (logoutBtn) {
                logoutBtn.addEventListener("click", () => {
                    authAPI.logout();
                });
            }
        }
    });

    // Check for session_expired alert
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("session_expired") === "true") {
        const alertBox = document.getElementById("loginError") || document.getElementById("errorMessage");
        if (alertBox) {
            alertBox.textContent = "Your session has expired or is invalid. Please log in again.";
            alertBox.style.color = "#dc2626";
            alertBox.style.display = "block";
        }
    }
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Auto-run navbar sync when DOM is loaded
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateNavbarAuth);
} else {
    updateNavbarAuth();
}

// Expose globally to window
window.API_CONFIG = API_CONFIG;
window.AuthStorage = AuthStorage;
window.authAPI = authAPI;
window.reportAPI = reportAPI;
window.apiRequest = apiRequest;
