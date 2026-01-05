let processModal;  // Bootstrap modal instance
let currentRequest = null;

const RequestManager = (() => {
    // -------------------------
    // State management
    // -------------------------
    const isEmployee = document.body.dataset.isEmployee === 'true';
    const isAdmin = document.body.dataset.isAdmin === 'true';
    const userId = document.body.dataset.userId;
    const state = {
        requests: [],
        filteredRequests: [],
        stats: {
            total: 0,
            highestPriority: null,
            oldestRequest: null
        },
        session: {
            isEmployee: false,
            userId: null
        }
    };

    // -------------------------
    // DOM elements
    // -------------------------
    const elements = {
        form: document.getElementById('requestForm'),
        processBtn: document.getElementById('processNextBtn'),
        nextRequestInfo: document.getElementById('nextRequestInfo'),
        refreshBtn: document.getElementById('refreshBtn'),
        typeFilter: document.getElementById('filterType'),
        priorityFilter: document.getElementById('filterPriority'),
        table: document.getElementById('requestsTable'),
        stats: {
            total: document.getElementById('totalRequests'),
            highestPriority: document.getElementById('highestPriority'),
            oldestRequest: document.getElementById('oldestRequest'),
            nextRequest: document.getElementById('nextRequestInfo')
        },
        priorityStatsTable: document.getElementById('priorityStatsTable'),
        typeStatsTable: document.getElementById('typeStatsTable')
    };

    // -------------------------
    // Initialization
    // -------------------------
    async function init() {
        try {
            const sessionRes = await fetch('/api/check_session');
            const sessionData = await sessionRes.json();

            // Save session info
            state.session.isEmployee = sessionData.is_employee;
            state.session.userId = sessionData.user_id;

            processModal = new bootstrap.Modal(document.getElementById('processRequestModal'));

            // Auto-fill employee ID for employees
            if (state.session.isEmployee && elements.form) {
                const employeeIdField = document.getElementById('employeeId');
                employeeIdField.value = state.session.userId;
                employeeIdField.readOnly = true;
                employeeIdField.classList.add('disabled-field');
            }

            if (state.session.isEmployee) {
                // Employee view
                document.getElementById('addRequestSection').style.display = 'block';
                document.getElementById('statsSection').style.display = 'none';
                document.getElementById('statsToggleSection').style.display = 'none';
                document.getElementById('processNextSection').style.display = 'none';
            } else {
                // Admin view
                document.getElementById('addRequestSection').style.display = 'none';
                document.getElementById('statsSection').style.display = '';
                document.getElementById('statsToggleSection').style.display = 'block';
                document.getElementById('processNextSection').style.display = 'block';
            }
            document.getElementById('approveBtn').onclick = () => handleAction('approve');
            document.getElementById('denyBtn').onclick = () => handleAction('deny');
            document.getElementById('returnBtn').onclick = () => handleAction('return');
            document.querySelector('#processRequestModal .btn-close').onclick = () => {
                currentRequest = null;
                processModal.hide();
            };

            setupEventListeners();
            await refreshQueue();
        } catch (error) {
            console.error('Initialization error:', error);
        }
    }

    // -------------------------
    // Event listeners
    // -------------------------
    function setupEventListeners() {
        if (elements.form) {
            elements.form.addEventListener('submit', async e => {
                e.preventDefault();
                await addRequest();
            });
        }

        if (elements.processBtn) {
            elements.processBtn.addEventListener('click', processNextRequest);
        }

        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener('click', refreshQueue);
        }

        if (elements.typeFilter) elements.typeFilter.addEventListener('change', refreshQueue);
        if (elements.priorityFilter) elements.priorityFilter.addEventListener('change', refreshQueue);

        document.addEventListener('click', async e => {
            if (e.target.classList.contains('btn-approve')) {
                await processRequest(e.target.dataset.requestId, 'approve');
                showNextRequest();
            }
            if (e.target.classList.contains('btn-deny')) {
                await processRequest(e.target.dataset.requestId, 'deny');
                showNextRequest();
            }
            if (e.target.classList.contains('btn-return')) {
                await processRequest(e.target.dataset.requestId, 'return');
                showNextRequest();
            }
        });

        document.getElementById('priorityBtn').addEventListener('click', () => {
            elements.priorityStatsTable.style.display = 'block';
            elements.typeStatsTable.style.display = 'none';
            updatePriorityStats();
        });

        document.getElementById('typeBtn').addEventListener('click', () => {
            elements.typeStatsTable.style.display = 'block';
            elements.priorityStatsTable.style.display = 'none';
            updateTypeStats();
        });
    }

    // -------------------------
    // API / Request functions
    // -------------------------
    async function hasPendingRequests(employeeId) {
        try {
            const res = await fetch(`/api/requests?employee_id=${employeeId}&status=pending`);
            const data = await res.json();
            return data.requests?.length > 0;
        } catch (error) {
            console.error('Error checking pending requests:', error);
            return false;
        }
    }

    async function addRequest() {
        try {
            const formData = getFormData();
            const pending = await hasPendingRequests(formData.employeeId);

            if (pending && !window.confirm("You currently have a request pending. Continue?")) {
                return;
            }

            const res = await fetch('/api/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employee_id: formData.employeeId,
                    request_type: formData.requestType,
                    priority: formData.priority,
                    details: formData.details
                })
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Submission failed');

            showSuccess('Request added!');
            elements.form.reset();
            await refreshQueue();
        } catch (error) {
            console.error(error);
            showError(error.message);
        }
    }

    async function processRequest(requestId, action) {
        try {
            const res = await fetch(`/api/requests/${requestId}/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Action failed');

            await refreshQueue();
            showSuccess(`Request ${action}d successfully`);
        } catch (error) {
            console.error(error);
            showError(error.message);
        }
    }

    async function processNextRequest() {
        if (state.requests.length === 0) {
            showError('No pending requests.');
            return;
        }

        const next = state.requests.reduce((h, r) => {
            if (!h || r.priority < h.priority) return r;
            if (r.priority === h.priority && new Date(r.timestamp) < new Date(h.timestamp)) return r;
            return h;
        }, null);

        if (!next) return;

        const modalContent = document.getElementById('requestDetails');
        modalContent.innerHTML = `
            <p><strong>Employee:</strong> ${next.employee_id}</p>
            <p><strong>Type:</strong> ${next.request_type}</p>
            <p><strong>Priority:</strong> ${next.priority}</p>
            <p><strong>Details:</strong> ${next.details}</p>
            <p><strong>Timestamp:</strong> ${new Date(next.timestamp).toLocaleString()}</p>
        `;

        currentRequest = nextRequest;
        processModal.show();
    }

    function getFormData() {
        return {
            employeeId: document.getElementById('employeeId').value.trim(),
            requestType: document.getElementById('requestType').value,
            priority: document.getElementById('priority').value,
            details: document.getElementById('details').value.trim()
        };
    }

    // -------------------------
    // Refresh queue and stats
    // -------------------------
    async function refreshQueue() {
        try {
            const filterType = elements.typeFilter?.value;
            const filterPriority = elements.priorityFilter?.value;

            let query = `?_=${Date.now()}`;
            if (filterType) query += `&type=${filterType}`;
            if (filterPriority) query += `&priority=${filterPriority}`;

            const res = await fetch(`/api/requests${query}`);
            const data = await res.json();
            if (!data.success) return;

            if (isEmployee) {
                state.requests = state.requests.filter(r => r.employee_id === userId && r.status === 'pending');
            } else if (isAdmin) {
                // Admin sees all requests
                state.requests = data.requests;
            }

            let requests = data.requests.filter(r => r.status === 'pending');
            if (filterType) requests = requests.filter(r => r.request_type === filterType);
            if (filterPriority) requests = requests.filter(r => r.priority == filterPriority);

            state.requests = requests;
            state.filteredRequests = [...requests];

            renderTable();
            updateStats();
            updateNextRequestInfo();
            updatePriorityStats();
            updateTypeStats();
        } catch (error) {
            console.error(error);
            showError('Failed to refresh queue');
        }
    }

    function updateProcessButton() {
        if (!state.session.isEmployee) {
            const pendingRequests = state.requests.filter(r => r.status === 'pending');

            if (pendingRequests.length === 0) {
                elements.processBtn.disabled = true;
                elements.nextRequestInfo.textContent = 'No requests in queue';
                return;
            }

            // Find highest priority pending request
            const highestPriority = Math.min(...pendingRequests.map(r => parseInt(r.priority)));
            const highestRequests = pendingRequests.filter(r => parseInt(r.priority) === highestPriority);

            elements.nextRequestInfo.innerHTML = `<strong>Next request:</strong> Priority ${highestPriority} (${highestRequests.length} waiting)`;
            elements.processBtn.disabled = false;
        }
    }

    // Process next request click
    elements.processBtn?.addEventListener('click', () => {
        const pendingRequests = state.requests.filter(r => r.status === 'pending');
        if (pendingRequests.length === 0) return;

        const highestPriority = Math.min(...pendingRequests.map(r => parseInt(r.priority)));
        const nextRequest = pendingRequests.find(r => parseInt(r.priority) === highestPriority);

        if (nextRequest) {
            // Open modal and populate details
            document.getElementById('requestDetails').textContent = `
                Employee: ${nextRequest.employee_id}
                Type: ${nextRequest.request_type}
                Priority: ${nextRequest.priority}
                Details: ${nextRequest.details}
            `;
            const modal = new bootstrap.Modal(document.getElementById('processRequestModal'));
            modal.show();

            // Optionally, attach approve/deny/return buttons
            document.getElementById('approveBtn').onclick = () => processRequest(nextRequest.id, 'approve');
            document.getElementById('denyBtn').onclick = () => processRequest(nextRequest.id, 'deny');
            document.getElementById('returnBtn').onclick = () => processRequest(nextRequest.id, 'return');
        }
    });
    function showNextRequest() {
        const pendingRequests = state.requests.filter(r => r.status === 'pending');
        if (pendingRequests.length === 0) {
            elements.nextRequestInfo.textContent = 'No requests in queue';
            elements.processBtn.disabled = true;
            currentRequest = null;
            processModal.hide();
            return;
        }

        const highestPriority = Math.min(...pendingRequests.map(r => parseInt(r.priority)));
        currentRequest = pendingRequests.find(r => parseInt(r.priority) === highestPriority);

        // Update info
        elements.nextRequestInfo.innerHTML = `<strong>Next request:</strong> Priority ${highestPriority} (${pendingRequests.filter(r => parseInt(r.priority) === highestPriority).length} waiting)`;

        // Populate modal
        document.getElementById('requestDetails').innerHTML = `
            <p><strong>Employee:</strong> ${currentRequest.employee_id}</p>
            <p><strong>Type:</strong> ${currentRequest.request_type}</p>
            <p><strong>Priority:</strong> ${currentRequest.priority}</p>
            <p><strong>Details:</strong> ${currentRequest.details}</p>
            <p><strong>Timestamp:</strong> ${new Date(currentRequest.timestamp).toLocaleString()}</p>
        `;

        processModal.show();
    }

    function handleAction(action) {
        if (!currentRequest) return;
        processRequest(currentRequest.id, action).then(() => {
            refreshQueue().then(() => {
                showNextRequest();
            });
        });
    }


    function updateStats() {
        const total = state.requests.length;
        elements.stats.total.textContent = total;

        const highest = state.requests.reduce((h, r) => !h || r.priority < h.priority ? r : h, null);
        elements.stats.highestPriority.textContent = highest ? `Priority: ${highest.priority}` : 'None';

        const oldest = state.requests.reduce((o, r) => !o || new Date(r.timestamp) < new Date(o.timestamp) ? r : o, null);
        elements.stats.oldestRequest.textContent = oldest ? new Date(oldest.timestamp).toLocaleString() : 'None';
    }

    function updateNextRequestInfo() {
        if (state.requests.length === 0) {
            elements.stats.nextRequest.textContent = 'No requests in queue';
            return;
        }

        const next = state.requests.reduce((h, r) => {
            if (!h || r.priority < h.priority) return r;
            if (r.priority === h.priority && new Date(r.timestamp) < new Date(h.timestamp)) return r;
            return h;
        }, null);

        elements.stats.nextRequest.textContent = `Next: Employee ${next.employee_id}, Priority ${next.priority}`;
    }

    function updatePriorityStats() {
        const tbody = elements.priorityStatsTable.querySelector('tbody');
        tbody.innerHTML = '';
        const counts = state.requests.reduce((acc, r) => {
            acc[r.priority] = (acc[r.priority] || 0) + 1;
            return acc;
        }, {});
        Object.keys(counts).sort((a,b)=>a-b).forEach(p => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${p}</td><td>${counts[p]}</td>`;
            tbody.appendChild(row);
        });
    }

    function updateTypeStats() {
        const tbody = elements.typeStatsTable.querySelector('tbody');
        tbody.innerHTML = '';
        const counts = state.requests.reduce((acc, r) => {
            acc[r.request_type] = (acc[r.request_type] || 0) + 1;
            return acc;
        }, {});
        Object.keys(counts).forEach(t => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${t}</td><td>${counts[t]}</td>`;
            tbody.appendChild(row);
        });
    }

    function renderTable() {
        const tbody = document.querySelector('#requestsTable tbody');
        tbody.innerHTML = '';

        // Filter requests depending on user type
        let requestsToShow = state.requests;
        if (state.session.isEmployee) {
            // Employee sees only their own pending requests
            requestsToShow = state.requests.filter(
                r => r.employee_id === state.session.userId && r.status === 'pending'
            );
        }

        requestsToShow.forEach(request => {
            const row = document.createElement('tr');
            row.dataset.requestId = request.id;

            let actionButtons = '';
            if (!state.session.isEmployee) {
                if (request.status === 'pending') {
                    actionButtons = `
                        <button class="btn btn-sm btn-success btn-approve" data-request-id="${request.id}">Approve</button>
                        <button class="btn btn-sm btn-danger btn-deny" data-request-id="${request.id}">Deny</button>
                        <button class="btn btn-sm btn-warning btn-return" data-request-id="${request.id}">Return</button>
                    `;
                } else {
                    actionButtons = `<span class="badge bg-${request.status === 'approved' ? 'success' : 'danger'}">
                                        ${request.status.toUpperCase()}
                                     </span>`;
                }
            }

            row.innerHTML = `
                <td>${request.employee_id}</td>
                <td>${request.request_type}</td>
                <td>${request.priority}</td>
                <td>${request.details}</td>
                <td>${new Date(request.timestamp).toLocaleString()}</td>
                <td class="text-center">${actionButtons}</td>
            `;
            tbody.appendChild(row);
        });
    }

    // -------------------------
    // Notifications
    // -------------------------
    function showSuccess(msg){ alert(msg); }
    function showError(msg){ alert(msg); }

    // -------------------------
    // Public API
    // -------------------------
    return { init, processRequest };
})();

// Initialize
document.addEventListener('DOMContentLoaded', () => RequestManager.init());
