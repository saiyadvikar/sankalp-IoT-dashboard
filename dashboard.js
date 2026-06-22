// Sankalp ANC IoT Dashboard - Interactivity and Visualizations
// Processes raw data dynamically based on filters, manages Chart.js instances, and theme switching

document.addEventListener("DOMContentLoaded", () => {
    try {
    // ----------------------------------------------------------------------
    // INITIALIZATION SECURITY CHECKS
    // ----------------------------------------------------------------------
    if (typeof dashboardData === "undefined") {
        const errorMsg = "Error: dashboard_data.js could not be loaded. Please ensure dashboard_data.js and dashboard.js are in the same folder as index.html.";
        console.error(errorMsg);
        alert(errorMsg);
        return;
    }

    // ----------------------------------------------------------------------
    // STATE VARIABLES
    // ----------------------------------------------------------------------
    let currentMonth = "All";
    let currentBlock = "All";
    let subcentreSearchQuery = "";
    
    // Chart instances storage
    let charts = {
        blockPie: null,
        weeklyRisks: null,
        blockRisks: null,
        blockUtilization: null
    };

    // Week boundaries (Friday to Thursday, starting May 1, 2026)
    const WEEKS = [
        { no: 1, start: "2026-05-01", end: "2026-05-07", label: "W1 (May 1 - May 7)", devices: 31 },
        { no: 2, start: "2026-05-08", end: "2026-05-14", label: "W2 (May 8 - May 14)", devices: 31 },
        { no: 3, start: "2026-05-15", end: "2026-05-21", label: "W3 (May 15 - May 21)", devices: 31 },
        { no: 4, start: "2026-05-22", end: "2026-05-28", label: "W4 (May 22 - May 28)", devices: 31 },
        { no: 5, start: "2026-05-29", end: "2026-06-04", label: "W5 (May 29 - Jun 4)", devices: 31 },
        { no: 6, start: "2026-06-05", end: "2026-06-11", label: "W6 (Jun 5 - Jun 11)", devices: 32 },
        { no: 7, start: "2026-06-12", end: "2026-06-18", label: "W7 (Jun 12 - Jun 18)", devices: 32 }
    ];

    // Theme Config
    const htmlEl = document.documentElement;
    const themeToggleBtn = document.getElementById("theme-toggle");
    const themeIcon = document.getElementById("theme-icon");

    // Initialize Theme safely (file:// mode sometimes blocks localStorage access)
    let savedTheme = "dark";
    try {
        savedTheme = localStorage.getItem("sankalp-theme") || "dark";
    } catch (e) {
        console.warn("localStorage is blocked or unavailable. Defaulting to dark theme.", e);
    }
    htmlEl.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);

    // ----------------------------------------------------------------------
    // DOM ELEMENTS
    // ----------------------------------------------------------------------
    const monthFilterSelect = document.getElementById("month-filter");
    const blockFilterSelect = document.getElementById("block-filter");
    const exportCsvBtn = document.getElementById("export-csv-btn");
    
    const kpiTotalContacts = document.getElementById("kpi-total-contacts");
    const kpiTotalContactsSub = document.getElementById("kpi-total-contacts-sub");
    const kpiWeightRate = document.getElementById("kpi-weight-rate");
    const kpiWeightRateSub = document.getElementById("kpi-weight-rate-sub");
    const kpiBpRate = document.getElementById("kpi-bp-rate");
    const kpiBpRateSub = document.getElementById("kpi-bp-rate-sub");
    const kpiUnderweight = document.getElementById("kpi-underweight");
    const kpiPih = document.getElementById("kpi-pih");
    const kpiAnemia = document.getElementById("kpi-anemia");

    const subcentreSearch = document.getElementById("subcentre-search");
    const subcentreTableBody = document.getElementById("subcentres-table-body");
    const weeklyTableBody = document.getElementById("weekly-table-body");
    const copyWeeklyBtn = document.getElementById("copy-weekly-btn");
    
    // Modal Elements
    const detailModal = document.getElementById("detail-modal");
    const modalCloseBtn = document.getElementById("modal-close-btn");
    const modalTitle = document.getElementById("modal-title");
    const modalSubtitle = document.getElementById("modal-subtitle");
    const modalKpiContacts = document.getElementById("modal-kpi-contacts");
    const modalKpiIotRate = document.getElementById("modal-kpi-iot-rate");
    const modalRiskPih = document.getElementById("modal-risk-pih");
    const modalRiskUnderweight = document.getElementById("modal-risk-underweight");
    const modalRiskAnemia = document.getElementById("modal-risk-anemia");
    const modalAnmsList = document.getElementById("modal-anms-list");



    // ----------------------------------------------------------------------
    // THEME SWITCHER LOGIC
    // ----------------------------------------------------------------------
    themeToggleBtn.addEventListener("click", () => {
        const currentTheme = htmlEl.getAttribute("data-theme");
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        htmlEl.setAttribute("data-theme", newTheme);
        try {
            localStorage.setItem("sankalp-theme", newTheme);
        } catch (e) {
            console.warn("localStorage is blocked. Theme preference will not persist.", e);
        }
        updateThemeIcon(newTheme);
        
        // Rebuild charts to adjust grids/text colors
        updateChartDefaults();
        renderCharts();
    });

    function updateThemeIcon(theme) {
        if (theme === "dark") {
            themeIcon.className = "fa-solid fa-sun";
            themeToggleBtn.title = "Switch to Light Mode";
        } else {
            themeIcon.className = "fa-solid fa-moon";
            themeToggleBtn.title = "Switch to Dark Mode";
        }
    }

    // Chart.js Theme Defaults
    function updateChartDefaults() {
        if (typeof Chart === "undefined") {
            console.warn("Chart.js is not loaded. Skipping style configuration.");
            return;
        }
        const isDark = htmlEl.getAttribute("data-theme") === "dark";
        const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.06)";
        const textColor = isDark ? "#94a3b8" : "#64748b";
        const tooltipBg = isDark ? "#0f172a" : "#ffffff";
        const tooltipBorder = isDark ? "#334155" : "#e2e8f0";
        const tooltipText = isDark ? "#f8fafc" : "#1e293b";

        Chart.defaults.color = textColor;
        Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
        Chart.defaults.font.size = 11;
        Chart.defaults.font.weight = 500;
        
        Chart.defaults.plugins.tooltip.backgroundColor = tooltipBg;
        Chart.defaults.plugins.tooltip.borderColor = tooltipBorder;
        Chart.defaults.plugins.tooltip.borderWidth = 1;
        Chart.defaults.plugins.tooltip.titleColor = tooltipText;
        Chart.defaults.plugins.tooltip.bodyColor = textColor;
        Chart.defaults.plugins.tooltip.cornerRadius = 8;
        Chart.defaults.plugins.tooltip.padding = 10;
        
        Chart.defaults.scale.grid = {
            color: gridColor
        };
    }

    // ----------------------------------------------------------------------
    // FILTER AND BINDINGS CONTROLS
    // ----------------------------------------------------------------------
    monthFilterSelect.addEventListener("change", (e) => {
        currentMonth = e.target.value;
        processAndRefresh();
    });

    blockFilterSelect.addEventListener("change", (e) => {
        currentBlock = e.target.value;
        processAndRefresh();
    });

    subcentreSearch.addEventListener("input", (e) => {
        subcentreSearchQuery = e.target.value.toLowerCase();
        renderSubcentresTable();
    });



    // ----------------------------------------------------------------------
    // CORE PROCESSING ENGINE
    // ----------------------------------------------------------------------
    let filteredRecords = [];
    let weeklySummary = [];
    let subcentresSummary = [];
    let blocksSummary = [];

    function processAndRefresh() {
        // 1. Filter raw records
        filteredRecords = dashboardData.records.filter(r => {
            const matchesMonth = currentMonth === "All" || r.month === currentMonth;
            const matchesBlock = currentBlock === "All" || r.block === currentBlock;
            return matchesMonth && matchesBlock;
        });

        // 2. Compute Weekly Summary based on the filtered selection
        weeklySummary = WEEKS.map(w => {
            // Filter records falling inside this week range
            const weekRecs = filteredRecords.filter(r => r.anc_date && r.anc_date >= w.start && r.anc_date <= w.end);
            
            const totalContacts = weekRecs.length;
            
            // Total IoT syncs (kit level)
            const iotRecs = weekRecs.filter(r => r.has_iot);
            const beingUsed = new Set(iotRecs.map(r => r.sub_facility)).size;
            const iotDevicesUsed = new Set(iotRecs.map(r => r.anm_id).filter(id => id)).size;
            
            // Device usage counts (checkup-level)
            const weighingScaleUsed = weekRecs.filter(r => r.weight_iot !== null).length;
            const bpMachineUsed = weekRecs.filter(r => r.bp_sys_iot !== null).length;
            
            const pih = weekRecs.filter(r => r.is_pih).length;
            const severeAnemia = weekRecs.filter(r => r.is_severe_anemia).length;
            const weightUnder = weekRecs.filter(r => r.is_underweight).length;

            return {
                week_no: w.no,
                date_from: w.start,
                date_to: w.end,
                label: w.label,
                total_distributed: w.devices,
                being_used: beingUsed,
                total_anc_contacts: totalContacts,
                iot_devices_used: iotDevicesUsed,
                weighing_scale_used: weighingScaleUsed,
                bp_machine_used: bpMachineUsed,
                pih: pih,
                severe_anemia: severeAnemia,
                weight_under: weightUnder
            };
        });

        // 3. Compute Subcentres Summary based on selection
        const subcentresMap = {};
        filteredRecords.forEach(r => {
            const s = r.sub_facility;
            if (!subcentresMap[s]) {
                subcentresMap[s] = {
                    name: s,
                    block: r.block,
                    facility: r.facility,
                    contacts: 0,
                    iot_contacts: 0,
                    weight_contacts: 0,
                    bp_contacts: 0,
                    pih: 0,
                    underweight: 0,
                    severe_anemia: 0,
                    anms: new Set()
                };
            }
            subcentresMap[s].contacts += 1;
            if (r.has_iot) subcentresMap[s].iot_contacts += 1;
            if (r.weight_iot !== null) subcentresMap[s].weight_contacts += 1;
            if (r.bp_sys_iot !== null) subcentresMap[s].bp_contacts += 1;
            if (r.is_pih) subcentresMap[s].pih += 1;
            if (r.is_underweight) subcentresMap[s].underweight += 1;
            if (r.is_severe_anemia) subcentresMap[s].severe_anemia += 1;
            if (r.user_name) subcentresMap[s].anms.add(r.user_name);
        });

        subcentresSummary = Object.values(subcentresMap).map(s => {
            s.anms = Array.from(s.anms);
            s.iot_rate = s.contacts > 0 ? (s.iot_contacts / s.contacts) * 100 : 0;
            s.weight_rate = s.contacts > 0 ? (s.weight_contacts / s.contacts) * 100 : 0;
            s.bp_rate = s.contacts > 0 ? (s.bp_contacts / s.contacts) * 100 : 0;
            return s;
        });

        // 4. Compute Blocks Summary based on selection
        const blocksMap = {};
        filteredRecords.forEach(r => {
            const b = r.block;
            if (!blocksMap[b]) {
                blocksMap[b] = {
                    name: b,
                    contacts: 0,
                    iot_contacts: 0,
                    weight_contacts: 0,
                    bp_contacts: 0,
                    pih: 0,
                    underweight: 0,
                    severe_anemia: 0,
                    sessions: new Set()
                };
            }
            blocksMap[b].contacts += 1;
            if (r.has_iot) blocksMap[b].iot_contacts += 1;
            if (r.weight_iot !== null) blocksMap[b].weight_contacts += 1;
            if (r.bp_sys_iot !== null) blocksMap[b].bp_contacts += 1;
            if (r.is_pih) blocksMap[b].pih += 1;
            if (r.is_underweight) blocksMap[b].underweight += 1;
            if (r.is_severe_anemia) blocksMap[b].severe_anemia += 1;
            if (r.anc_date && r.sub_facility) {
                blocksMap[b].sessions.add(r.anc_date + "|" + r.sub_facility);
            }
        });
        blocksSummary = Object.values(blocksMap).map(b => {
            b.session_count = b.sessions.size;
            b.iot_rate = b.contacts > 0 ? (b.iot_contacts / b.contacts) * 100 : 0;
            b.weight_rate = b.contacts > 0 ? (b.weight_contacts / b.contacts) * 100 : 0;
            b.bp_rate = b.contacts > 0 ? (b.bp_contacts / b.contacts) * 100 : 0;
            return b;
        });

        // 5. Update UI
        updateKPIs();
        renderWeeklyTable();
        renderSubcentresTable();
        renderCharts();
    }

    // ----------------------------------------------------------------------
    // RENDER KPIS
    // ----------------------------------------------------------------------
    function updateKPIs() {
        const total = filteredRecords.length;
        const weightSyncs = filteredRecords.filter(r => r.weight_iot !== null).length;
        const bpSyncs = filteredRecords.filter(r => r.bp_sys_iot !== null).length;
        const underweight = filteredRecords.filter(r => r.is_underweight).length;
        const pih = filteredRecords.filter(r => r.is_pih).length;
        const anemia = filteredRecords.filter(r => r.is_severe_anemia).length;
        
        const weightRate = total > 0 ? (weightSyncs / total) * 100 : 0;
        const bpRate = total > 0 ? (bpSyncs / total) * 100 : 0;

        kpiTotalContacts.innerText = total.toLocaleString();
        
        // Show month context on contacts subtext
        if (currentMonth !== "All") {
            kpiTotalContactsSub.innerText = `Consultations in ${currentMonth}`;
        } else {
            kpiTotalContactsSub.innerText = "Consultations overall (May-Jun)";
        }

        kpiWeightRate.innerText = `${weightRate.toFixed(1)}%`;
        kpiWeightRateSub.innerText = `${weightSyncs} of ${total} checkups`;

        kpiBpRate.innerText = `${bpRate.toFixed(1)}%`;
        kpiBpRateSub.innerText = `${bpSyncs} of ${total} checkups`;

        kpiUnderweight.innerText = underweight.toLocaleString();
        kpiPih.innerText = pih.toLocaleString();
        kpiAnemia.innerText = anemia.toLocaleString();
    }

    // ----------------------------------------------------------------------
    // RENDER DATA TABLES
    // ----------------------------------------------------------------------
    function renderWeeklyTable() {
        weeklyTableBody.innerHTML = "";
        weeklySummary.forEach(w => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>Week ${w.week_no}</strong></td>
                <td>${w.date_from}</td>
                <td>${w.date_to}</td>
                <td><span class="badge badge-primary">${w.total_distributed}</span></td>
                <td><span class="badge badge-primary">${w.being_used}</span></td>
                <td>${w.total_anc_contacts}</td>
                <td><span class="badge badge-success">${w.weighing_scale_used}</span></td>
                <td><span class="badge badge-success">${w.bp_machine_used}</span></td>
                <td>${w.pih > 0 ? `<span class="badge badge-warning">${w.pih}</span>` : '0'}</td>
                <td>${w.severe_anemia > 0 ? `<span class="badge badge-danger">${w.severe_anemia}</span>` : '0'}</td>
                <td>${w.weight_under > 0 ? `<span class="badge badge-pink">${w.weight_under}</span>` : '0'}</td>
            `;
            weeklyTableBody.appendChild(tr);
        });
    }

    function renderSubcentresTable() {
        subcentreTableBody.innerHTML = "";
        
        // Filter subcentres by search query
        const filteredSub = subcentresSummary.filter(s => {
            return s.name.toLowerCase().includes(subcentreSearchQuery) || 
                   s.block.toLowerCase().includes(subcentreSearchQuery);
        });

        // Sort by total IoT utilization rate ascending (poor performance first)
        filteredSub.sort((a, b) => a.iot_rate - b.iot_rate);

        if (filteredSub.length === 0) {
            subcentreTableBody.innerHTML = `
                <tr>
                    <td colspan="11" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                        <i class="fa-solid fa-face-frown" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block;"></i>
                        No subcentres found matching your search.
                    </td>
                </tr>
            `;
            return;
        }

        filteredSub.forEach(s => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${s.name}</strong></td>
                <td>${s.block}</td>
                <td>${s.contacts}</td>
                <td>${s.weight_contacts}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-weight: 700; width: 45px;">${s.weight_rate.toFixed(0)}%</span>
                        <div style="flex: 1; height: 6px; background-color: var(--border-color); border-radius: var(--radius-full); overflow: hidden; width: 60px;">
                            <div style="width: ${s.weight_rate}%; height: 100%; background: linear-gradient(95deg, var(--color-primary), var(--color-pink)); border-radius: var(--radius-full);"></div>
                        </div>
                    </div>
                </td>
                <td>${s.bp_contacts}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-weight: 700; width: 45px;">${s.bp_rate.toFixed(0)}%</span>
                        <div style="flex: 1; height: 6px; background-color: var(--border-color); border-radius: var(--radius-full); overflow: hidden; width: 60px;">
                            <div style="width: ${s.bp_rate}%; height: 100%; background: linear-gradient(95deg, var(--color-secondary), var(--color-success)); border-radius: var(--radius-full);"></div>
                        </div>
                    </div>
                </td>
                <td>${s.pih > 0 ? `<span class="badge badge-warning">${s.pih}</span>` : '0'}</td>
                <td>${s.underweight > 0 ? `<span class="badge badge-pink">${s.underweight}</span>` : '0'}</td>
                <td>${s.severe_anemia > 0 ? `<span class="badge badge-danger">${s.severe_anemia}</span>` : '0'}</td>
                <td>
                    <button class="btn btn-outline btn-sm view-details-btn" data-sub="${s.name}" style="padding: 4px 10px; font-size: 0.75rem;">
                        <i class="fa-solid fa-eye"></i> Details
                    </button>
                </td>
            `;
            subcentreTableBody.appendChild(tr);
        });

        // Bind Detail Buttons
        subcentreTableBody.querySelectorAll(".view-details-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                showSubcentreModal(btn.dataset.sub);
            });
        });
    }

    // ----------------------------------------------------------------------
    // SUBCENTRE MODAL DETAILS
    // ----------------------------------------------------------------------
    function showSubcentreModal(name) {
        const s = subcentresSummary.find(item => item.name === name);
        if (!s) return;

        modalTitle.innerText = s.name;
        modalSubtitle.innerText = `Block: ${s.block} | Facility: ${s.facility}`;
        
        modalKpiContacts.innerText = s.contacts;
        modalKpiIotRate.innerText = `${s.iot_rate.toFixed(1)}%`;
        
        modalRiskPih.innerText = `${s.pih} case${s.pih !== 1 ? 's' : ''}`;
        modalRiskPih.className = s.pih > 0 ? "badge badge-warning" : "badge badge-success";

        modalRiskUnderweight.innerText = `${s.underweight} case${s.underweight !== 1 ? 's' : ''}`;
        modalRiskUnderweight.className = s.underweight > 0 ? "badge badge-pink" : "badge badge-success";

        modalRiskAnemia.innerText = `${s.severe_anemia} case${s.severe_anemia !== 1 ? 's' : ''}`;
        modalRiskAnemia.className = s.severe_anemia > 0 ? "badge badge-danger" : "badge badge-success";

        if (s.anms && s.anms.length > 0) {
            modalAnmsList.innerHTML = `<ul style="padding-left: 1.2rem; margin-top: 4px;">
                ${s.anms.map(anm => `<li style="margin-bottom: 2px;">${anm}</li>`).join('')}
            </ul>`;
        } else {
            modalAnmsList.innerText = "No assigned ANM details found.";
        }

        detailModal.style.display = "flex";
    }

    modalCloseBtn.addEventListener("click", () => {
        detailModal.style.display = "none";
    });

    window.addEventListener("click", (e) => {
        if (e.target === detailModal) {
            detailModal.style.display = "none";
        }
    });

    // ----------------------------------------------------------------------
    // VISUALIZATIONS GENERATOR (CHART.JS)
    // ----------------------------------------------------------------------
    function renderCharts() {
        if (typeof Chart === "undefined") {
            console.warn("Chart.js is not loaded. Skipping chart rendering.");
            return;
        }
        renderBlockPieChart();
        renderBlockUtilizationChart();
        renderWeeklyRisksChart();
        renderBlockRisksChart();
    }



    // Chart 2: Block Pie Chart
    function renderBlockPieChart() {
        if (charts.blockPie) {
            charts.blockPie.destroy();
        }

        const ctx = document.getElementById("block-pie-chart").getContext("2d");
        const labels = blocksSummary.map(b => b.name);
        const data = blocksSummary.map(b => b.session_count);

        // Curated colors for blocks
        const colors = [
            'rgba(99, 102, 241, 0.85)', // Indigo
            'rgba(14, 165, 233, 0.85)', // Sky
            'rgba(236, 72, 153, 0.85)'  // Pink
        ];
        
        const borderColors = [
            'rgb(99, 102, 241)',
            'rgb(14, 165, 233)',
            'rgb(236, 72, 153)'
        ];

        charts.blockPie = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderColor: borderColors.slice(0, labels.length),
                    borderWidth: 1.5,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 10, padding: 15 }
                    }
                }
            }
        });
    }

    // Chart 5: Block-wise IoT Utilization Rate
    function renderBlockUtilizationChart() {
        if (charts.blockUtilization) {
            charts.blockUtilization.destroy();
        }

        const ctx = document.getElementById("block-utilization-chart").getContext("2d");
        const labels = blocksSummary.map(b => b.name);
        const weightData = blocksSummary.map(b => b.weight_rate);
        const bpData = blocksSummary.map(b => b.bp_rate);

        charts.blockUtilization = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Weighing Scale Util. (%)',
                        data: weightData,
                        backgroundColor: 'rgba(99, 102, 241, 0.75)',
                        borderColor: 'rgb(99, 102, 241)',
                        borderWidth: 1.5,
                        borderRadius: 4,
                        barPercentage: 0.7,
                        categoryPercentage: 0.6
                    },
                    {
                        label: 'BP Machine Util. (%)',
                        data: bpData,
                        backgroundColor: 'rgba(14, 165, 233, 0.75)',
                        borderColor: 'rgb(14, 165, 233)',
                        borderWidth: 1.5,
                        borderRadius: 4,
                        barPercentage: 0.7,
                        categoryPercentage: 0.6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { boxWidth: 12, usePointStyle: true }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: { display: true, text: 'Utilization Rate (%)' }
                    }
                }
            }
        });
    }

    // Chart 3: Weekly Risk Trends
    function renderWeeklyRisksChart() {
        if (charts.weeklyRisks) {
            charts.weeklyRisks.destroy();
        }

        const ctx = document.getElementById("weekly-risks-chart").getContext("2d");
        const labels = weeklySummary.map(w => w.label);
        const pihData = weeklySummary.map(w => w.pih);
        const underweightData = weeklySummary.map(w => w.weight_under);
        const anemiaData = weeklySummary.map(w => w.severe_anemia);

        charts.weeklyRisks = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Hypertension (PIH)',
                        data: pihData,
                        borderColor: 'rgb(245, 158, 11)', // Amber
                        backgroundColor: 'transparent',
                        borderWidth: 2.5,
                        tension: 0.2,
                        pointRadius: 3
                    },
                    {
                        label: 'Underweight (<40kg)',
                        data: underweightData,
                        borderColor: 'rgb(236, 72, 153)', // Pink
                        backgroundColor: 'transparent',
                        borderWidth: 2.5,
                        tension: 0.2,
                        pointRadius: 3
                    },
                    {
                        label: 'Severe Anemia (<7g/dL)',
                        data: anemiaData,
                        borderColor: 'rgb(239, 44, 44)', // Red
                        backgroundColor: 'transparent',
                        borderWidth: 2.5,
                        tension: 0.2,
                        pointRadius: 3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { boxWidth: 12, usePointStyle: true }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 },
                        title: { display: true, text: 'Cases Count' }
                    }
                }
            }
        });
    }

    // Chart 4: Block Risk Breakdown
    function renderBlockRisksChart() {
        if (charts.blockRisks) {
            charts.blockRisks.destroy();
        }

        const ctx = document.getElementById("block-risks-chart").getContext("2d");
        const labels = blocksSummary.map(b => b.name);
        const pihData = blocksSummary.map(b => b.pih);
        const underweightData = blocksSummary.map(b => b.underweight);
        const anemiaData = blocksSummary.map(b => b.severe_anemia);

        charts.blockRisks = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'PIH',
                        data: pihData,
                        backgroundColor: 'rgba(245, 158, 11, 0.75)',
                        borderColor: 'rgb(245, 158, 11)',
                        borderWidth: 1.5,
                        borderRadius: 4,
                        barPercentage: 0.75
                    },
                    {
                        label: 'Underweight',
                        data: underweightData,
                        backgroundColor: 'rgba(236, 72, 153, 0.75)',
                        borderColor: 'rgb(236, 72, 153)',
                        borderWidth: 1.5,
                        borderRadius: 4,
                        barPercentage: 0.75
                    },
                    {
                        label: 'Severe Anemia',
                        data: anemiaData,
                        backgroundColor: 'rgba(239, 44, 44, 0.75)',
                        borderColor: 'rgb(239, 44, 44)',
                        borderWidth: 1.5,
                        borderRadius: 4,
                        barPercentage: 0.75
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { boxWidth: 12, usePointStyle: true }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 },
                        title: { display: true, text: 'Cases Count' }
                    }
                }
            }
        });
    }

    // ----------------------------------------------------------------------
    // EXPORTS & COPY HANDLERS
    // ----------------------------------------------------------------------
    function generateWeeklyCsvString() {
        let csv = "Date from,Date to,Total distributed,Being used,Total ANC contacts,Weighing Scale Used,BP Machine Used,PIH,Severe anemia,Weight <40 kg\n";
        
        weeklySummary.forEach(w => {
            csv += `${w.date_from},${w.date_to},${w.total_distributed},${w.being_used},${w.total_anc_contacts},${w.weighing_scale_used},${w.bp_machine_used},${w.pih},${w.severe_anemia},${w.weight_under}\n`;
        });
        
        return csv;
    }

    exportCsvBtn.addEventListener("click", () => {
        const csvContent = generateWeeklyCsvString();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        
        link.setAttribute("href", url);
        link.setAttribute("download", `Sankalp_ANC_Weekly_Report_M_${currentMonth}_B_${currentBlock}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    copyWeeklyBtn.addEventListener("click", () => {
        const csvContent = generateWeeklyCsvString();
        
        navigator.clipboard.writeText(csvContent).then(() => {
            const originalText = copyWeeklyBtn.innerHTML;
            copyWeeklyBtn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
            copyWeeklyBtn.style.borderColor = "var(--color-success)";
            copyWeeklyBtn.style.color = "var(--color-success)";
            
            setTimeout(() => {
                copyWeeklyBtn.innerHTML = originalText;
                copyWeeklyBtn.style.borderColor = "";
                copyWeeklyBtn.style.color = "";
            }, 2000);
        }).catch(err => {
            console.error("Failed to copy text: ", err);
            alert("Failed to copy CSV data to clipboard.");
        });
    });

    // ----------------------------------------------------------------------
    // STARTUP INVOCATION
    // ----------------------------------------------------------------------
        updateChartDefaults();
        processAndRefresh();
    } catch (error) {
        console.error("Critical Dashboard Error:", error);
        alert("Critical Dashboard Error: " + error.message + "\n\nPlease open the browser Developer Console (F12) to see more details.");
    }
});
