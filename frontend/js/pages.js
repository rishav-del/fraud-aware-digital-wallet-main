/* ============================================================
   pages.js — Page Data Loading & Interaction Logic
   ============================================================ */

// ──────────────────────────────────────
// DASHBOARD
// ──────────────────────────────────────
async function loadDashboard() {
    if (!currentUser) return;
    try {
        // Refresh wallet balance
        const walletData = await api('/wallet');
        currentUser = { ...walletData.user, ...walletData.wallet };

        document.getElementById('dash-greeting').textContent =
            `Welcome back, ${currentUser.Name}!`;
        document.getElementById('dash-balance').textContent =
            '₹ ' + Number(currentUser.Balance).toLocaleString('en-IN');

        // Stats
        const stats = await api('/wallet/stats');
        document.getElementById('dash-received').textContent =
            '₹ ' + stats.received_this_month.toLocaleString('en-IN');
        document.getElementById('dash-sent').textContent =
            '₹ ' + stats.sent_this_month.toLocaleString('en-IN');
        document.getElementById('dash-alerts').textContent = stats.active_alerts;

        // Update nav badges
        document.getElementById('nav-alert-badge').textContent = stats.active_alerts;
        document.getElementById('side-alert-badge').textContent = stats.active_alerts;

        // Alert strip visibility
        const strip = document.getElementById('dash-alert-strip');
        const noAlerts = document.getElementById('dash-no-alerts');
        if (stats.active_alerts > 0) {
            strip.style.display = 'flex';
            noAlerts.style.display = 'none';
            document.getElementById('dash-alert-msg').textContent =
                `${stats.active_alerts} alert(s) need attention`;
        } else {
            strip.style.display = 'none';
            noAlerts.style.display = 'block';
        }

        // Recent transactions
        const txnData = await api('/transactions?limit=5');
        renderRecentTxns(txnData.transactions);

    } catch (err) {
        console.error('Dashboard error:', err);
    }
}

