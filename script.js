// State Management
let state = {
    members: JSON.parse(localStorage.getItem('jamath_members')) || [],
    filter: 'all', // all, paid, unpaid
    currency: 'AED', // AED, INR
    exchangeRate: 23 // 1 AED = 23 INR
};

let currentEditId = null;

// DOM Elements
const memberListEl = document.getElementById('member-list');
const totalCollectedEl = document.getElementById('total-collected');
const totalPendingEl = document.getElementById('total-pending');
const statsMembersEl = document.getElementById('stats-members');
const filterSelect = document.getElementById('filter-select');
const modalTitleEl = document.getElementById('modal-title');
const currencyLabelEl = document.getElementById('currency-label');
const inputCurrencyLabel = document.getElementById('input-currency-label');

// Initialization
function init() {
    renderApp();
}

function saveState() {
    localStorage.setItem('jamath_members', JSON.stringify(state.members));
    renderApp();
}

// Currency Logic
function toggleCurrency() {
    state.currency = state.currency === 'AED' ? 'INR' : 'AED';
    renderApp();
}

function getDisplayAmount(amountInAED) {
    if (state.currency === 'INR') {
        return Math.round(amountInAED * state.exchangeRate);
    }
    return amountInAED;
}

function formatCurrency(amount) {
    return amount.toLocaleString();
}

