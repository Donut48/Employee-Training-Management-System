// Employee Management Module
const EmployeeManager = (() => {
    // State management
    const state = {
        employees: [],
        filteredEmployees: [],
        departments: new Set(),
        programmes: new Set(),
        currentPage: 1,
        itemsPerPage: 10,
        selectedEmployee: null
    };

    // DOM elements
    const elements = {
        table: document.getElementById('employeeTable'),
        search: document.getElementById('employeeSearch'),
        deptFilter: document.getElementById('departmentFilter'),
        statusFilter: document.getElementById('statusFilter'),
        addBtn: document.getElementById('addEmployeeBtn'),
        modal: document.getElementById('employeeModal'),
        programmeModal: document.getElementById('programmeModal'),
        prevPage: document.getElementById('prevPage'),
        nextPage: document.getElementById('nextPage'),
        form: document.getElementById('employeeForm'),
        pageInfo: document.getElementById('pageInfo')
    };

    // Fetch data from API
    async function fetchData() {
        const response = await fetch('/api/employee-data');
        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        if (data.error) throw new Error(data.message);

        // Transform and store data
        state.employees = transformEmployeeData(data.employees);
        extractUniqueValues();
    }

    // Transform API data to consistent format
    function transformEmployeeData(employees) {
        return Object.values(employees).map(emp => ({
            id: String(emp.id || emp.ID),
            name: emp.name || '',
            email: emp.email || '',
            department: emp.department || '',
            programmes: Array.isArray(emp.programmes) ?
                emp.programmes.filter(p => p) :
                [emp.programmes].filter(p => p),
            status: Boolean(emp.status),
            statusText: emp.status ? 'Full-time' : 'Part-time'
        }));
    }

    // Extract unique departments and programmes
    function extractUniqueValues() {
        state.departments = new Set(
            state.employees.map(e => e.department).filter(Boolean)
        );
        state.programmes = new Set(
            state.employees.flatMap(e => e.programmes).filter(Boolean)
        );
    }

    // Render filter dropdowns
    function renderFilters() {
        renderDepartmentFilter();
        renderProgrammeCheckboxes();
    }

    function renderDepartmentFilter() {
        if (!elements.deptFilter) return;
        elements.deptFilter.innerHTML = '<option value="">All Departments</option>';
        state.departments.forEach(dept => {
            elements.deptFilter.innerHTML += `<option value="${dept}">${dept}</option>`;
        });
    }

    function renderProgrammeCheckboxes() {
        const container = document.getElementById('programmeCheckboxes');
        if (!container) return;

        container.innerHTML = '';
        state.programmes.forEach(prog => {
            container.innerHTML += `
                <label>
                    <input type="checkbox" name="programmes" value="${prog}"> ${prog}
                </label>
            `;
        });
    }

    // Filter and render table
    function renderTable() {
        applyFilters();
        renderTableRows();
        updatePagination();
    }

    function applyFilters() {
        const searchTerm = elements.search?.value.toLowerCase() || '';
        const deptFilter = elements.deptFilter?.value || '';
        const statusFilter = elements.statusFilter?.value || '';

        state.filteredEmployees = state.employees.filter(emp => {
            const matchesSearch =
                emp.id.toLowerCase().includes(searchTerm) ||
                emp.name.toLowerCase().includes(searchTerm) ||
                emp.email.toLowerCase().includes(searchTerm);

            const matchesDept = !deptFilter || emp.department === deptFilter;
            const matchesStatus = !statusFilter || emp.status.toString() === statusFilter;

            return matchesSearch && matchesDept && matchesStatus;
        });
    }

    function renderTableRows() {
        if (!elements.table) return;

        const tbody = elements.table.querySelector('tbody');
        if (!tbody) return;

        const start = (state.currentPage - 1) * state.itemsPerPage;
        const paginated = state.filteredEmployees.slice(start, start + state.itemsPerPage);

        tbody.innerHTML = paginated.length ? '' : '<tr><td colspan="7">No employees found</td></tr>';

        paginated.forEach(emp => {
            const row = document.createElement('tr');

            // Format programmes as bulleted list
            const programmesHTML = emp.programmes && emp.programmes.length
                ? `<ul style="margin: 0; padding-left: 20px; list-style-type: disc;">${
                    emp.programmes.map(prog => `<li>${prog}</li>`).join('')
                  }</ul>`
                : '';

            row.innerHTML = `
                <td>${emp.id}</td>
                <td>${emp.name}</td>
                <td>${emp.email}</td>
                <td>${emp.department || '-'}</td>
                <td>${programmesHTML}</td>
                <td style="white-space: nowrap;">${emp.statusText}</td>
                <td class="actions" style="white-space: nowrap; text-align: center; vertical-align: middle;">
                    <button class="btn-icon edit-btn" data-id="${emp.id}" style="margin: 0 2px;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete-btn" data-id="${emp.id}" style="margin: 0 2px;">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                    <button class="btn-icon programmes-btn" data-id="${emp.id}" style="margin: 0 2px;">
                        <i class="fas fa-tasks"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // Pagination functions
    function updatePagination() {
        if (!elements.pageInfo) return;

        const totalPages = Math.ceil(state.filteredEmployees.length / state.itemsPerPage) || 1;
        elements.pageInfo.textContent = `Page ${state.currentPage} of ${totalPages}`;

        if (elements.prevPage) {
            elements.prevPage.disabled = state.currentPage === 1;
        }
        if (elements.nextPage) {
            elements.nextPage.disabled = state.currentPage === totalPages || totalPages === 0;
        }
    }

    function goToPage(pageChange) {
        const newPage = state.currentPage + pageChange;
        const totalPages = Math.ceil(state.filteredEmployees.length / state.itemsPerPage);

        if (newPage > 0 && newPage <= totalPages) {
            state.currentPage = newPage;
            renderTable();
        }
    }

    // Modal functions
    function openModal(modalType, employeeId = null) {
        state.selectedEmployee = employeeId ?
            state.employees.find(e => e.id === employeeId) :
            null;

        const modal = document.getElementById(`${modalType}Modal`);
        if (modal) {
            // Set modal title
            document.getElementById('modalTitle').textContent =
                state.selectedEmployee ? 'Edit Employee' : 'Add New Employee';

            // Show/hide ID field
            const idField = document.getElementById('empId');
            if (idField) {
                if (state.selectedEmployee) {
                    idField.value = state.selectedEmployee.id;
                    idField.disabled = true;  // Disable editing for existing employees
                    idField.style.display = 'block';  // Show but make read-only
                } else {
                    idField.disabled = false;
                    idField.style.display = 'block';
                    idField.value = '';
                }
            }
            if (modalType === 'employee' && state.selectedEmployee) {
                populateEmployeeForm();
            }
            modal.style.display = 'block';
        }
    }

    function closeModal(modalType) {
        const modal = document.getElementById(`${modalType}Modal`);
        if (modal) modal.style.display = 'none';
    }

    function populateEmployeeForm() {
        if (!state.selectedEmployee || !elements.form) return;

        const emp = state.selectedEmployee;
        document.getElementById('empName').value = emp.name;
        document.getElementById('empEmail').value = emp.email;
        document.getElementById('empDept').value = emp.department || '';

        // Convert status to string for radio button comparison
        const statusValue = emp.status ? 'true' : 'false';
        document.querySelector(`input[name="empStatus"][value="${statusValue}"]`).checked = true;
    }

    // Real-time Email validation
    function setupEmailValidation() {
        const emailInput = document.getElementById('empEmail');
        if (!emailInput) return;

        emailInput.addEventListener('input', function(event) {
            const email = event.target.value.trim();
            const emptyError = document.getElementById('emailEmptyError');
            const existError = document.getElementById('emailExistError');
            const formatError = document.getElementById('emailFormatError');

            // Clear all states initially
            emailInput.classList.remove('is-invalid', 'is-valid');
            emptyError.style.display = 'none';
            existError.style.display = 'none';
            formatError.style.display = 'none';

            // Case 1: Empty field
            if (!email) {
                emailInput.classList.add('is-invalid');
                emptyError.style.display = 'block';
                return;
            }

            // Case 2: Check email format
            if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
                emailInput.classList.add('is-invalid');
                formatError.style.display = 'block';
                return;
            }

            // Case 3: Check email availability
            checkEmailAvailability(email).then(isAvailable => {
                if (isAvailable) {
                    emailInput.classList.add('is-valid');
                } else {
                    emailInput.classList.add('is-invalid');
                    existError.style.display = 'block';
                }
            });
        });
    }

    function debounce(func, wait) {
      let timeoutId;
      return function(...args) {
        const context = this;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          func.apply(context, args);
        }, wait);
      };
    }
    async function checkIdAvailability(id) {
        try {
            console.log(`Checking ID: ${id} (type: ${typeof id})`);
            const response = await fetch(`/api/check-employee-id?id=${id}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }

            const data = await response.json();
            console.log('Validation response:', data);

            if (typeof data.isUnique !== 'boolean') {
                throw new Error('Invalid server response format');
            }

            return data.isUnique;
        } catch (error) {
            console.error('Validation failed:', error);
            // Show error to user
            const errorElement = document.getElementById('idExistError');
            if (errorElement) {
                errorElement.textContent = 'Validation service unavailable';
                errorElement.style.display = 'block';
            }
            return false;
        }
    }


    async function checkEmailAvailability(email) {
        try {
            console.log(`Checking email: ${email}`);
            const response = await fetch(`/api/check-employee-email?email=${encodeURIComponent(email)}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }

            const data = await response.json();
            console.log('Email check response:', data);

            if (typeof data.isUnique !== 'boolean') {
                throw new Error('Invalid server response format');
            }

            return data.isUnique;
        } catch (error) {
            console.error('Email validation failed:', error);
            // Show error to user
            const errorElement = document.getElementById('emailError');
            if (errorElement) {
                errorElement.textContent = 'Validation service unavailable';
                errorElement.style.display = 'block';
            }
            return false;
        }
    }
    function setupIdValidation() {
        const idInput = document.getElementById('empId');
        if (!idInput) return;

        const validateId = debounce(async () => {
            const id = idInput.value.trim();
            const errorElement = document.getElementById('idExistError');

            // Reset state
            idInput.classList.remove('is-valid', 'is-invalid');
            if (errorElement) errorElement.style.display = 'none';

            if (!id) return;

            try {
                const isAvailable = await checkIdAvailability(id);
                console.log(`ID ${id} availability: ${isAvailable}`);

                if (isAvailable) {
                    idInput.classList.add('is-valid');
                } else {
                    idInput.classList.add('is-invalid');
                    if (errorElement) {
                        errorElement.textContent = 'ID already in use';
                        errorElement.style.display = 'block';
                    }
                }
            } catch (error) {
                console.error('Validation error:', error);
                idInput.classList.add('is-invalid');
            }
        }, 500);

        idInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5);
            validateId();
        });
    }
    function setupEmailValidation() {
        const emailInput = document.getElementById('empEmail');
        if (!emailInput) return;

        const validateEmail = debounce(async () => {
            const email = emailInput.value.trim();
            const emptyError = document.getElementById('emailEmptyError');
            const existError = document.getElementById('emailExistError');
            const formatError = document.getElementById('emailFormatError');

            // Reset all states
            emailInput.classList.remove('is-valid', 'is-invalid');
            emptyError.style.display = 'none';
            existError.style.display = 'none';
            formatError.style.display = 'none';

            // Case 1: Empty field
            if (!email) {
                emailInput.classList.add('is-invalid');
                emptyError.style.display = 'block';
                return;
            }

            // Case 2: Check email format
            if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) {
                emailInput.classList.add('is-invalid');
                formatError.style.display = 'block';
                return;
            }

            // Case 3: Check email availability
            try {
                const isAvailable = await checkEmailAvailability(email);
                if (isAvailable) {
                    emailInput.classList.add('is-valid');
                } else {
                    emailInput.classList.add('is-invalid');
                    existError.style.display = 'block';
                }
            } catch (error) {
                console.error('Email check failed:', error);
                emailInput.classList.add('is-invalid');
                existError.textContent = 'Error checking email availability';
                existError.style.display = 'block';
            }
        }, 500);

        emailInput.addEventListener('input', validateEmail);
    }
    function setupNameValidation() {
        const nameInput = document.getElementById('empName');
        if (!nameInput) return;

        const nameError = document.getElementById('nameError');

        nameInput.addEventListener('input', () => {
            // Reset validation state
            nameInput.classList.remove('is-valid', 'is-invalid');
            nameError.style.display = 'none';

            const name = nameInput.value.trim();

            // Case 1: Empty field (handled by HTML5 required attribute)
            if (!name) return;

            // Case 2: Check pattern
            if (!/^[A-Za-z ]+$/.test(name)) {
                nameInput.classList.add('is-invalid');
                nameError.textContent = 'Only alphabetic characters and spaces allowed';
                nameError.style.display = 'block';
                return;
            }

            // Case 3: Check length
            if (name.length > 30) {
                nameInput.classList.add('is-invalid');
                nameError.textContent = 'Maximum 30 characters allowed';
                nameError.style.display = 'block';
                return;
            }

            // Valid name
            nameInput.classList.add('is-valid');
        });

        // Also validate on form submission
        const form = nameInput.closest('form');
        if (form) {
            form.addEventListener('submit', (e) => {
                if (!nameInput.value.trim()) {
                    nameInput.classList.add('is-invalid');
                    nameError.textContent = 'Name is required';
                    nameError.style.display = 'block';
                }
            });
        }
    }

    function setupEventListeners() {
        // Search and filters
        if (elements.search) {
            elements.search.addEventListener('input', () => {
                state.currentPage = 1;
                renderTable();
            });
        }

        if (elements.deptFilter) {
            elements.deptFilter.addEventListener('change', renderTable);
        }

        if (elements.statusFilter) {
            elements.statusFilter.addEventListener('change', renderTable);
        }

        // Pagination
        if (elements.prevPage) {
            elements.prevPage.addEventListener('click', () => goToPage(-1));
        }

        if (elements.nextPage) {
            elements.nextPage.addEventListener('click', () => goToPage(1));
        }

        // Modals
        if (elements.addBtn) {
            elements.addBtn.addEventListener('click', () => openModal('employee'));
        }

        // Close modals
        document.querySelectorAll('.modal .close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                closeModal(e.target.closest('.modal').id.replace('Modal', ''));
            });
        });

        // Form submission
        if (elements.form) {
            elements.form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await saveEmployee();
            });
        }

        // Delegated event listeners for dynamic elements
        if (elements.table) {
            elements.table.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;

                const employeeId = btn.dataset.id;
                if (btn.classList.contains('edit-btn')) {
                    openModal('employee', employeeId);
                } else if (btn.classList.contains('delete-btn')) {
                    deleteEmployee(employeeId);
                } else if (btn.classList.contains('programmes-btn')) {
                    state.openProgrammeModal(employeeId);
                }
            });
        }
    }
    // Add this inside your EmployeeManager module, before the init() function

    // Programme Management Functions
    function setupProgrammeModal() {
        const modal = document.getElementById('programmeModal');
        const modalTitle = document.getElementById('programmeModalTitle');
        const currentProgrammes = document.getElementById('currentProgrammes');
        const addBtn = document.getElementById('addProgrammeBtn');
        const newProgrammeInput = document.getElementById('newProgramme');
        let currentEmployeeId = null;

        // Open modal with employee's current programmes
        function openProgrammeModal(employeeId) {
            currentEmployeeId = employeeId;
            const employee = state.employees.find(e => e.id === employeeId);
            modalTitle.textContent = `Manage ID: ${employeeId} Programmes`;
            renderProgrammes(employee.programmes);
            modal.style.display = 'block';
        }

        // Render programmes list with remove buttons
        function renderProgrammes(programmes) {
            currentProgrammes.innerHTML = '';
            programmes.forEach(programme => {
                const programmeDiv = document.createElement('div');
                programmeDiv.className = 'programme-item';
                programmeDiv.innerHTML = `
                    <span>${programme}</span>
                    <button class="btn-icon remove-programme" data-programme="${programme}">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                currentProgrammes.appendChild(programmeDiv);
            });

            // Add remove event listeners
            document.querySelectorAll('.remove-programme').forEach(btn => {
                btn.addEventListener('click', () => removeProgramme(btn.dataset.programme));
            });
        }

        // Add new programme
        async function addProgramme() {
            const programme = newProgrammeInput.value.trim();
            if (!programme) return;

            try {
                const response = await fetch(`/api/employees/${currentEmployeeId}/programmes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ programme })
                });

                const result = await response.json();

                if (!response.ok) {
                    // Handle duplicate programme case
                    if (result.error === 'Programme already exists') {
                        showError(`"${programme}" already exists as "${result.existing}"`);
                    } else {
                        throw new Error(result.error || 'Failed to add programme');
                    }
                    return;
                }


                // Update UI
                newProgrammeInput.value = '';
                const employee = state.employees.find(e => e.id === currentEmployeeId);
                employee.programmes.push(programme);
                renderProgrammes(employee.programmes);
                showSuccess(result.message);

            } catch (error) {
                showError(error.message);
            }
        }

        // Remove programme
        async function removeProgramme(programme) {
            if (!confirm(`Remove programme "${programme}"?`)) return;

            try {
                const response = await fetch(`/api/employees/${currentEmployeeId}/programmes`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ programme })
                });

                const result = await response.json();

                if (!response.ok) throw new Error(result.error || 'Failed to remove programme');

                // Update UI
                const employee = state.employees.find(e => e.id === currentEmployeeId);
                employee.programmes = employee.programmes.filter(p => p !== programme);
                renderProgrammes(employee.programmes);
                showSuccess(result.message);

            } catch (error) {
                showError(error.message);
            }
        }

        // Event listeners
        addBtn.addEventListener('click', addProgramme);
        newProgrammeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addProgramme();
        });

        // Close modal
        modal.querySelector('.close').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        // Make available to other functions
        return { openProgrammeModal };
    }
    async function init() {
        try {
            await fetchData();
            renderFilters();
            renderTable();
            const { openProgrammeModal } = setupProgrammeModal();
            setupEventListeners();
            setupIdValidation();
            setupEmailValidation();
            setupNameValidation();
            state.openProgrammeModal = openProgrammeModal;
        } catch (error) {
            console.error('Initialization error:', error);
            showError(`Failed to initialize: ${error.message}`);
        }
    }

    // CRUD Operations
    async function saveEmployee() {
        const form = document.getElementById('employeeForm');
        if (!form) return;

        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';

        try {
            // Validate form
            form.classList.add('was-validated');
            if (!form.checkValidity()) {
                showError('Please fill all required fields correctly');
                return;
            }

            // Prepare form data
            const statusValue = document.querySelector('input[name="empStatus"]:checked').value;
            const formData = {
                id: parseInt(document.getElementById('empId').value.trim()),
                name: document.getElementById('empName').value.trim(),
                email: document.getElementById('empEmail').value.trim(),
                department: document.getElementById('empDept').value || '',
                status: statusValue === 'true' ? 'Full-time' : 'Part-time'
            };

            const isEdit = state.selectedEmployee !== null;
            const url = isEdit ? `/api/employees/${state.selectedEmployee.id}` : '/api/employees';
            const method = isEdit ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `Failed to ${isEdit ? 'update' : 'create'} employee`);
            }

            // Success handling
            closeModal('employee');
            await fetchData();
            renderTable();

            // Show success message
            showSuccess(`Employee ${isEdit ? 'updated' : 'created'} successfully!`);

        } catch (error) {
            console.error('Save error:', error);
            showError(error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    }
    function showSuccess(message) {
        const successDiv = document.getElementById('successDisplay') || createMessageDisplay('successDisplay', '#28a745');
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        successDiv.style.animation = 'fadeIn 0.3s ease-out';

        setTimeout(() => {
            successDiv.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                successDiv.style.display = 'none';
            }, 300);
        }, 2000);
    }

    // Helper to create message displays
    function createMessageDisplay(id, bgColor) {
        const div = document.createElement('div');
        div.id = id;
        div.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 15px;
            background: ${bgColor};
            color: white;
            border-radius: 5px;
            z-index: 1000;
            display: none;
            max-width: 400px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 14px;
            text-align: center;
        `;
        document.body.appendChild(div);
        return div;
    }



    function getFormData() {
        const name = document.getElementById('empName').value.trim();
        const email = document.getElementById('empEmail').value.trim();
        const idInput = document.getElementById('empId');
        const id = idInput ? idInput.value.trim() : generateTempId();

        // For new employees, programmes will be empty
        return {
            id,
            name,
            email,
            department: document.getElementById('empDept').value || '',
            status: document.querySelector('input[name="empStatus"]:checked').value === 'true',
            programmes: [] // Empty array for new employees
        };
    }

    function validateFormData(data) {
    // ID validation
        if (!data.id) throw new Error('Employee ID is required');
        if (data.id.length > 5) throw new Error('ID cannot exceed 5 digits');
        if (!/^\d+$/.test(data.id)) throw new Error('ID must contain only numbers');

        // Name validation
        if (!data.name) throw new Error('Name is required');
        if (!/^[a-zA-Z ]+$/.test(data.name)) throw new Error('Name must contain only alphabets');
        if (data.name.length > 30) throw new Error('Name cannot exceed 30 characters');

        // Email validation
        if (!data.email) throw new Error('Email is required');
        if (!/^[\w.-]+@[\w.-]+\.\w+$/.test(data.email)) throw new Error('Invalid email format');
    }

    // Helper function for new IDs
    function generateTempId() {
        return Math.floor(10000 + Math.random() * 90000).toString();
    }

    async function deleteEmployee(id) {
        if (!confirm(`Are you sure you want to delete employee #${id}? This action cannot be undone.`)) {
            return;
        }

        // Get the table row for visual feedback
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) {
            row.style.opacity = '0.5';
            row.style.transition = 'opacity 0.3s';
        }

        try {
            const response = await fetch(`/api/employees/${id}`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            // Handle non-JSON responses
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                throw new Error(text || 'Invalid server response');
            }

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to delete employee');
            }

            // Success handling
            if (row) row.remove();

            // Option 1: Re-fetch all data
            await fetchData();
            renderTable();

            // Option 2: Optimized - remove from local state
            // state.employees = state.employees.filter(emp => emp.id !== id);
            // renderTable();

            showSuccess(result.message || 'Employee deleted successfully');

        } catch (error) {
            console.error('Delete error:', error);

            // Reset row appearance if error occurs
            if (row) {
                row.style.opacity = '';
                row.style.transition = '';
            }

            // Clean error message
            const cleanMessage = error.message
                .replace(/<[^>]*>?/gm, '') // Remove HTML tags
                .replace(/Database operation failed.*/, 'Failed to delete employee. Please try again.');

            showError(cleanMessage);
        }
    }

    // Error handling
    function showError(message) {
        // Clean the message if it contains HTML
        const cleanMessage = message.startsWith('<!doctype') ?
            'Server error occurred. Please try again.' :
            message.replace(/<[^>]*>?/gm, '');

        // Get or create error display element
        const errorDiv = document.getElementById('errorDisplay') || createErrorDisplay();

        // Clear any existing timeout to prevent premature hiding
        if (errorDiv.hideTimeout) {
            clearTimeout(errorDiv.hideTimeout);
        }

        // Set the message and show with animation
        errorDiv.textContent = cleanMessage;
        errorDiv.style.display = 'block';
        errorDiv.style.opacity = '1';
        errorDiv.style.transform = 'translateY(0)';

        // Hide after 5 seconds with fade-out animation
        errorDiv.hideTimeout = setTimeout(() => {
            errorDiv.style.opacity = '0';
            errorDiv.style.transform = 'translateY(-20px)';

            // Remove completely after animation completes
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 300);
        }, 5000);

        console.error('Error:', cleanMessage);
    }

    function createErrorDisplay() {
        const div = document.createElement('div');
        div.id = 'errorDisplay';
        div.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px;
            background: #ff4444;
            color: white;
            border-radius: 5px;
            z-index: 1000;
            display: none;
            opacity: 0;
            transform: translateY(-20px);
            transition: opacity 0.3s ease, transform 0.3s ease;
            max-width: 400px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        document.body.appendChild(div);

        // Add click handler to manually dismiss
        div.addEventListener('click', () => {
            div.style.opacity = '0';
            div.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                div.style.display = 'none';
            }, 300);
        });

        return div;
    }

    // Public API
    return {
        init
    };
})();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => EmployeeManager.init());