function renderRecentTxns(txns) {
    const container = document.getElementById('dash-recent-txns');
    if (!txns || txns.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <div class="empty-state-icon">📭</div>
            <p>No transactions yet — send some money!</p>
        </div>`;
        return;
    }
    container.innerHTML = txns.map(t => {
        const isSent = t.type === 'sent';
        const iconClass = t.is_flagged ? 'ti-flag' : (isSent ? 'ti-sent' : 'ti-recv');
        const amtClass = isSent ? 'amt-neg' : 'amt-pos';
        const sign = isSent ? '- ' : '+ ';
        const time = new Date(t.time).toLocaleString('en-IN', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const flag = t.is_flagged
            ? ' <span class="chip chip-flag" style="font-size:10px;margin-left:4px">Flagged</span>'
            : '';
        const svgIcon = isSent
            ? '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/>'
            : '<polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/>';

        return `<div class="txn-row animate-in">
            <div class="txn-icon ${iconClass}">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">${svgIcon}</svg>
            </div>
            <div class="txn-info">
                <div class="txn-name">${isSent ? 'Sent to' : 'Received from'} ${t.counterparty.name || 'Unknown'}</div>
                <div class="txn-sub">${time}${t.is_flagged ? ' · <span style="color:var(--red);font-weight:500">FLAGGED</span>' : ''}</div>
            </div>
            <div class="txn-amt ${amtClass}">${sign}₹ ${t.amount.toLocaleString('en-IN')}${flag}</div>
        </div>`;
    }).join('');
}

// ──────────────────────────────────────
// SEND MONEY
// ──────────────────────────────────────
function updateSummary() {
    const v = parseFloat(document.getElementById('send-amount').value) || 0;
    const s = document.getElementById('send-summary');
    if (v > 0) {
        s.style.display = 'block';
        document.getElementById('sum-amount').textContent = '₹ ' + v.toLocaleString('en-IN');
        document.getElementById('sum-total').textContent = '₹ ' + v.toLocaleString('en-IN');
    } else {
        s.style.display = 'none';
    }
}

async function doSendMoney() {
    const email = document.getElementById('send-email').value.trim();
    const amount = parseFloat(document.getElementById('send-amount').value);
    const note = document.getElementById('send-note').value.trim();
    const btn = document.getElementById('send-btn');

    if (!email) return showToast('Enter recipient email', 'error');
    if (!amount || amount <= 0) return showToast('Enter a valid amount', 'error');

    btn.disabled = true;
    btn.textContent = 'Processing…';

    try {
        const result = await api('/send-money', {
            method: 'POST',
            body: JSON.stringify({ recipient_email: email, amount, note })
        });

        // Show fraud result box
        const box = document.getElementById('fraud-result-box');
        const title = document.getElementById('fraud-result-title');
        const text = document.getElementById('fraud-result-text');
        box.className = 'fraud-result show';

        if (result.fraud.is_flagged && result.status === 'Blocked') {
            box.classList.add('fraud-result-fraud');
            title.textContent = `🚫 BLOCKED — Fraud Score: ${result.fraud.score}%`;
            text.textContent = result.message;
            showToast('Transaction blocked by fraud system', 'error');
        } else if (result.fraud.is_flagged) {
            box.classList.add('fraud-result-warn');
            title.textContent = `⚠️ FLAGGED — Fraud Score: ${result.fraud.score}%`;
            text.textContent = `${result.message}. ₹${amount.toLocaleString('en-IN')} sent to ${result.recipient.name}, pending review.`;
            showToast('Transaction flagged for review', 'warn');
        } else {
            box.classList.add('fraud-result-clear');
            title.textContent = `✅ CLEAR — Fraud Score: ${result.fraud.score}%`;
            text.textContent = `₹${amount.toLocaleString('en-IN')} sent to ${result.recipient.name} successfully!`;
            showToast('Money sent!', 'success');
        }

        // Clear form
        document.getElementById('send-email').value = '';
        document.getElementById('send-amount').value = '';
        document.getElementById('send-note').value = '';
        document.getElementById('send-summary').style.display = 'none';

    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Send Money Securely';
    }
}

// ──────────────────────────────────────
// TRANSACTIONS PAGE
// ──────────────────────────────────────
async function loadTransactions(filter, btn) {
    // Update filter buttons
    if (btn) {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active-filter'));
        btn.classList.add('active-filter');
    }

    const tbody = document.getElementById('txn-tbody');
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:32px">
        <div class="skeleton" style="width:60%;margin:0 auto;height:12px;margin-bottom:8px"></div>
        <div class="skeleton" style="width:40%;margin:0 auto;height:12px"></div>
    </td></tr>`;

    try {
        const param = (!filter || filter === 'all') ? '' : `?filter=${filter}`;
        const data = await api('/transactions' + param);

        if (data.transactions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty-state">
                <div class="empty-state-icon">📋</div>
                <p>No transactions found</p>
            </td></tr>`;
            return;
        }

        tbody.innerHTML = data.transactions.map(t => {
            const isSent = t.type === 'sent';
            const amtClass = isSent ? 'amt-neg' : 'amt-pos';
            const date = new Date(t.time).toLocaleDateString('en-IN', {
                month: 'short', day: 'numeric', year: 'numeric'
            });
            const statusChip = t.is_flagged
                ? '<span class="chip chip-flag">⚠ Flagged</span>'
                : t.status === 'Blocked'
                    ? '<span class="chip chip-flag">✕ Blocked</span>'
                    : '<span class="chip chip-ok">✓ Clear</span>';
            const scoreColor = t.fraud_score >= 70
                ? 'var(--red)'
                : t.fraud_score >= 40
                    ? 'var(--amber)'
                    : 'var(--green)';

            return `<tr class="animate-in">
                <td>
                    <strong style="font-weight:500">${t.counterparty.name || 'Unknown'}</strong><br>
                    <span style="font-size:11.5px;color:var(--text-3)">${t.counterparty.email || ''}</span>
                </td>
                <td class="${amtClass}" style="font-weight:600">₹ ${t.amount.toLocaleString('en-IN')}</td>
                <td>${isSent ? 'Sent' : 'Received'}</td>
                <td style="color:var(--text-2)">${date}</td>
                <td><span style="font-weight:700;color:${scoreColor};font-family:var(--font-head)">${t.fraud_score}%</span></td>
                <td>${statusChip}</td>
            </tr>`;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--red);padding:20px">
            Failed to load transactions</td></tr>`;
    }
}

// ──────────────────────────────────────
// FRAUD ALERTS PAGE
// ──────────────────────────────────────
async function loadFraudAlerts() {
    const container = document.getElementById('fraud-alerts-container');
    container.innerHTML = '<div class="card"><div class="skeleton" style="height:80px"></div></div>';

    try {
        const data = await api('/fraud-alerts');
        const openCount = data.alerts.filter(a => a.status === 'Open').length;
        document.getElementById('fraud-subtitle').textContent =
            openCount > 0
                ? `${openCount} active alert(s) require your attention`
                : 'All alerts have been reviewed';

        if (data.alerts.length === 0) {
            container.innerHTML = `<div class="card">
                <div class="empty-state">
                    <div class="empty-state-icon">🛡️</div>
                    <p>No fraud alerts — everything looks clean!</p>
                </div>
            </div>`;
            return;
        }

        container.innerHTML = data.alerts.map(a => {
            const isCritical = a.severity === 'critical';
            const fillWidth = a.risk_score + '%';
            const barColor = isCritical ? 'var(--red)' : 'var(--amber)';
            const date = new Date(a.time).toLocaleString('en-IN', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            return `<div class="alert-card ${isCritical ? 'critical' : 'warning'} animate-in">
                <div class="alert-header">
                    <span class="alert-tag ${isCritical ? 'tag-critical' : 'tag-warning'}">
                        ${isCritical ? 'CRITICAL' : 'WARNING'}
                    </span>
                    <div class="alert-title">${a.type} — ${a.status}</div>
                </div>
                <div class="risk-meter">
                    <span style="font-size:12px;color:var(--text-2)">Risk</span>
                    <div class="risk-bar">
                        <div style="background:${barColor};width:${fillWidth}"></div>
                    </div>
                    <span class="risk-lbl" style="color:${barColor}">${a.risk_score}%</span>
                </div>
                <div class="alert-meta-grid">
                    <div class="meta-item">
                        <div class="meta-key">Amount</div>
                        <div class="meta-val" ${isCritical ? 'style="color:var(--red)"' : ''}>
                            ₹ ${a.transaction.amount.toLocaleString('en-IN')}
                        </div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-key">Receiver</div>
                        <div class="meta-val">${a.transaction.receiver_name || 'Unknown'}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-key">Alert Type</div>
                        <div class="meta-val">${a.type}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-key">Time</div>
                        <div class="meta-val">${date}</div>
                    </div>
                </div>
                <div class="alert-actions">
                    ${a.status === 'Open' ? `
                        <button class="btn-red" onclick="resolveAlert('${a.alert_id}','block')">Block Transaction</button>
                        <button class="btn-ghost" onclick="resolveAlert('${a.alert_id}','safe')">Mark Safe</button>
                    ` : `
                        <span class="chip ${a.status === 'Closed' ? 'chip-ok' : 'chip-warn'}">${a.status}</span>
                    `}
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        container.innerHTML = '<p style="color:var(--red)">Failed to load alerts</p>';
    }
}

async function resolveAlert(alertId, action) {
    try {
        await api(`/fraud-alerts/${alertId}/resolve`, {
            method: 'POST',
            body: JSON.stringify({ action })
        });
        showToast(
            action === 'block' ? 'Transaction blocked' : 'Alert marked safe',
            action === 'block' ? 'error' : 'success'
        );
        loadFraudAlerts();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ──────────────────────────────────────
// ADD MONEY
// ──────────────────────────────────────
function showAddMoneyModal() {
    document.getElementById('add-money-modal').classList.add('show');
    document.getElementById('add-money-amount').focus();
}
function closeAddMoneyModal() {
    document.getElementById('add-money-modal').classList.remove('show');
}

async function doAddMoney() {
    const amount = parseFloat(document.getElementById('add-money-amount').value);
    if (!amount || amount <= 0) return showToast('Enter a valid amount', 'error');

    try {
        const result = await api('/add-money', {
            method: 'POST',
            body: JSON.stringify({ amount })
        });
        showToast(result.message, 'success');
        closeAddMoneyModal();
        document.getElementById('add-money-amount').value = '';
        loadDashboard();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ──────────────────────────────────────
// PROFILE
// ──────────────────────────────────────
function loadProfile() {
    if (!currentUser) return;
    const initial = (currentUser.Name || '?')[0].toUpperCase();
    document.getElementById('profile-avatar').textContent = initial;
    document.getElementById('profile-name').textContent = currentUser.Name;
    document.getElementById('profile-email').textContent = currentUser.Email;
    document.getElementById('profile-balance').textContent =
        '₹' + Number(currentUser.Balance).toLocaleString('en-IN');
    document.getElementById('profile-name-input').value = currentUser.Name;
    document.getElementById('profile-email-input').value = currentUser.Email;
}