// Rendering
function renderApp() {
    // 0. Update UI for Currency
    const currencyCode = state.currency;
    currencyLabelEl.textContent = currencyCode;
    inputCurrencyLabel.textContent = 'AED'; // Input is always AED for now

    document.getElementById('total-c-code').textContent = currencyCode;
    document.getElementById('total-p-code').textContent = currencyCode;

    // 1. Calculate Stats
    let totalCollected = 0;
    let totalPending = 0;
    let paidCount = 0;

    state.members.forEach(m => {
        if (m.paid) {
            totalCollected += m.amount; // Store in AED
            paidCount++;
        } else {
            totalPending += m.amount; // Store in AED
        }
    });

    // Display Totals (converted if needed)
    totalCollectedEl.textContent = formatCurrency(getDisplayAmount(totalCollected));
    totalPendingEl.textContent = formatCurrency(getDisplayAmount(totalPending));
    statsMembersEl.textContent = `${paidCount}/${state.members.length}`;

    // 2. Filter List
    const filter = filterSelect.value;
    let displayMembers = state.members.slice().sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by Date Descending

    if (filter === 'paid') displayMembers = displayMembers.filter(m => m.paid);
    if (filter === 'unpaid') displayMembers = displayMembers.filter(m => !m.paid);

    // 3. Render List
    memberListEl.innerHTML = '';

    if (displayMembers.length === 0) {
        memberListEl.innerHTML = '<div class="empty-state">No members found.</div>';
        return;
    }

    displayMembers.forEach((member, index) => {
        const displayAmount = getDisplayAmount(member.amount);
        const card = document.createElement('div');
        card.className = `member-card ${member.paid ? 'paid' : ''}`;

        // Stagger animation
        card.style.animation = `fadeIn 0.3s ease forwards ${index * 0.05}s`;
        card.style.opacity = '0'; // Initial state for animation

        card.innerHTML = `
            <div class="card-left">
                <div class="card-header">
                    <h4>${member.name}</h4>
                    <span class="card-date">${formatDate(member.date)}</span>
                </div>
                <div class="card-amount-wrapper">
                    <span class="currency-symbol-small">${currencyCode}</span>
                    <span class="amount-display">${formatCurrency(displayAmount)}</span>
                </div>
            </div>
            
            <div class="card-actions">
                <button class="status-btn ${member.paid ? 'paid' : 'unpaid'}" 
                    onclick="toggleStatus(${member.id})">
                    ${member.paid ? 'PAID' : 'PAY'}
                </button>
                <div class="icon-actions">
                    <button class="btn-icon edit" onclick="openEditModal(${member.id})" aria-label="Edit">
                        ✏️
                    </button>
                    <button class="btn-icon delete" onclick="deleteMember(${member.id})" aria-label="Delete">
                        🗑️
                    </button>
                </div>
            </div>
        `;
        memberListEl.appendChild(card);
    });

    // Add keyframes if not exists (simple way)
    if (!document.getElementById('anim-styles')) {
        const style = document.createElement('style');
        style.id = 'anim-styles';
        style.innerHTML = `
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }
}

// Actions
function openEditModal(id) {
    const member = state.members.find(m => m.id === id);
    if (!member) return;

    currentEditId = id;
    document.getElementById('new-member-name').value = member.name;
    document.getElementById('new-member-amount').value = member.amount;

    // Format date for input (YYYY-MM-DD)
    // member.date might be ISO string
    const d = new Date(member.date);
    const dateStr = d.toISOString().split('T')[0];
    document.getElementById('new-member-date').value = dateStr;

    if (modalTitleEl) modalTitleEl.textContent = 'Edit Member';

    openModal('addMemberModal');
}

function addNewMember() {
    const nameInput = document.getElementById('new-member-name');
    const amountInput = document.getElementById('new-member-amount');
    const dateInput = document.getElementById('new-member-date');

    const name = nameInput.value.trim();
    const amount = parseInt(amountInput.value) || 200;
    const dateVal = dateInput.value; // YYYY-MM-DD

    if (!name) return alert('Please enter a name');

    // Use selected date or today
    const selectedDate = dateVal ? new Date(dateVal) : new Date();
    // Ensure we keep the time if editing, or set to now if new? 
    // For simplicity, just use the date part or set time to noon to avoid timezone issues
    if (dateVal) {
        selectedDate.setHours(12, 0, 0, 0);
    }

    if (currentEditId) {
        // Edit Mode
        const member = state.members.find(m => m.id === currentEditId);
        if (member) {
            member.name = name;
            member.amount = amount;
            member.date = selectedDate.toISOString();
            saveState();
        }
    } else {
        // Add Mode
        const newMember = {
            id: Date.now(),
            name: name,
            amount: amount, // Stored in AED
            paid: false,
            date: selectedDate.toISOString()
        };
        state.members.push(newMember);
        saveState();
    }

    closeMemberModal();
}

function processImport() {
    const textInfo = document.getElementById('import-text').value;
    if (!textInfo.trim()) return;

    const names = textInfo.split(/\n|,/); // Split by newline or comma
    let count = 0;

    names.forEach(n => {
        const cleanName = n.trim();
        if (cleanName) {
            state.members.push({
                id: Date.now() + Math.random(), // Unique ID
                name: cleanName,
                amount: 200,
                paid: false,
                date: new Date().toISOString()
            });
            count++;
        }
    });

    saveState();
    closeModal('importModal');
    document.getElementById('import-text').value = '';
    alert(`Imported ${count} members.`);
}

function toggleStatus(id) {
    const member = state.members.find(m => m.id === id);
    if (member) {
        member.paid = !member.paid;
        saveState();
    }
}

function deleteMember(id) {
    if (confirm('Delete this member?')) {
        state.members = state.members.filter(m => m.id !== id);
        saveState();
    }
}

function exportWhatsApp() {
    let text = "*Jamath Collection Report*\n";
    text += `_Currency: ${state.currency}_\n\n`;

    let paidTotal = 0;

    // Paid Members
    text += "*✅ PAID:*\n";
    state.members.filter(m => m.paid).forEach((m, i) => {
        const displayAmt = getDisplayAmount(m.amount);
        text += `${i + 1}. ${m.name} - ${displayAmt}\n`;
        paidTotal += displayAmt;
    });

    // Pending Members
    text += "\n*❌ PENDING:*\n";
    let pendingTotal = 0;
    state.members.filter(m => !m.paid).forEach((m, i) => {
        const displayAmt = getDisplayAmount(m.amount);
        text += `${i + 1}. ${m.name} - ${displayAmt}\n`;
        pendingTotal += displayAmt;
    });

    text += `\n----------------\n`;
    text += `*Total Collected: ${state.currency} ${formatCurrency(paidTotal)}*\n`;
    text += `*Pending Amount: ${state.currency} ${formatCurrency(pendingTotal)}*\n`;
    text += `*Total Expected: ${state.currency} ${formatCurrency(paidTotal + pendingTotal)}*`;

    navigator.clipboard.writeText(text).then(() => {
        alert("Report copied to clipboard! Open WhatsApp and paste.");
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert("Failed to copy automatically. Please try valid permissions.");
    });
}

function exportCSV() {
    let csv = "S.No,Name,Amount (AED),Display Amount,Currency,Status,Date\n";
    state.members.forEach((m, i) => {
        const dateStr = new Date(m.date).toLocaleDateString();
        const status = m.paid ? "Paid" : "Pending";
        const displayAmt = getDisplayAmount(m.amount);
        csv += `${i + 1},"${m.name}",${m.amount},${displayAmt},${state.currency},${status},${dateStr}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jamath_collection_${new Date().toLocaleDateString()}.csv`;
    a.click();
}

// Helpers
function formatDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function openModal(id) {
    // If opening Add Modal directly (via button), reset state
    if (id === 'addMemberModal' && !currentEditId) {
        document.getElementById('new-member-name').value = '';
        document.getElementById('new-member-amount').value = '200';

        // Default date: Today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('new-member-date').value = today;

        if (modalTitleEl) modalTitleEl.textContent = 'Add New Member';
    }

    // Remove hidden class
    const modal = document.getElementById(id);
    modal.classList.remove('hidden');

    // Trigger animation frame for transition
    requestAnimationFrame(() => {
        modal.classList.remove('hidden');
        // We handle actual opacity in CSS with :not(.hidden)
    });
}

function closeMemberModal() {
    currentEditId = null;
    document.getElementById('new-member-name').value = '';
    closeModal('addMemberModal');
}

function closeModal(id) {
    if (id === 'addMemberModal') {
        currentEditId = null;
    }
    const modal = document.getElementById(id);
    modal.classList.add('hidden');
}

// Run
init();
