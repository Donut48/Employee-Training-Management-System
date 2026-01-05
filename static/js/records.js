// Sorting functions
const SortManager = {
    // Quick sort for departments (case-insensitive)
    quickSort: function(arr, compareFn) {
        if (arr.length <= 1) return arr;

        const pivot = arr[0];
        const left = [];
        const right = [];

        for (let i = 1; i < arr.length; i++) {
            if (compareFn(arr[i], pivot) < 0) {
                left.push(arr[i]);
            } else {
                right.push(arr[i]);
            }
        }

        return [...this.quickSort(left, compareFn), pivot, ...this.quickSort(right, compareFn)];
    },

    // Merge sort for programmes (by count then name)
    mergeSort: function(arr, compareFn) {
        if (arr.length <= 1) return arr;

        const mid = Math.floor(arr.length / 2);
        const left = arr.slice(0, mid);
        const right = arr.slice(mid);

        return this.merge(
            this.mergeSort(left, compareFn),
            this.mergeSort(right, compareFn),
            compareFn
        );
    },

    merge: function(left, right, compareFn) {
        let result = [];
        let leftIndex = 0;
        let rightIndex = 0;

        while (leftIndex < left.length && rightIndex < right.length) {
            if (compareFn(left[leftIndex], right[rightIndex]) < 0) {
                result.push(left[leftIndex]);
                leftIndex++;
            } else {
                result.push(right[rightIndex]);
                rightIndex++;
            }
        }

        return result.concat(left.slice(leftIndex)).concat(right.slice(rightIndex));
    }
};

function normalizeName(name) {
    if (!name) return '';
    return String(name).toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}


// Filter and Sort Manager
const FilterSortManager = (() => {
    let currentSortMethod = null;
    let employees = [];

    function init(employeeData) {
        employees = employeeData;
        setupSortButtons();
    }

    function setupSortButtons() {
        const deptBtn = document.getElementById('sortByDepartment');
        const progBtn = document.getElementById('sortByProgramme');

        deptBtn?.addEventListener('click', () => {
            currentSortMethod = 'department';
            deptBtn.classList.add('active');
            progBtn?.classList.remove('active');
            applySorting();
        });

        progBtn?.addEventListener('click', () => {
            currentSortMethod = 'programme';
            progBtn.classList.add('active');
            deptBtn?.classList.remove('active');
            applySorting();
        });
    }

    function applySorting() {
        if (!currentSortMethod || employees.length === 0) return;

        // Start with currently filtered employees if filters are active
        let employeesToSort = getFilteredEmployees();

        let sortedEmployees = [];

        if (currentSortMethod === 'department') {
            // Case-insensitive quick sort by department then name
            sortedEmployees = SortManager.quickSort([...employeesToSort], (a, b) => {
                const aDept = normalizeName(a.department);
                const bDept = normalizeName(b.department);
                const deptCompare = aDept.localeCompare(bDept);
                if (deptCompare !== 0) return deptCompare;
                return normalizeName(a.name).localeCompare(normalizeName(b.name));
            });
        } else {
            // Merge sort by programme count (ascending) then id
            sortedEmployees = SortManager.mergeSort([...employeesToSort], (a, b) => {
                const aCount = a.programmes?.length || 0;
                const bCount = b.programmes?.length || 0;

                // First sort by number of programmes (ascending now)
                if (aCount < bCount) return -1;
                if (aCount > bCount) return 1;

                // If same number of programmes, sort by name
                return parseInt(a.id) - parseInt(b.id);
            });
        }

        updateEmployeeTable(sortedEmployees);
    }


    function groupAndSort(employees, key) {
        const groups = {};

        employees.forEach(emp => {
            const groupKey = key === 'department' ?
                emp.department :
                (emp.programmes?.[0] || 'No Programme');

            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(emp);
        });

        // Sort each group by name
        Object.values(groups).forEach(group => {
            group.sort((a, b) => a.name.localeCompare(b.name));
        });

        // Flatten back to array
        return Object.values(groups).flat();
    }
    function getFilteredEmployees() {
        const rows = document.querySelectorAll('#employeeTable tbody tr');
        const filteredEmployees = [];

        rows.forEach(row => {
            if (row.style.display !== 'none') {
                const employee = {
                    id: row.dataset.employeeId,
                    name: row.cells[1].textContent,
                    email: row.cells[2].textContent,
                    programmes: JSON.parse(row.dataset.programmes || '[]'),
                    department: row.dataset.department || '',
                    status: row.cells[5].textContent === 'Full-time'
                };
                filteredEmployees.push(employee);
            }
        });

        return filteredEmployees.length > 0 ? filteredEmployees : [...employees];
    }


    function updateEmployeeTable(sortedEmployees) {
        const tbody = document.querySelector('#employeeTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        sortedEmployees.forEach(emp => {
            const row = document.createElement('tr');
            row.dataset.employeeId = emp.id;
            row.dataset.employeeName = (emp.name || '').toLowerCase();
            row.dataset.department = emp.department || '';
            row.dataset.programmes = JSON.stringify(emp.programmes || []);

            row.innerHTML = `
                <td>${emp.id}</td>
                <td>${emp.name || ''}</td>
                <td>${emp.email || ''}</td>
                <td>${Array.isArray(emp.programmes) ? emp.programmes.join(', ') : ''}</td>
                <td>${emp.department || ''}</td>
                <td>${emp.status ? 'Full-time' : 'Part-time'}</td>
            `;
            tbody.appendChild(row);
        });
    }

    return {
        init,
        applySorting
    };
})();

