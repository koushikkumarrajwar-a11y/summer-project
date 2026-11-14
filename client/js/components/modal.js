// ==========================================================
// MODAL DIALOG HELPER
// ==========================================================

import { escapeHTML } from './toast.js';

let currentOnClose = null;

export function openModal({
  title = '',
  bodyHTML = '',
  footerHTML = '',
  size = 'md', // 'sm', 'md', 'lg'
  onClose = null
}) {
  currentOnClose = onClose;
  const backdrop = document.getElementById('modal-backdrop');
  const dialog = document.getElementById('modal-dialog');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  const footerEl = document.getElementById('modal-footer');

  dialog.className = `modal-dialog ${size === 'lg' ? 'modal-lg' : ''}`;
  titleEl.innerHTML = escapeHTML(title);
  bodyEl.innerHTML = bodyHTML;
  footerEl.innerHTML = footerHTML;

  backdrop.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Attach escape key handler
  document.addEventListener('keydown', handleKeyDown);
}

export function closeModal() {
  const backdrop = document.getElementById('modal-backdrop');
  backdrop.classList.remove('active');
  document.body.style.overflow = '';
  document.removeEventListener('keydown', handleKeyDown);

  if (typeof currentOnClose === 'function') {
    currentOnClose();
    currentOnClose = null;
  }
}

function handleKeyDown(e) {
  if (e.key === 'Escape') {
    closeModal();
  }
}

export function confirmDialog({ title = 'Confirm Action', message = 'Are you sure?', confirmText = 'Confirm', confirmClass = 'btn-primary', onConfirm }) {
  openModal({
    title,
    bodyHTML: `<p style="color: var(--text-muted); font-size: 0.95rem;">${escapeHTML(message)}</p>`,
    footerHTML: `
      <button class="btn btn-secondary" id="confirm-modal-cancel">Cancel</button>
      <button class="btn ${confirmClass}" id="confirm-modal-ok">${escapeHTML(confirmText)}</button>
    `
  });

  document.getElementById('confirm-modal-cancel').onclick = closeModal;
  document.getElementById('confirm-modal-ok').onclick = async () => {
    closeModal();
    if (onConfirm) await onConfirm();
  };
}
