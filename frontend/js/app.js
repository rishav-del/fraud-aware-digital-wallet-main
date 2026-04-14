/* ============================================================
   app.js — Application Entry Point
   Navigation, Toast, Modal handlers, Initialization
   ============================================================ */

// ──────────────────────────────────────
// NAVIGATION
// ──────────────────────────────────────
function navigate(page, el) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    // Show target page
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');

    // Update sidebar active state
    document.querySelectorAll('.side-item').forEach(s => s.classList.remove('active'));
    if (el) el.classList.add('active');

    // Show/hide nav and sidebar on login page
    const mainNav = document.getElementById('main-nav');
    const sidebar = document.querySelector('aside');
    if (page === 'login') {
        mainNav.style.display = 'none';
        sidebar.style.display = 'none';
    } else {
        mainNav.style.display = '';
        sidebar.style.display = '';
    }

    // Load page data
    switch (page) {
        case 'dashboard':    loadDashboard(); break;
        case 'transactions': loadTransactions('all'); break;
        case 'fraud':        loadFraudAlerts(); break;
        case 'profile':      loadProfile(); break;
    }
}

// ──────────────────────────────────────
// TOAST NOTIFICATION
// ──────────────────────────────────────
let toastTimeout;
function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    clearTimeout(toastTimeout);

    const icons = { success: '✓', error: '✕', warn: '⚠' };
    t.innerHTML = `<span style="margin-right:8px;font-size:15px">${icons[type] || ''}</span>${msg}`;
    t.className = `toast toast-${type} show`;

    toastTimeout = setTimeout(() => t.classList.remove('show'), TOAST_DURATION);
}

// ──────────────────────────────────────
// MODAL: close on Escape or backdrop click
// ──────────────────────────────────────
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeAddMoneyModal();
    }
});
document.getElementById('add-money-modal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        closeAddMoneyModal();
    }
});

// ──────────────────────────────────────
// STARTUP
// ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Start on login page
    navigate('login', null);
});
