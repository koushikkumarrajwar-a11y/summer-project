// ==========================================================
// STORE - Lightweight Pub/Sub Reactive State Management
// ==========================================================

class Store {
  constructor() {
    this.state = {
      user: null,
      theme: localStorage.getItem('lms_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
      settings: null,
      unreadCount: 0,
      notifications: []
    };
    this.listeners = new Map();
  }

  getState() {
    return this.state;
  }

  setState(partialState) {
    this.state = { ...this.state, ...partialState };
    this.notify();
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    return () => this.listeners.get(key).delete(callback);
  }

  notify() {
    this.listeners.forEach((set) => {
      set.forEach((cb) => cb(this.state));
    });
  }

  setTheme(theme) {
    this.setState({ theme });
    localStorage.setItem('lms_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }

  toggleTheme() {
    const nextTheme = this.state.theme === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
  }
}

export const store = new Store();
