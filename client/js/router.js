// ==========================================================
// CLIENT-SIDE HASH ROUTER
// ==========================================================

import { store } from './store.js';
import { authView } from './views/authView.js';
import { dashboardView } from './views/dashboardView.js';
import { catalogView } from './views/catalogView.js';
import { circulationView } from './views/circulationView.js';
import { studentsView } from './views/studentsView.js';
import { reservationsView } from './views/reservationsView.js';
import { finesView } from './views/finesView.js';
import { reportsView } from './views/reportsView.js';
import { settingsView } from './views/settingsView.js';
import { auditView } from './views/auditView.js';
import { profileView } from './views/profileView.js';

const routes = {
  '/login': { view: authView.renderLogin.bind(authView), auth: false },
  '/register': { view: authView.renderRegister.bind(authView), auth: false },
  '/forgot-password': { view: authView.renderForgotPassword.bind(authView), auth: false },
  '/dashboard': { view: dashboardView.render.bind(dashboardView), auth: true },
  '/books': { view: catalogView.render.bind(catalogView), auth: true },
  '/circulation': { view: circulationView.render.bind(circulationView), auth: true, roles: ['admin', 'librarian'] },
  '/students': { view: studentsView.render.bind(studentsView), auth: true, roles: ['admin', 'librarian'] },
  '/reservations': { view: reservationsView.render.bind(reservationsView), auth: true },
  '/fines': { view: finesView.render.bind(finesView), auth: true },
  '/reports': { view: reportsView.render.bind(reportsView), auth: true, roles: ['admin', 'librarian'] },
  '/settings': { view: settingsView.render.bind(settingsView), auth: true, roles: ['admin'] },
  '/audit': { view: auditView.render.bind(auditView), auth: true, roles: ['admin'] },
  '/profile': { view: profileView.render.bind(profileView), auth: true }
};

export const router = {
  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  },

  handleRoute() {
    const rawHash = window.location.hash.slice(1) || '/dashboard';
    const path = rawHash.split('?')[0];

    const route = routes[path];
    const container = document.getElementById('main-content');
    const user = store.getState().user;

    // Handle Unauthenticated State
    if (!user) {
      if (route && !route.auth) {
        document.getElementById('app-shell-sidebar').style.display = 'none';
        document.getElementById('app-shell-header').style.display = 'none';
        document.querySelector('.app-main').style.marginLeft = '0';
        route.view(container);
      } else {
        window.location.hash = '#/login';
      }
      return;
    }

    // Authenticated state: restore shell
    document.getElementById('app-shell-sidebar').style.display = 'flex';
    document.getElementById('app-shell-header').style.display = 'flex';
    document.querySelector('.app-main').style.marginLeft = '';

    // If on login/register while authenticated -> redirect to dashboard
    if (path === '/login' || path === '/register' || path === '/forgot-password') {
      window.location.hash = '#/dashboard';
      return;
    }

    if (!route) {
      window.location.hash = '#/dashboard';
      return;
    }

    // Check Role Authorization
    if (route.roles && !route.roles.includes(user.role)) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🚫</div>
          <h2 class="empty-state-title">Access Restricted</h2>
          <p class="empty-state-text">Your account role (${user.role}) does not have permission to access this area.</p>
          <a href="#/dashboard" class="btn btn-primary">Return to Dashboard</a>
        </div>
      `;
      return;
    }

    // Update active class in sidebar nav
    document.querySelectorAll('.sidebar-nav .nav-item').forEach((item) => {
      if (item.getAttribute('href') === `#${path}`) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    route.view(container);
  }
};
