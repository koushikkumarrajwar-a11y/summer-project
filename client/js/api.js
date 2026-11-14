// ==========================================================
// API CLIENT - Fetch wrapper with JWT & Error Handling
// ==========================================================

const API_BASE = '/api/v1';

export const api = {
  token: localStorage.getItem('lms_token') || '',

  setToken(t) {
    this.token = t;
    if (t) {
      localStorage.setItem('lms_token', t);
    } else {
      localStorage.removeItem('lms_token');
    }
  },

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = { ...options.headers };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include' // Sends HTTP-only cookies (refresh token)
      });

      // Handle 401 Unauthorized / Token expiration
      if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${this.token}`;
          return await fetch(url, { ...options, headers, credentials: 'include' }).then((r) => r.json());
        } else {
          this.setToken('');
          window.location.hash = '#/login';
          throw new Error('Session expired. Please log in again.');
        }
      }

      const data = await response.json().catch(() => ({
        success: response.ok,
        data: null,
        message: response.statusText
      }));

      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err.message);
      throw err;
    }
  },

  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: 'GET' });
  },

  async post(endpoint, data = {}) {
    const body = data instanceof FormData ? data : JSON.stringify(data);
    return this.request(endpoint, { method: 'POST', body });
  },

  async put(endpoint, data = {}) {
    const body = data instanceof FormData ? data : JSON.stringify(data);
    return this.request(endpoint, { method: 'PUT', body });
  },

  async patch(endpoint, data = {}) {
    const body = data instanceof FormData ? data : JSON.stringify(data);
    return this.request(endpoint, { method: 'PATCH', body });
  },

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },

  async refreshToken() {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.success && data.data.token) {
        this.setToken(data.data.token);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
};