// Filtering variables
let currentFilters = {
  departments: new Set(),
  programmes: new Set()
};

// Modal functionality
function setupFilterModal() {
  const modal = document.getElementById('filterModal');
  const openBtn = document.getElementById('openFilterModal');
  const closeBtn = document.querySelector('#filterModal .close');
  const applyBtn = document.getElementById('applyFilters');
  const resetBtn = document.getElementById('resetFilters');

  // Open modal
  openBtn?.addEventListener('click', () => {
    modal.style.display = 'block';
  });

  // Close modal
  closeBtn?.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Close when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

  // Apply filters
  applyBtn?.addEventListener('click', () => {
    applyFilters();
    modal.style.display = 'none';
  });

  // Reset filters
  resetBtn?.addEventListener('click', () => {
    resetFilters();
  });
}

// Generate filter options
function generateFilterOptions(employees) {
  const departments = new Map(); // Using Map to track normalized names
  const programmes = new Map();

  // Collect all unique values with case-insensitive handling
  Object.values(employees).forEach(emp => {
    // Handle departments
    if (emp.department && emp.department.trim() !== '') {
      const normalizedDept = normalizeName(emp.department);
      if (!departments.has(normalizedDept)) {
        departments.set(normalizedDept, emp.department); // Store original value
      }
    }

    // Handle programmes
    if (emp.programmes && emp.programmes.length > 0) {
      emp.programmes.forEach(prog => {
        if (prog && prog.trim() !== '') {
          const normalizedProg = normalizeName(prog);
          if (!programmes.has(normalizedProg)) {
            programmes.set(normalizedProg, prog); // Store original value
          }
        }
      });
    }
  });

  // Render department filters using quick sort
  const deptContainer = document.getElementById('departmentFilters');
  if (deptContainer) {
    deptContainer.innerHTML = '';

    // Convert to array and quick sort departments case-insensitively
    const deptArray = [...departments.values()];
    const sortedDepts = SortManager.quickSort(deptArray, (a, b) =>
      normalizeName(a).localeCompare(normalizeName(b))
    );

    sortedDepts.forEach(dept => {
      const option = document.createElement('div');
      option.className = 'filter-option';
      option.innerHTML = `
        <input type="checkbox" id="dept-${normalizeName(dept)}" value="${dept}">
        <label for="dept-${normalizeName(dept)}">${dept}</label>
      `;
      deptContainer.appendChild(option);
    });
  }

  // Render programme filters using merge sort
  const progContainer = document.getElementById('programmeFilters');
  if (progContainer) {
    progContainer.innerHTML = '';

    // Convert to array and merge sort programmes case-insensitively
    const progArray = [...programmes.values()];
    const sortedProgs = SortManager.mergeSort(progArray, (a, b) =>
      normalizeName(a).localeCompare(normalizeName(b))
    );

    sortedProgs.forEach(prog => {
      const option = document.createElement('div');
      option.className = 'filter-option';
      option.innerHTML = `
        <input type="checkbox" id="prog-${normalizeName(prog)}" value="${prog}">
        <label for="prog-${normalizeName(prog)}">${prog}</label>
      `;
      progContainer.appendChild(option);
    });
  }
}

// Apply selected filters
function applyFilters() {
  // Get selected departments with case-insensitive comparison (quick sort)
  const selectedDepts = [...document.querySelectorAll('#departmentFilters input:checked')]
    .map(checkbox => checkbox.value);

  currentFilters.departments = new Set(
    SortManager.quickSort(selectedDepts, (a, b) =>
      normalizeName(a).localeCompare(normalizeName(b))
    )
  );

  // Get selected programmes with case-insensitive comparison (merge sort)
  const selectedProgs = [...document.querySelectorAll('#programmeFilters input:checked')]
    .map(checkbox => checkbox.value);

  currentFilters.programmes = new Set(
    SortManager.mergeSort(selectedProgs, (a, b) =>
      normalizeName(a).localeCompare(normalizeName(b))
    )
  );

  filterTable();
}

// Reset all filters
function resetFilters() {
  document.querySelectorAll('.filter-options input[type="checkbox"]').forEach(checkbox => {
    checkbox.checked = false;
  });

  currentFilters.departments = new Set();
  currentFilters.programmes = new Set();

  filterTable();
}

