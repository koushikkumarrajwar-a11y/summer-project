// ==========================================================
// APP INITIALIZATION & EVENT ORCHESTRATION
// ==========================================================

import { api } from './api.js';
import { store } from './store.js';
import { router } from './router.js';
import { showToast, escapeHTML } from './components/toast.js';

let inactivityTimer = null;

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  // Auto logout after 30 minutes of inactivity (Section A5)
  inactivityTimer = setTimeout(() => {
    if (store.getState().user) {
      showToast('You have been logged out due to 30 minutes of inactivity.', 'info', 6000);
      handleLogout();
    }
  }, 30 * 60 * 1000);
}

['mousemove', 'keydown', 'click', 'scroll'].forEach((evt) => {
  window.addEventListener(evt, resetInactivityTimer);
});

async function handleLogout() {
  try {
    await api.post('/auth/logout');
  } catch (e) {
    console.error(e);
  }
  api.setToken('');
  store.setState({ user: null, unreadCount: 0, notifications: [] });
  window.location.hash = '#/login';
  showToast('Logged out successfully', 'info');
}

function updateNavigationForRole(user) {
  const navContainer = document.getElementById('sidebar-nav-container');
  if (!user) {
    navContainer.innerHTML = '';
    return;
  }

  const role = user.role;
  let navHTML = '';

  navHTML += `
    <div class="nav-section-label">General</div>
    <a href="#/dashboard" class="nav-item">
      <span class="nav-item-icon">📊</span>
      <span>Dashboard</span>
    </a>
    <a href="#/books" class="nav-item">
      <span class="nav-item-icon">📚</span>
      <span>Book Catalogue</span>
    </a>
  `;

  if (role === 'admin' || role === 'librarian') {
    navHTML += `
      <div class="nav-section-label">Circulation Desk</div>
      <a href="#/circulation" class="nav-item">
        <span class="nav-item-icon">🔄</span>
        <span>Issue & Return Desk</span>
      </a>
      <a href="#/reservations" class="nav-item">
        <span class="nav-item-icon">⏳</span>
        <span>Hold Queue</span>
      </a>
      <a href="#/fines" class="nav-item">
        <span class="nav-item-icon">💵</span>
        <span>Fines & Ledger</span>
      </a>
      <div class="nav-section-label">Administration</div>
      <a href="#/students" class="nav-item">
        <span class="nav-item-icon">👥</span>
        <span>${role === 'admin' ? 'User Accounts' : 'Students'}</span>
      </a>
      <a href="#/reports" class="nav-item">
        <span class="nav-item-icon">📈</span>
        <span>Reports & Analytics</span>
      </a>
    `;
  }

  if (role === 'student') {
    navHTML += `
      <div class="nav-section-label">My Library</div>
      <a href="#/reservations" class="nav-item">
        <span class="nav-item-icon">⏳</span>
        <span>My Reservations</span>
      </a>
      <a href="#/fines" class="nav-item">
        <span class="nav-item-icon">💳</span>
        <span>My Fines</span>
      </a>
    `;
  }

  if (role === 'admin') {
    navHTML += `
      <div class="nav-section-label">System Control</div>
      <a href="#/settings" class="nav-item">
        <span class="nav-item-icon">⚙️</span>
        <span>System Settings</span>
      </a>
      <a href="#/audit" class="nav-item">
        <span class="nav-item-icon">🛡️</span>
        <span>Audit Trail</span>
      </a>
    `;
  }

  navHTML += `
    <div class="nav-section-label">Account</div>
    <a href="#/profile" class="nav-item">
      <span class="nav-item-icon">👤</span>
      <span>My Profile</span>
    </a>
  `;

  navContainer.innerHTML = navHTML;

  // Update User Header Info
  document.getElementById('topbar-user-name').textContent = user.name;
  document.getElementById('topbar-user-role').textContent = user.role.toUpperCase();
  document.getElementById('topbar-user-avatar').textContent = user.name.charAt(0).toUpperCase();
}

async function loadNotifications() {
  const user = store.getState().user;
  if (!user) return;

  try {
    const res = await api.get('/notifications');
    const { notifications, unreadCount } = res.data;
    store.setState({ notifications, unreadCount });

    const badge = document.getElementById('notif-badge');
    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }

    const list = document.getElementById('notif-list-items');
    if (notifications.length === 0) {
      list.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.8rem;">No notifications</div>';
      return;
    }

    list.innerHTML = notifications.map((n) => `
      <div class="notif-item ${!n.isRead ? 'unread' : ''}" data-id="${n._id}">
        <div>${escapeHTML(n.message)}</div>
        <div class="notif-time">${new Date(n.createdAt).toLocaleDateString()}</div>
      </div>
    `).join('');

    list.querySelectorAll('.notif-item').forEach((item) => {
      item.onclick = async () => {
        const id = item.getAttribute('data-id');
        await api.patch(`/notifications/${id}/read`);
        loadNotifications();
      };
    });
  } catch (err) {
    console.error(err);
  }
}

// Initial Boot Sequence
async function bootApp() {
  // 1. Initialize Theme
  const theme = store.getState().theme;
  document.documentElement.setAttribute('data-theme', theme);
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    themeBtn.onclick = () => {
      store.toggleTheme();
      const current = store.getState().theme;
      themeBtn.textContent = current === 'dark' ? '☀️' : '🌙';
    };
  }

  // 2. Sidebar Mobile Toggle
  const sidebar = document.getElementById('app-shell-sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  if (toggleBtn) {
    toggleBtn.onclick = () => {
      sidebar.classList.toggle('open');
    };
  }

  // Close sidebar on mobile navigation
  sidebar.addEventListener('click', (e) => {
    if (e.target.closest('.nav-item') && window.innerWidth <= 1024) {
      sidebar.classList.remove('open');
    }
  });

  // 3. Notification Popover Toggle
  const notifBtn = document.getElementById('notif-bell-btn');
  const notifPopover = document.getElementById('notif-popover-box');
  if (notifBtn) {
    notifBtn.onclick = (e) => {
      e.stopPropagation();
      notifPopover.classList.toggle('active');
    };
  }

  document.addEventListener('click', (e) => {
    if (notifPopover && !notifPopover.contains(e.target) && e.target !== notifBtn) {
      notifPopover.classList.remove('active');
    }
  });

  const markAllReadBtn = document.getElementById('notif-mark-all-read');
  if (markAllReadBtn) {
    markAllReadBtn.onclick = async () => {
      await api.patch('/notifications/read-all');
      loadNotifications();
    };
  }

  // 4. Logout Handler
  document.getElementById('logout-btn').onclick = handleLogout;

  // 5. Check Active User Session
  if (api.token) {
    try {
      const res = await api.get('/auth/me');
      store.setState({ user: res.data });
      updateNavigationForRole(res.data);
      loadNotifications();
    } catch {
      api.setToken('');
    }
  }

  // React to User Changes
  store.subscribe('user', (state) => {
    updateNavigationForRole(state.user);
    if (state.user) {
      loadNotifications();
    }
  });

  // 6. Start Router
  router.init();
  resetInactivityTimer();
}

bootApp();
