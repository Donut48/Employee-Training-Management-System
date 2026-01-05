// Logs Management Module
const LogsManager = (() => {
    // State management
    const state = {
        adminLogs: [],
        requestLogs: [],
        currentLogs: [],
        filteredLogs: [],
        currentPage: 1,
        itemsPerPage: 15,
        currentLogType: 'admin' // 'admin' or 'requests'
    };

    // DOM elements
    const elements = {
        table: document.getElementById('logTable'),
        search: document.getElementById('logSearch'),
        prevPage: document.getElementById('prevPage'),
        nextPage: document.getElementById('nextPage'),
        pageInfo: document.getElementById('pageInfo'),
        logTypeBtns: document.querySelectorAll('.log-type-btn')
    };

    // Initialize the application
    async function init() {
        try {
            await fetchAllLogs();
            renderTableHeaders();
            switchLogType('admin');
            setupEventListeners();
        } catch (error) {
            console.error('Initialization error:', error);
            showError(`Failed to initialize: ${error.message}`);
        }
    }

    // Fetch all logs from API
    async function fetchAllLogs() {
        try {
            const [adminResponse, requestResponse] = await Promise.all([
                fetch('/api/admin-logs'),
                fetch('/api/request-logs')
            ]);

            if (!adminResponse.ok || !requestResponse.ok) {
                throw new Error('Failed to fetch logs');
            }

            const [adminData, requestData] = await Promise.all([
                adminResponse.json(),
                requestResponse.json()
            ]);

            state.adminLogs = adminData.success ? adminData.logs : [];
            state.requestLogs = requestData.success ? requestData.logs : [];

            console.log('Fetched logs:', {
                adminLogs: state.adminLogs,
                requestLogs: state.requestLogs
            });

        } catch (error) {
            console.error('Error fetching logs:', error);
            state.adminLogs = [];
            state.requestLogs = [];
            throw error;
        }
    }

    // Switch between log types
    function switchLogType(type) {
        state.currentLogType = type;
        state.currentLogs = type === 'admin' ? [...state.adminLogs] : [...state.requestLogs];
        state.currentPage = 1;

        // Update active button
        elements.logTypeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        renderTableHeaders();
        filterLogs();
    }

    // Filter logs based on search term
    function filterLogs() {
        const searchTerm = elements.search.value.toLowerCase();

        if (!searchTerm) {
            state.filteredLogs = [...state.currentLogs];
        } else {
            state.filteredLogs = state.currentLogs.filter(log => {
                return (
                    (log.timestamp && log.timestamp.toLowerCase().includes(searchTerm)) ||
                    (log.admin && log.admin.toLowerCase().includes(searchTerm)) ||
                    (log.user && log.user.toLowerCase().includes(searchTerm)) ||
                    (log.action && log.action.toLowerCase().includes(searchTerm)) ||
                    (log.request && log.request.toLowerCase().includes(searchTerm)) ||
                    (log.details && log.details.toLowerCase().includes(searchTerm))
                );
            });
        }

        state.currentPage = 1;
        renderTable();
    }

    function renderTableHeaders() {
        const thead = document.querySelector('thead');
        if (!thead) return;

        if (state.currentLogType === 'admin') {
            thead.innerHTML = `
                <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                </tr>
            `;
        } else {
            thead.innerHTML = `
                <tr>
                    <th>Timestamp</th>
                    <th>Admin</th>
                    <th>Action</th>
                    <th>Employee</th>
                    <th>Request Type</th>
                    <th>Details</th>
                </tr>
            `;
        }
    }

    // Render table with paginated logs
    function renderTable() {
        if (!elements.table) return;

        const tbody = elements.table.querySelector('tbody');
        if (!tbody) {
            console.error('Table body not found! Check your HTML structure');
            return;
        }


        const start = (state.currentPage - 1) * state.itemsPerPage;
        const paginatedLogs = state.filteredLogs.slice(start, start + state.itemsPerPage);

        tbody.innerHTML = paginatedLogs.length ? '' : '<tr><td colspan="4">No logs found</td></tr>';

        paginatedLogs.forEach(log => {
            const row = document.createElement('tr');

            if (state.currentLogType === 'admin') {
                row.innerHTML = `
                    <td>${new Date(log.timestamp).toLocaleString() || 'N/A'}</td>
                    <td>${log.admin || 'System'}</td>
                    <td>${log.action ? log.action.charAt(0).toUpperCase() + log.action.slice(1) : 'No action'}</td>
                `;
            } else {
                row.innerHTML = `
                    <td>${new Date(log.timestamp).toLocaleString()}</td>
                    <td>${log.admin || 'System'}</td>
                    <td class="action-${log.action ? log.action.toLowerCase() : 'unknown'}">
                        ${log.action ? log.action.charAt(0).toUpperCase() + log.action.slice(1) : 'Unknown'}
                    </td>
                    <td>${log.employee_id || 'N/A'}</td>
                    <td>${log.request_type || 'Unknown'}</td>
                    <td>${log.details || 'No details'}</td>
                `;
            }

            tbody.appendChild(row);
        });

        updatePagination();
    }

    // Update pagination controls
    function updatePagination() {
        if (!elements.pageInfo) return;

        const totalPages = Math.ceil(state.filteredLogs.length / state.itemsPerPage) || 1;
        elements.pageInfo.textContent = `Page ${state.currentPage} of ${totalPages}`;

        if (elements.prevPage) {
            elements.prevPage.disabled = state.currentPage === 1;
        }
        if (elements.nextPage) {
            elements.nextPage.disabled = state.currentPage === totalPages || totalPages === 0;
        }
    }

    // Change page
    function changePage(pageChange) {
        const newPage = state.currentPage + pageChange;
        const totalPages = Math.ceil(state.filteredLogs.length / state.itemsPerPage);

        if (newPage > 0 && newPage <= totalPages) {
            state.currentPage = newPage;
            renderTable();
        }
    }

    // Show error notification
    function showError(message) {
        // ... (keep your existing error handling code)
    }

    // Set up event listeners
    function setupEventListeners() {
        // Search input
        if (elements.search) {
            elements.search.addEventListener('input', filterLogs);
        }

        // Pagination
        if (elements.prevPage) {
            elements.prevPage.addEventListener('click', () => changePage(-1));
        }

        if (elements.nextPage) {
            elements.nextPage.addEventListener('click', () => changePage(1));
        }

        // Log type toggle buttons
        elements.logTypeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                switchLogType(btn.dataset.type);
            });
        });
    }

    // Public API
    return {
        init
    };
})();

function initLogRefresh() {
    // First load immediately
    refreshLogs();

    // Then set up periodic refresh
    const refreshInterval = setInterval(async () => {
        try {
            await refreshLogs();
        } catch (error) {
            console.error('Auto-refresh failed:', error);
            // Optional: clearInterval(refreshInterval) if errors persist
        }
    }, 30000); // 30 seconds

    return refreshInterval;
}

async function refreshLogs() {
    try {
        await fetchAllLogs();
        renderTable();
    } catch (error) {
        console.error('Error refreshing logs:', error);
        console.error('Error refreshing logs:', error);
        showErrorToUser('Failed to refresh logs. Please try again.');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    LogsManager.init();
    const intervalId = initLogRefresh();
    window.addEventListener('beforeunload', () => {
        clearInterval(intervalId);
    });
});