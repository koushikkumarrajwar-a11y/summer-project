// ==========================================================
// AUTHENTICATION VIEW (Login, Register, Forgot/Reset Password)
// ==========================================================

import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, escapeHTML } from '../components/toast.js';

export const authView = {
  renderLogin(container) {
    container.innerHTML = `
      <div style="min-height: calc(100vh - 120px); display: flex; align-items: center; justify-content: center; padding: 1.5rem;">
        <div class="card" style="width: 100%; max-width: 440px;">
          <div class="card-body" style="padding: 2rem;">
            <div style="text-align: center; margin-bottom: 1.75rem;">
              <div class="brand-logo-icon" style="width: 48px; height: 48px; font-size: 1.5rem; margin: 0 auto 0.75rem;">📚</div>
              <h1 style="font-size: 1.35rem; font-weight: 700; margin-bottom: 0.25rem;">Library Management System</h1>
              <p style="color: var(--text-muted); font-size: 0.85rem;">Sign in to access your portal</p>
            </div>

            <form id="login-form">
              <div class="form-group">
                <label class="form-label required" for="login-id">Email or Student ID</label>
                <input type="text" id="login-id" class="form-control" placeholder="name@library.com or STU-2026-001" required autocomplete="username" />
              </div>

              <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label class="form-label required" for="login-password">Password</label>
                  <a href="#/forgot-password" style="font-size: 0.75rem;">Forgot password?</a>
                </div>
                <input type="password" id="login-password" class="form-control" placeholder="••••••••" required autocomplete="current-password" />
              </div>

              <button type="submit" class="btn btn-primary" id="login-btn" style="width: 100%; margin-top: 0.5rem; height: 40px;">
                Sign In
              </button>
            </form>

            <div style="margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px solid var(--border-color); text-align: center; font-size: 0.85rem;">
              New student? <a href="#/register" style="font-weight: 600;">Create an account</a>
            </div>

            <!-- Demo Credentials Quick Selector -->
            <div style="margin-top: 1.25rem; background-color: var(--bg-subtle); border-radius: var(--radius-sm); padding: 0.75rem; font-size: 0.75rem;">
              <div style="font-weight: 600; margin-bottom: 0.5rem; color: var(--text-muted);">Quick Fill Demo Logins:</div>
              <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                <button type="button" class="btn btn-secondary btn-sm" id="demo-admin">Admin</button>
                <button type="button" class="btn btn-secondary btn-sm" id="demo-librarian">Librarian</button>
                <button type="button" class="btn btn-secondary btn-sm" id="demo-student">Student</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('demo-admin').onclick = () => {
      document.getElementById('login-id').value = 'admin@library.com';
      document.getElementById('login-password').value = 'Admin@12345';
    };
    document.getElementById('demo-librarian').onclick = () => {
      document.getElementById('login-id').value = 'librarian@library.com';
      document.getElementById('login-password').value = 'Librarian@12345';
    };
    document.getElementById('demo-student').onclick = () => {
      document.getElementById('login-id').value = 'student@library.com';
      document.getElementById('login-password').value = 'Student@12345';
    };

    const form = document.getElementById('login-form');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const identifier = document.getElementById('login-id').value.trim();
      const password = document.getElementById('login-password').value;
      const btn = document.getElementById('login-btn');

      btn.disabled = true;
      btn.textContent = 'Authenticating...';

      try {
        const res = await api.post('/auth/login', { identifier, password });
        if (res.success) {
          api.setToken(res.data.token);
          store.setState({ user: res.data.user });
          showToast(`Welcome back, ${res.data.user.name}!`, 'success');
          window.location.hash = '#/dashboard';
        }
      } catch (err) {
        showToast(err.message, 'error', 5000);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    };
  },

  renderRegister(container) {
    container.innerHTML = `
      <div style="min-height: calc(100vh - 120px); display: flex; align-items: center; justify-content: center; padding: 1.5rem;">
        <div class="card" style="width: 100%; max-width: 500px;">
          <div class="card-body" style="padding: 2rem;">
            <div style="text-align: center; margin-bottom: 1.5rem;">
              <h1 style="font-size: 1.35rem; font-weight: 700;">Student Self-Registration</h1>
              <p style="color: var(--text-muted); font-size: 0.85rem;">Create your university library account</p>
            </div>

            <form id="register-form">
              <div class="form-group">
                <label class="form-label required" for="reg-name">Full Name</label>
                <input type="text" id="reg-name" class="form-control" placeholder="Alex Mercer" required />
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                  <label class="form-label required" for="reg-id">Student ID</label>
                  <input type="text" id="reg-id" class="form-control" placeholder="STU-2026-999" required />
                </div>
                <div class="form-group">
                  <label class="form-label required" for="reg-email">University Email</label>
                  <input type="email" id="reg-email" class="form-control" placeholder="alex@university.edu" required />
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                  <label class="form-label" for="reg-dept">Department</label>
                  <input type="text" id="reg-dept" class="form-control" placeholder="Computer Science" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="reg-year">Academic Year</label>
                  <input type="text" id="reg-year" class="form-control" placeholder="3rd Year" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="reg-phone">Phone Number</label>
                <input type="tel" id="reg-phone" class="form-control" placeholder="+1 (555) 000-0000" />
              </div>

              <div class="form-group">
                <label class="form-label required" for="reg-password">Password (min 8 chars, 1 letter, 1 number)</label>
                <input type="password" id="reg-password" class="form-control" placeholder="••••••••" required />
                <div class="password-strength">
                  <div id="strength-bar" class="password-strength-bar"></div>
                </div>
                <span id="strength-label" style="font-size: 0.7rem; color: var(--text-subtle);">Password strength: Empty</span>
              </div>

              <button type="submit" class="btn btn-primary" id="reg-btn" style="width: 100%; margin-top: 0.5rem; height: 40px;">
                Complete Registration
              </button>
            </form>

            <div style="margin-top: 1.25rem; text-align: center; font-size: 0.85rem;">
              Already registered? <a href="#/login" style="font-weight: 600;">Sign In</a>
            </div>
          </div>
        </div>
      </div>
    `;

    // Password strength calculation
    const pwInput = document.getElementById('reg-password');
    const bar = document.getElementById('strength-bar');
    const label = document.getElementById('strength-label');

    pwInput.addEventListener('input', () => {
      const val = pwInput.value;
      let score = 0;
      if (val.length >= 8) score++;
      if (/[A-Z]/.test(val)) score++;
      if (/[0-9]/.test(val)) score++;
      if (/[^A-Za-z0-9]/.test(val)) score++;

      if (val.length === 0) {
        bar.style.width = '0%';
        label.textContent = 'Password strength: Empty';
      } else if (score <= 1) {
        bar.style.width = '25%';
        bar.style.backgroundColor = 'var(--color-danger)';
        label.textContent = 'Password strength: Weak';
      } else if (score === 2) {
        bar.style.width = '50%';
        bar.style.backgroundColor = 'var(--color-warning)';
        label.textContent = 'Password strength: Moderate';
      } else if (score === 3) {
        bar.style.width = '75%';
        bar.style.backgroundColor = 'var(--color-info)';
        label.textContent = 'Password strength: Good';
      } else {
        bar.style.width = '100%';
        bar.style.backgroundColor = 'var(--color-success)';
        label.textContent = 'Password strength: Strong';
      }
    });

    const form = document.getElementById('register-form');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-name').value.trim();
      const studentId = document.getElementById('reg-id').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const department = document.getElementById('reg-dept').value.trim();
      const year = document.getElementById('reg-year').value.trim();
      const phone = document.getElementById('reg-phone').value.trim();
      const password = pwInput.value;

      const btn = document.getElementById('reg-btn');
      btn.disabled = true;
      btn.textContent = 'Registering...';

      try {
        const res = await api.post('/auth/register', {
          name,
          studentId,
          email,
          department,
          year,
          phone,
          password
        });
        showToast(res.message, 'success', 6000);
        window.location.hash = '#/login';
      } catch (err) {
        showToast(err.message, 'error', 5000);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Complete Registration';
      }
    };
  },

  renderForgotPassword(container) {
    container.innerHTML = `
      <div style="min-height: calc(100vh - 120px); display: flex; align-items: center; justify-content: center; padding: 1.5rem;">
        <div class="card" style="width: 100%; max-width: 440px;">
          <div class="card-body" style="padding: 2rem;">
            <div style="text-align: center; margin-bottom: 1.5rem;">
              <h1 style="font-size: 1.35rem; font-weight: 700;">Reset Password</h1>
              <p style="color: var(--text-muted); font-size: 0.85rem;">Enter your email to receive a single-use 30-minute link</p>
            </div>

            <form id="forgot-form">
              <div class="form-group">
                <label class="form-label required" for="forgot-email">Account Email</label>
                <input type="email" id="forgot-email" class="form-control" placeholder="name@library.com" required />
              </div>

              <button type="submit" class="btn btn-primary" id="forgot-btn" style="width: 100%; margin-top: 0.5rem; height: 40px;">
                Send Reset Link
              </button>
            </form>

            <div style="margin-top: 1.25rem; text-align: center; font-size: 0.85rem;">
              Remember your password? <a href="#/login">Return to login</a>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('forgot-form').onsubmit = async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgot-email').value.trim();
      const btn = document.getElementById('forgot-btn');
      btn.disabled = true;
      btn.textContent = 'Sending...';

      try {
        const res = await api.post('/auth/forgot-password', { email });
        showToast(res.message, 'info', 7000);
        if (res.data && res.data.resetUrl) {
          console.log(`[Dev Reset Link]: ${res.data.resetUrl}`);
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Send Reset Link';
      }
    };
  }
};