// Filter table based on current filters
function filterTable() {
  const rows = document.querySelectorAll('#employeeTable tbody tr');
  let visibleCount = 0;

  // Convert filter sets to sorted arrays
  const sortedDepartments = SortManager.quickSort(
    [...currentFilters.departments],
    (a, b) => normalizeName(a).localeCompare(normalizeName(b))
  );

  const sortedProgrammes = SortManager.mergeSort(
    [...currentFilters.programmes],
    (a, b) => normalizeName(a).localeCompare(normalizeName(b))
  );

  rows.forEach(row => {
    const rowDept = row.dataset.department;
    const rowProgs = JSON.parse(row.dataset.programmes || '[]');

    // Normalize department for comparison
    const normalizedRowDept = normalizeName(rowDept);
    const deptMatch = sortedDepartments.length === 0 ||
                     sortedDepartments.some(dept =>
                        normalizeName(dept) === normalizedRowDept
                     );

    // Normalize programmes for comparison
    const progMatch = sortedProgrammes.length === 0 ||
                     rowProgs.some(prog =>
                        sortedProgrammes.some(selectedProg =>
                           normalizeName(selectedProg) === normalizeName(prog)
                        )
                     );

    const shouldShow = deptMatch && progMatch;
    row.style.display = shouldShow ? '' : 'none';
    if (shouldShow) visibleCount++;
  });

  const countElement = document.getElementById('employeeCount');
  if (countElement) {
    countElement.textContent = visibleCount;
  }
}

// Update employee table
function updateEmployeeTable(employees) {
  const tbody = document.querySelector('#employeeTable tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  Object.entries(employees).forEach(([id, emp]) => {
    const row = document.createElement('tr');
    row.dataset.employeeId = id;
    row.dataset.employeeName = (emp.name || '').toLowerCase();
    row.dataset.department = emp.department || '';
    row.dataset.programmes = JSON.stringify(emp.programmes || []);

    // Format programmes as HTML list
    const programmesHTML = Array.isArray(emp.programmes) && emp.programmes.length
      ? `<ul style="margin: 0; padding-left: 20px;">${
          emp.programmes.map(prog => `<li>${prog}</li>`).join('')
        }</ul>`
      : '';

    row.innerHTML = `
      <td>${id}</td>
      <td>${emp.name || ''}</td>
      <td>${emp.email || ''}</td>
      <td>${programmesHTML}</td>
      <td>${emp.department || ''}</td>
      <td style="white-space: nowrap;">${emp.status ? 'Full-time' : 'Part-time'}</td>
    `;

    tbody.appendChild(row);
  });
}

// Filter employees based on search term
function setupSearch() {
  const searchInput = document.getElementById('employeeSearch');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.trim().toLowerCase();
    const rows = document.querySelectorAll('#employeeTable tbody tr');
    let visibleCount = 0;

    rows.forEach(row => {
      const idMatch = row.dataset.employeeId.startsWith(searchTerm);
      const nameMatch = row.dataset.employeeName.includes(searchTerm);
      const shouldShow = searchTerm === '' || idMatch || nameMatch;

      row.style.display = shouldShow ? '' : 'none';
      if (shouldShow) visibleCount++;
    });

    const countElement = document.getElementById('employeeCount');
    if (countElement) {
      countElement.textContent = visibleCount;
    }
  });
}

// Export functions
function setupExportButtons() {
  document.getElementById('exportExcel')?.addEventListener('click', exportToExcelDirect);
  document.getElementById('exportPDF')?.addEventListener('click', exportToPDFDirect);
}

async function exportToExcelDirect() {
  try {
    const response = await fetch('/api/export-excel-direct');

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Export failed');
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('Exported file is empty');
    }

    downloadFile(blob, 'employees.xlsx');
  } catch (error) {
    console.error('Excel Export error:', error);
    alert(`Failed to export to Excel: ${error.message}`);
  }
}

async function exportToPDFDirect() {
  try {
    const response = await fetch('/api/export-pdf-direct');

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Export failed');
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('Exported file is empty');
    }

    downloadFile(blob, 'employees.pdf');
  } catch (error) {
    console.error('PDF Export error:', error);
    alert(`Failed to export to PDF: ${error.message}`);
  }
}

function downloadFile(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// Main data fetch
async function fetchEmployeeData() {
  try {
    const response = await fetch('/api/employee-data');
    if (!response.ok) throw new Error('Network response was not ok');

    const data = await response.json();
    if (data.error) throw new Error(data.message);

    updateEmployeeTable(data.employees || {});
    generateFilterOptions(data.employees || {});
    filterTable();

    // Initialize sorting with the employee data
    FilterSortManager.init(data.employees || []);

    return data;
  } catch (error) {
    console.error('Error loading employee data:', error);
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
      errorElement.textContent = 'Error loading employee data. Please try again later.';
    }
    return { employees: [] };
  }
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  setupFilterModal();
  setupSearch();
  setupExportButtons();
  fetchEmployeeData();
});