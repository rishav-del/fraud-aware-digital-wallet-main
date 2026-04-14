/* api.js — Auth with Firebase Google Sign-In + Demo Mode */

let currentUser = null;
let authToken = null;
let demoMode = false;

// Firebase init
try { firebase.initializeApp(FIREBASE_CONFIG); } catch(e) { console.warn('Firebase init skipped'); }

// API helper
async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    else if (demoMode && currentUser) headers['X-Demo-User-Email'] = currentUser.Email;

    const res = await fetch(API_BASE + path, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
}

// ── Google Sign-In (auto-registers if new user) ──
async function doGoogleLogin() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await firebase.auth().signInWithPopup(provider);
        const email = result.user.email;
        const displayName = result.user.displayName;

        // Check if email exists in DB
        const check = await fetch(API_BASE + '/check-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        }).then(r => r.json());

        // If new user → auto-register in MySQL
        if (!check.exists) {
            const reg = await fetch(API_BASE + '/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, name: displayName, firebase_uid: result.user.uid })
            }).then(r => r.json());

            if (reg.status === 'created') {
                showToast(reg.message, 'success');
            }
        }

        authToken = await result.user.getIdToken();
        demoMode = false;
        await loadUserAndEnter(displayName);

    } catch (err) {
        if (err.code === 'auth/popup-closed-by-user') return;
        showToast('Google login failed: ' + err.message, 'error');
    }
}

// ── Email/Password Login ──
async function doLogin() {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;
    if (!email) return showToast('Enter your email', 'error');
    if (!pass) return showToast('Enter your password', 'error');

    try {
        const cred = await firebase.auth().signInWithEmailAndPassword(email, pass);
        authToken = await cred.user.getIdToken();
        demoMode = false;

        // Check if in MySQL, auto-register if not
        const check = await fetch(API_BASE + '/check-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        }).then(r => r.json());

        if (!check.exists) {
            await fetch(API_BASE + '/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, firebase_uid: cred.user.uid })
            });
        }

        await loadUserAndEnter();
    } catch (err) {
        if (err.code === 'auth/user-not-found') {
            showToast('No account found — click Sign Up first', 'error');
        } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            showToast('Wrong password', 'error');
        } else {
            showToast('Login failed: ' + err.message, 'error');
        }
    }
}

// ── Demo Login ──
async function doDemoLogin() {
    const email = document.getElementById('login-email').value.trim() || 'arjun@mail.com';
    demoMode = true;
    authToken = null;
    currentUser = { Email: email };

    try {
        const data = await api('/wallet');
        currentUser = { ...data.user, ...data.wallet };
        updateNav();
        navigate('dashboard', document.querySelector('[data-page="dashboard"]'));
        showToast(`Welcome, ${currentUser.Name}!`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ── Signup (auto-registers in MySQL) ──
async function doSignup() {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;
    if (!email) return showToast('Enter your email', 'error');
    if (!pass || pass.length < 6) return showToast('Password must be at least 6 characters', 'error');

    try {
        // Create Firebase account
        const cred = await firebase.auth().createUserWithEmailAndPassword(email, pass);
        authToken = await cred.user.getIdToken();
        demoMode = false;

        // Auto-register in MySQL
        const reg = await fetch(API_BASE + '/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, firebase_uid: cred.user.uid })
        }).then(r => r.json());

        if (reg.status === 'created') {
            showToast(reg.message, 'success');
        }

        await loadUserAndEnter();
    } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
            showToast('Account already exists — use Login instead', 'error');
        } else {
            showToast('Signup failed: ' + err.message, 'error');
        }
    }
}

// ── Load user and go to dashboard ──
async function loadUserAndEnter(googleDisplayName) {
    try {
        const data = await api('/wallet');
        currentUser = { ...data.user, ...data.wallet };
        // If Google login provided a display name, use it
        if (googleDisplayName) currentUser.displayName = googleDisplayName;
        updateNav();
        navigate('dashboard', document.querySelector('[data-page="dashboard"]'));
        showToast(`Welcome, ${currentUser.displayName || currentUser.Name}!`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function doLogout() {
    try { firebase.auth().signOut(); } catch(e) {}
    authToken = null; demoMode = false; currentUser = null;
    navigate('login', null);
    showToast('Logged out', 'success');
}

function updateNav() {
    if (!currentUser) return;
    const name = currentUser.displayName || currentUser.Name || '?';
    const initial = name[0].toUpperCase();
    document.getElementById('nav-avatar').textContent = initial;
    document.getElementById('nav-user-name').textContent = name;
    document.getElementById('nav-user-email').textContent = currentUser.Email;
}
