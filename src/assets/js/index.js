const LOG_KEY   = 'simanis_logs';
const ADMIN_KEY = 'simanis_session';

function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function fmtDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function fmtNow() {
    return new Date().toISOString();
}

function escHtml(str) {
    if (!str) return '-';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function toast(msg, type = 'info', title = '') {
    const container = $('#toastContainer');
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;

    const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
    const titles = { success: 'Berhasil', error: 'Gagal', info: 'Info' };

    el.innerHTML = `
        <i class="fa-solid ${icons[type] || icons.info}"></i>
        <div class="toast-body">
            <span class="toast-title">${title || titles[type] || 'Info'}</span>
            <span class="toast-msg">${msg}</span>
        </div>
    `;

    container.appendChild(el);

    setTimeout(() => {
        el.classList.add('toast--out');
        el.addEventListener('animationend', () => el.remove());
    }, 3500);
}

function getLogs() {
    try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); }
    catch { return []; }
}

function saveLogs(logs) {
    localStorage.setItem(LOG_KEY, JSON.stringify(logs));
}

function addLog(type, modul, keterangan) {
    const logs = getLogs();
    const session = getSession();
    logs.unshift({
        id:         Date.now(),
        timestamp:  fmtNow(),
        type,
        modul,
        keterangan,
        aktor:      session ? session.username : 'System'
    });
    if (logs.length > 500) logs.pop();
    saveLogs(logs);
    updateNotifBadge();
}

function updateNotifBadge() {
    const badge = $('#notifBadge');
    if (!badge) return;
    const logs = getLogs();
    const today = new Date().toDateString();
    const todayLogs = logs.filter(l => new Date(l.timestamp).toDateString() === today);
    const count = todayLogs.length;
    badge.textContent = count > 99 ? '99+' : count;
    badge.setAttribute('data-count', count);
    if (count > 0) badge.style.display = 'flex';
    else badge.style.display = 'none';
}

function getSession() {
    try { return JSON.parse(localStorage.getItem(ADMIN_KEY)); }
    catch { return null; }
}

function initSession() {
    const role    = sessionStorage.getItem('auth_role');
    const raw     = sessionStorage.getItem('auth_user');
    const session = getSession();

    if (role !== 'admin' || !raw) {
        window.location.replace('/auth');
        return;
    }

    try {
        const user = JSON.parse(raw);
        localStorage.setItem(ADMIN_KEY, JSON.stringify(user));
        const nameEl = $('#adminName');
        if (nameEl) nameEl.textContent = user.username || (session && session.username) || 'Administrator';
    } catch {
        window.location.replace('/auth');
    }
}

const pageMeta = {
    dashboard: { title: 'Dashboard',     sub: 'Overview' },
    siswa:     { title: 'Data Siswa',    sub: 'Manajemen' },
    admin:     { title: 'Data Admin',    sub: 'Manajemen' },
    logs:      { title: 'Activity Logs', sub: 'Sistem' },
};

function navigateTo(pageId) {
    $$('.page').forEach(p => p.classList.add('hidden'));
    $$('.nav-item').forEach(n => n.classList.remove('active'));

    const target = $(`#page-${pageId}`);
    if (target) target.classList.remove('hidden');

    const navItem = $(`.nav-item[data-page="${pageId}"]`);
    if (navItem) navItem.classList.add('active');

    const meta = pageMeta[pageId] || { title: pageId, sub: '' };
    $('#pageTitle').querySelector('span').textContent = meta.title;
    $('#pageSub').textContent = meta.sub;

    if (pageId === 'dashboard') loadDashboard();
    if (pageId === 'siswa')     loadSiswa();
    if (pageId === 'admin')     loadAdmin();
    if (pageId === 'logs')      renderLogs();
}

function initNav() {
    $$('.nav-item').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            navigateTo(item.dataset.page);
        });
    });
}

function initDate() {
    const el = $('#topbarDate');
    if (!el) return;
    const d = new Date();
    el.textContent = d.toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
}

function initSidebar() {
    const btn = $('#sidebarToggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
        document.body.classList.toggle('sidebar-collapsed');
    });
}

async function apiFetch(url, opts = {}) {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
}

let chartKelasInst   = null;
let chartStatusInst  = null;

async function loadDashboard() {
    const { ok, data } = await apiFetch('/api/data/siswa');
    if (!ok) return;

    const siswa = data.data || [];

    const total    = siswa.length;
    const aktif    = siswa.filter(s => s.status === 'aktif').length;
    const pindah   = siswa.filter(s => s.status === 'pindah').length;
    const lulus    = siswa.filter(s => s.status === 'lulus').length;
    const nonaktif = siswa.filter(s => s.status === 'nonaktif').length;

    const kelasSet   = new Set(siswa.map(s => s.kelas));
    const jurusanSet = new Set(siswa.map(s => s.jurusan));

    $('#stat-total').textContent    = total;
    $('#stat-aktif').textContent    = aktif;
    $('#stat-nonaktif').textContent = nonaktif + pindah;
    $('#stat-kelas').textContent    = kelasSet.size;
    $('#stat-jurusan').textContent  = jurusanSet.size;

    const aktifPct = total ? Math.round(aktif / total * 100) : 0;
    $('#stat-aktif-pct').textContent    = aktifPct + '%';
    $('#stat-total-pct').textContent    = total + ' total';
    $('#stat-nonaktif-pct').textContent = total ? Math.round((nonaktif + pindah) / total * 100) + '%' : '0%';

    renderChartKelas(siswa);
    renderChartStatus({ aktif, pindah, lulus, nonaktif });
    renderRecentSiswa(siswa.slice(0, 5));
}

function renderChartKelas(siswa) {
    const kelasCounts = {};
    siswa.forEach(s => {
        kelasCounts[s.kelas] = (kelasCounts[s.kelas] || 0) + 1;
    });

    const labels = Object.keys(kelasCounts).sort();
    const values = labels.map(k => kelasCounts[k]);

    const ctx = $('#chartKelas');
    if (!ctx) return;

    if (chartKelasInst) chartKelasInst.destroy();

    const style = getComputedStyle(document.documentElement);
    const primary = style.getPropertyValue('--primary').trim();
    const border  = style.getPropertyValue('--border').trim();
    const text    = style.getPropertyValue('--text-light').trim();

    chartKelasInst = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Jumlah Siswa',
                data: values,
                backgroundColor: 'rgba(15, 31, 61, 0.10)',
                borderColor: 'rgba(15, 31, 61, 0.80)',
                borderWidth: 1.5,
                borderRadius: 5,
                hoverBackgroundColor: 'rgba(15, 31, 61, 0.18)',
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0F1F3D',
                    titleColor: '#ffffff',
                    bodyColor: 'rgba(255,255,255,0.70)',
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: ctx => ` ${ctx.parsed.y} siswa`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#A0AEC0', font: { size: 11, family: 'Inter' } },
                    border: { color: '#E2E8F0' }
                },
                y: {
                    grid: { color: '#E2E8F0', drawBorder: false },
                    ticks: {
                        color: '#A0AEC0', stepSize: 1,
                        font: { size: 11, family: 'Inter' }
                    },
                    border: { display: false }
                }
            }
        }
    });
}

function renderChartStatus({ aktif, pindah, lulus, nonaktif }) {
    const ctx = $('#chartStatus');
    if (!ctx) return;

    if (chartStatusInst) chartStatusInst.destroy();

    const labels = ['Aktif', 'Pindah', 'Lulus', 'Nonaktif'];
    const values = [aktif, pindah, lulus, nonaktif];
    const colors = ['#38A169', '#A0AEC0', '#0F1F3D', '#E53E3E'];
    const total  = values.reduce((a, b) => a + b, 0);

    chartStatusInst = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors.map(c => c + '22'),
                borderColor: colors,
                borderWidth: 2,
                hoverOffset: 4,
            }],
        },
        options: {
            responsive: true,
            cutout: '72%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0F1F3D',
                    titleColor: '#ffffff',
                    bodyColor: 'rgba(255,255,255,0.70)',
                    padding: 10,
                    cornerRadius: 8,
                }
            }
        }
    });

    const legend = $('#donutLegend');
    if (!legend) return;
    legend.innerHTML = labels.map((l, i) => {
        const pct = total ? Math.round(values[i] / total * 100) : 0;
        return `
            <div class="legend-item">
                <span class="legend-dot" style="background:${colors[i]}"></span>
                <span>${l}</span>
                <span class="legend-pct">${pct}%</span>
            </div>
        `;
    }).join('');
}

function renderRecentSiswa(siswa) {
    const tbody = $('#recentSiswaBody');
    if (!tbody) return;

    if (!siswa.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Belum ada data siswa.</td></tr>`;
        return;
    }

    tbody.innerHTML = siswa.map(s => `
        <tr>
            <td>${escHtml(s.nisn)}</td>
            <td style="font-weight:500;color:var(--primary)">${escHtml(s.nama_lengkap)}</td>
            <td>${escHtml(s.kelas)}</td>
            <td>${escHtml(s.jurusan)}</td>
            <td>${badgeHtml(s.status)}</td>
        </tr>
    `).join('');
}

function badgeHtml(status) {
    const map = {
        aktif:    'badge--aktif',
        nonaktif: 'badge--nonaktif',
        pindah:   'badge--pindah',
        lulus:    'badge--lulus',
    };
    const cls = map[status] || 'badge--pindah';
    const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : '-';
    return `<span class="badge ${cls}">${label}</span>`;
}

let allSiswa = [];

async function loadSiswa() {
    const { ok, data } = await apiFetch('/api/data/siswa');
    if (!ok) {
        toast('Gagal memuat data siswa.', 'error');
        return;
    }
    allSiswa = data.data || [];
    populateSiswaFilters(allSiswa);
    renderSiswaTable(allSiswa);
}

function populateSiswaFilters(siswa) {
    const kelasSet   = [...new Set(siswa.map(s => s.kelas))].sort();
    const jurusanSet = [...new Set(siswa.map(s => s.jurusan))].sort();

    const fKelas = $('#filterKelas');
    fKelas.innerHTML = '<option value="">Semua Kelas</option>' +
        kelasSet.map(k => `<option value="${escHtml(k)}">${escHtml(k)}</option>`).join('');

    const fJurusan = $('#filterJurusan');
    fJurusan.innerHTML = '<option value="">Semua Jurusan</option>' +
        jurusanSet.map(j => `<option value="${escHtml(j)}">${escHtml(j)}</option>`).join('');
}

function filterSiswa() {
    const q       = $('#searchSiswa').value.toLowerCase().trim();
    const kelas   = $('#filterKelas').value;
    const jurusan = $('#filterJurusan').value;
    const status  = $('#filterStatus').value;

    const filtered = allSiswa.filter(s => {
        const matchQ = !q || s.nama_lengkap.toLowerCase().includes(q) || s.nisn.includes(q);
        const matchK = !kelas   || s.kelas   === kelas;
        const matchJ = !jurusan || s.jurusan === jurusan;
        const matchS = !status  || s.status  === status;
        return matchQ && matchK && matchJ && matchS;
    });

    renderSiswaTable(filtered);
}

function renderSiswaTable(siswa) {
    const tbody = $('#siswaTableBody');
    const count = $('#siswaCount');
    if (count) count.textContent = siswa.length;

    if (!siswa.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="table-empty">Tidak ada data yang sesuai.</td></tr>`;
        return;
    }

    tbody.innerHTML = siswa.map((s, i) => `
        <tr>
            <td style="color:var(--text-light)">${i + 1}</td>
            <td style="font-family:'Sora',sans-serif;font-size:0.786rem">${escHtml(s.nisn)}</td>
            <td style="font-weight:500;color:var(--primary)">${escHtml(s.nama_lengkap)}</td>
            <td>${escHtml(s.gender)}</td>
            <td>${escHtml(s.kelas)}</td>
            <td>${escHtml(s.jurusan)}</td>
            <td>${escHtml(s.no_tlpn) || '<span style="color:var(--text-light)">-</span>'}</td>
            <td>${badgeHtml(s.status)}</td>
            <td>
                <div class="action-group">
                    <button class="btn-action btn-action--edit" title="Edit" onclick="openEditSiswa(${s.id})">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-action btn-action--del" title="Hapus" onclick="confirmDeleteSiswa(${s.id}, '${escHtml(s.nama_lengkap)}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function initSiswaEvents() {
    $('#searchSiswa').addEventListener('input', filterSiswa);
    $('#filterKelas').addEventListener('change', filterSiswa);
    $('#filterJurusan').addEventListener('change', filterSiswa);
    $('#filterStatus').addEventListener('change', filterSiswa);

    $('#btnTambahSiswa').addEventListener('click', () => openModalSiswa());

    $('#exportSiswaExcel').addEventListener('click', () => exportSiswaExcel());
    $('#exportSiswaPdf').addEventListener('click', () => exportSiswaPdf());
}

function openModalSiswa(siswa = null) {
    const isEdit = !!siswa;
    openModal(
        isEdit ? 'Edit Data Siswa' : 'Tambah Siswa Baru',
        `
        <div class="form-split">
            <div class="form-split__photo">
                <label class="form-label">Foto Profil</label>
                <div class="upload-zone" id="uploadZone">
                    <input type="file" id="fFoto" accept="image/jpeg,image/png,image/webp" class="upload-input">
                    <div class="upload-placeholder" id="uploadPlaceholder">
                        ${isEdit && siswa.foto_profil
                            ? `<img src="${escHtml(siswa.foto_profil)}" class="upload-preview" id="uploadPreview" alt="Foto profil">`
                            : `<div class="upload-preview hidden" id="uploadPreview"><img></div>`
                        }
                        <div class="upload-hint ${isEdit && siswa.foto_profil ? 'hidden' : ''}" id="uploadHint">
                            <i class="fa-solid fa-cloud-arrow-up"></i>
                            <span>Klik atau seret</span>
                            <small>JPG, PNG, WebP. Maks. 2 MB</small>
                        </div>
                    </div>
                    ${isEdit && siswa.foto_profil
                        ? `<button type="button" class="upload-remove" id="uploadRemove"><i class="fa-solid fa-xmark"></i></button>`
                        : `<button type="button" class="upload-remove hidden" id="uploadRemove"><i class="fa-solid fa-xmark"></i></button>`
                    }
                </div>
            </div>
            <div class="form-split__fields">
                <div class="form-group">
                    <label class="form-label">NISN <span>*</span></label>
                    <input class="form-input" id="fNisn" type="text" placeholder="Nomor Induk Siswa Nasional" value="${isEdit ? escHtml(siswa.nisn) : ''}" ${isEdit ? 'readonly style="opacity:0.6"' : ''}>
                </div>
                <div class="form-group">
                    <label class="form-label">Nama Lengkap <span>*</span></label>
                    <input class="form-input" id="fNama" type="text" placeholder="Nama lengkap siswa" value="${isEdit ? escHtml(siswa.nama_lengkap) : ''}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Gender <span>*</span></label>
                        <select class="form-select" id="fGender">
                            <option value="">Pilih Gender</option>
                            <option value="Laki-laki" ${isEdit && siswa.gender === 'Laki-laki' ? 'selected' : ''}>Laki-laki</option>
                            <option value="Perempuan" ${isEdit && siswa.gender === 'Perempuan' ? 'selected' : ''}>Perempuan</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Status <span>*</span></label>
                        <select class="form-select" id="fStatus">
                            <option value="aktif"    ${isEdit && siswa.status === 'aktif'    ? 'selected' : ''}>Aktif</option>
                            <option value="pindah"   ${isEdit && siswa.status === 'pindah'   ? 'selected' : ''}>Pindah</option>
                            <option value="lulus"    ${isEdit && siswa.status === 'lulus'    ? 'selected' : ''}>Lulus</option>
                            <option value="nonaktif" ${isEdit && siswa.status === 'nonaktif' ? 'selected' : ''}>Nonaktif</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Kelas <span>*</span></label>
                        <input class="form-input" id="fKelas" type="text" placeholder="X / XI / XII" value="${isEdit ? escHtml(siswa.kelas) : ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Jurusan <span>*</span></label>
                        <input class="form-input" id="fJurusan" type="text" placeholder="RPL / TKJ" value="${isEdit ? escHtml(siswa.jurusan) : ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">No. Telepon</label>
                    <input class="form-input" id="fTlpn" type="tel" placeholder="08xxxxxxxxxx" value="${isEdit && siswa.no_tlpn ? escHtml(siswa.no_tlpn) : ''}">
                </div>
            </div>
        </div>
        `,
        async () => {
            const fotoResult = await (function() {
                const previewEl = $('#uploadPreview');
                const imgEl = previewEl ? previewEl.tagName === 'IMG' ? previewEl : previewEl.querySelector('img') : null;
                if (imgEl && imgEl.src && imgEl.src.startsWith('data:')) return Promise.resolve(imgEl.src);
                if (isEdit && siswa.foto_profil && !$('#uploadZone').dataset.cleared) return Promise.resolve(siswa.foto_profil);
                return Promise.resolve(null);
            })();

            const body = {
                nisn:         $('#fNisn').value.trim(),
                nama_lengkap: $('#fNama').value.trim(),
                gender:       $('#fGender').value,
                kelas:        $('#fKelas').value.trim(),
                jurusan:      $('#fJurusan').value.trim(),
                no_tlpn:      $('#fTlpn').value.trim() || null,
                foto_profil:  fotoResult,
                status:       $('#fStatus').value,
            };

            if (!body.nisn || !body.nama_lengkap || !body.gender || !body.kelas || !body.jurusan) {
                toast('Isi semua field wajib.', 'error');
                return;
            }

            const url    = isEdit ? `/api/data/siswa/${siswa.id}` : '/api/data/siswa';
            const method = isEdit ? 'PUT' : 'POST';
            const { ok, data } = await apiFetch(url, { method, body: JSON.stringify(body) });

            if (!ok) {
                toast(data.message || 'Operasi gagal.', 'error');
                return;
            }

            closeModal();
            toast(isEdit ? 'Data siswa berhasil diperbarui.' : 'Siswa baru berhasil ditambahkan.', 'success');
            addLog(isEdit ? 'UPDATE' : 'CREATE', 'Siswa', `${isEdit ? 'Edit' : 'Tambah'} siswa: ${body.nama_lengkap} (${body.nisn})`);
            await loadSiswa();
        }
    );
    initUploadZone();
}

function initUploadZone() {
    const zone    = $('#uploadZone');
    const input   = $('#fFoto');
    const hint    = $('#uploadHint');
    const remove  = $('#uploadRemove');
    const preview = $('#uploadPreview');
    if (!zone || !input) return;

    function getPreviewImg() {
        if (preview.tagName === 'IMG') return preview;
        return preview.querySelector('img');
    }

    function showPreview(src) {
        const img = getPreviewImg();
        img.src = src;
        preview.classList.remove('hidden');
        hint.classList.add('hidden');
        remove.classList.remove('hidden');
        zone.classList.add('upload-zone--has-image');
        delete zone.dataset.cleared;
    }

    function clearPreview() {
        const img = getPreviewImg();
        img.src = '';
        preview.classList.add('hidden');
        hint.classList.remove('hidden');
        remove.classList.add('hidden');
        zone.classList.remove('upload-zone--has-image');
        zone.dataset.cleared = '1';
        input.value = '';
    }

    function handleFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            toast('Format file tidak didukung.', 'error');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            toast('Ukuran file maksimal 2 MB.', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = e => showPreview(e.target.result);
        reader.readAsDataURL(file);
    }

    zone.addEventListener('click', e => {
        if (e.target === remove || remove.contains(e.target)) return;
        input.click();
    });

    input.addEventListener('change', () => {
        if (input.files[0]) handleFile(input.files[0]);
    });

    zone.addEventListener('dragover', e => {
        e.preventDefault();
        zone.classList.add('upload-zone--drag');
    });

    zone.addEventListener('dragleave', () => {
        zone.classList.remove('upload-zone--drag');
    });

    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('upload-zone--drag');
        handleFile(e.dataTransfer.files[0]);
    });

    remove.addEventListener('click', e => {
        e.stopPropagation();
        clearPreview();
    });
}

function openEditSiswa(id) {
    const siswa = allSiswa.find(s => s.id === id);
    if (!siswa) return;
    openModalSiswa(siswa);
}

function confirmDeleteSiswa(id, nama) {
    openConfirm(
        'Hapus Data Siswa',
        `Data siswa <strong>${escHtml(nama)}</strong> akan dihapus permanen dan tidak dapat dipulihkan.`,
        async () => {
            const { ok, data } = await apiFetch(`/api/data/siswa/${id}`, { method: 'DELETE' });
            if (!ok) {
                toast(data.message || 'Gagal menghapus data.', 'error');
                return;
            }
            toast(`Siswa ${nama} berhasil dihapus.`, 'success');
            addLog('DELETE', 'Siswa', `Hapus siswa: ${nama}`);
            await loadSiswa();
        }
    );
}

let allAdmin = [];

async function loadAdmin() {
    const { ok, data } = await apiFetch('/api/data/admin');
    if (!ok) {
        toast('Gagal memuat data admin.', 'error');
        return;
    }
    allAdmin = data.data || [];
    renderAdminTable(allAdmin);
    filterAdmin();
}

function filterAdmin() {
    const q = $('#searchAdmin').value.toLowerCase().trim();
    const filtered = allAdmin.filter(a => {
        return !q || a.username.toLowerCase().includes(q) ||
               (a.email && a.email.toLowerCase().includes(q));
    });
    renderAdminTable(filtered);
}

function renderAdminTable(admins) {
    const tbody = $('#adminTableBody');
    const count = $('#adminCount');
    if (count) count.textContent = admins.length;

    if (!admins.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="table-empty">Tidak ada data admin.</td></tr>`;
        return;
    }

    tbody.innerHTML = admins.map((a, i) => `
        <tr>
            <td style="color:var(--text-light)">${i + 1}</td>
            <td style="font-weight:500;color:var(--primary)">${escHtml(a.username)}</td>
            <td>${a.email ? escHtml(a.email) : '<span style="color:var(--text-light)">-</span>'}</td>
            <td><span class="badge badge--admin">Super Admin</span></td>
            <td style="color:var(--text-light);font-size:0.786rem">${fmtDate(a.created_at)}</td>
            <td style="color:var(--text-light);font-size:0.786rem">${fmtDate(a.updated_at)}</td>
            <td>
                <div class="action-group">
                    <button class="btn-action btn-action--edit" title="Edit" onclick="openEditAdmin(${a.id})">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-action btn-action--del" title="Hapus" onclick="confirmDeleteAdmin(${a.id}, '${escHtml(a.username)}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function initAdminEvents() {
    $('#searchAdmin').addEventListener('input', filterAdmin);
    $('#btnTambahAdmin').addEventListener('click', () => openModalAdmin());
    $('#exportAdminExcel').addEventListener('click', () => exportAdminExcel());
    $('#exportAdminPdf').addEventListener('click', () => exportAdminPdf());
}

function openModalAdmin(admin = null) {
    const isEdit = !!admin;
    openModal(
        isEdit ? 'Edit Data Admin' : 'Tambah Admin Baru',
        `
        <div class="form-group">
            <label class="form-label">Username <span>*</span></label>
            <input class="form-input" id="fAdminUser" type="text" placeholder="Username unik" value="${isEdit ? escHtml(admin.username) : ''}">
        </div>
        <div class="form-group">
            <label class="form-label">Password ${isEdit ? '' : '<span>*</span>'}</label>
            <input class="form-input" id="fAdminPass" type="password" placeholder="${isEdit ? 'Kosongkan jika tidak ingin mengubah' : 'Password admin'}">
        </div>
        <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" id="fAdminEmail" type="email" placeholder="email@sekolah.sch.id" value="${isEdit && admin.email ? escHtml(admin.email) : ''}">
        </div>
        <div class="form-group">
            <label class="form-label">Role</label>
            <select class="form-select" disabled>
                <option>Super Admin</option>
            </select>
        </div>
        `,
        async () => {
            const username = $('#fAdminUser').value.trim();
            const password = $('#fAdminPass').value.trim();
            const email    = $('#fAdminEmail').value.trim();

            if (!username || (!isEdit && !password)) {
                toast('Username dan password wajib diisi.', 'error');
                return;
            }

            const body = { username, email: email || null };
            if (password) body.password = password;
            if (!isEdit)  body.password = password;

            const url    = isEdit ? `/api/data/admin/${admin.id}` : '/api/data/admin';
            const method = isEdit ? 'PUT' : 'POST';
            const { ok, data } = await apiFetch(url, { method, body: JSON.stringify(body) });

            if (!ok) {
                toast(data.message || 'Operasi gagal.', 'error');
                return;
            }

            closeModal();
            toast(isEdit ? 'Data admin berhasil diperbarui.' : 'Admin baru berhasil ditambahkan.', 'success');
            addLog(isEdit ? 'UPDATE' : 'CREATE', 'Admin', `${isEdit ? 'Edit' : 'Tambah'} admin: ${username}`);
            await loadAdmin();
        }
    );
}

function openEditAdmin(id) {
    const admin = allAdmin.find(a => a.id === id);
    if (!admin) return;
    openModalAdmin(admin);
}

function confirmDeleteAdmin(id, username) {
    openConfirm(
        'Hapus Data Admin',
        `Akun admin <strong>${escHtml(username)}</strong> akan dihapus permanen.`,
        async () => {
            const { ok, data } = await apiFetch(`/api/data/admin/${id}`, { method: 'DELETE' });
            if (!ok) {
                toast(data.message || 'Gagal menghapus admin.', 'error');
                return;
            }
            toast(`Admin ${username} berhasil dihapus.`, 'success');
            addLog('DELETE', 'Admin', `Hapus admin: ${username}`);
            await loadAdmin();
        }
    );
}

function renderLogs() {
    const q    = $('#searchLogs').value.toLowerCase().trim();
    const type = $('#filterLogsType').value;
    let logs   = getLogs();

    if (q)    logs = logs.filter(l => l.keterangan.toLowerCase().includes(q) || l.modul.toLowerCase().includes(q));
    if (type) logs = logs.filter(l => l.type === type);

    const tbody = $('#logsTableBody');
    const count = $('#logsCount');
    if (count) count.textContent = logs.length;

    if (!logs.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Belum ada aktivitas tercatat.</td></tr>`;
        return;
    }

    tbody.innerHTML = logs.map((l, i) => `
        <tr>
            <td style="color:var(--text-light)">${i + 1}</td>
            <td style="color:var(--text-light);font-size:0.786rem;white-space:nowrap">${fmtDateTime(l.timestamp)}</td>
            <td><span class="log-type log-type--${l.type}">${l.type}</span></td>
            <td style="font-weight:500">${escHtml(l.modul)}</td>
            <td>${escHtml(l.keterangan)}</td>
            <td style="color:var(--text-light)">${escHtml(l.aktor)}</td>
        </tr>
    `).join('');
}

function initLogsEvents() {
    $('#searchLogs').addEventListener('input', renderLogs);
    $('#filterLogsType').addEventListener('change', renderLogs);
    $('#clearLogs').addEventListener('click', () => {
        openConfirm('Hapus Semua Logs', 'Seluruh activity logs akan dihapus permanen.', () => {
            localStorage.removeItem(LOG_KEY);
            renderLogs();
            updateNotifBadge();
            toast('Semua logs berhasil dihapus.', 'success');
        });
    });
    $('#exportLogsExcel').addEventListener('click', exportLogsExcel);
}

let modalCallback = null;

function openModal(title, bodyHtml, onSubmit) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = bodyHtml;
    modalCallback = onSubmit;
    $('#modalOverlay').classList.remove('hidden');
}

function closeModal() {
    $('#modalOverlay').classList.add('hidden');
    modalCallback = null;
}

function initModal() {
    $('#modalClose').addEventListener('click', closeModal);
    $('#modalCancel').addEventListener('click', closeModal);
    $('#modalOverlay').addEventListener('click', e => {
        if (e.target === $('#modalOverlay')) closeModal();
    });
    $('#modalSubmit').addEventListener('click', () => {
        if (typeof modalCallback === 'function') modalCallback();
    });
}

let confirmCallback = null;

function openConfirm(title, msg, onOk) {
    $('#confirmTitle').textContent = title;
    $('#confirmMsg').innerHTML     = msg;
    confirmCallback = onOk;
    $('#confirmOverlay').classList.remove('hidden');
}

function closeConfirm() {
    $('#confirmOverlay').classList.add('hidden');
    confirmCallback = null;
}

function initConfirm() {
    $('#confirmCancel').addEventListener('click', closeConfirm);
    $('#confirmOverlay').addEventListener('click', e => {
        if (e.target === $('#confirmOverlay')) closeConfirm();
    });
    $('#confirmOk').addEventListener('click', () => {
        if (typeof confirmCallback === 'function') {
            confirmCallback();
            closeConfirm();
        }
    });
}

function exportToExcel(rows, headers, sheetName, fileName) {
    const data = [headers, ...rows];
    const ws   = XLSX.utils.aoa_to_sheet(data);
    const wb   = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);
    addLog('EXPORT', sheetName, `Export Excel: ${fileName}`);
    toast(`File ${fileName} berhasil diunduh.`, 'success');
}

function exportSiswaExcel() {
    const headers = ['No', 'NISN', 'Nama Lengkap', 'Gender', 'Kelas', 'Jurusan', 'No. Telepon', 'Status'];
    const rows = allSiswa.map((s, i) => [
        i + 1, s.nisn, s.nama_lengkap, s.gender, s.kelas, s.jurusan, s.no_tlpn || '-', s.status
    ]);
    exportToExcel(rows, headers, 'Data Siswa', 'data-siswa.xlsx');
}

function exportAdminExcel() {
    const headers = ['No', 'Username', 'Email', 'Role', 'Dibuat', 'Diperbarui'];
    const rows = allAdmin.map((a, i) => [
        i + 1, a.username, a.email || '-', 'Super Admin', fmtDate(a.created_at), fmtDate(a.updated_at)
    ]);
    exportToExcel(rows, headers, 'Data Admin', 'data-admin.xlsx');
}

function exportLogsExcel() {
    const logs    = getLogs();
    const headers = ['No', 'Waktu', 'Tipe', 'Modul', 'Keterangan', 'Aktor'];
    const rows    = logs.map((l, i) => [
        i + 1, fmtDateTime(l.timestamp), l.type, l.modul, l.keterangan, l.aktor
    ]);
    exportToExcel(rows, headers, 'Activity Logs', 'activity-logs.xlsx');
}

function exportToPdf(title, headers, rows) {
    const tableRows = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');

    const html = `
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Inter', Arial, sans-serif; font-size: 11px; color: #2d3748; padding: 24px; }
                h2 { font-size: 14px; font-weight: 700; color: #0F1F3D; margin-bottom: 4px; }
                p { font-size: 10px; color: #718096; margin-bottom: 16px; }
                table { width: 100%; border-collapse: collapse; }
                th { background: #0F1F3D; color: #fff; padding: 7px 10px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; }
                td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
                tr:nth-child(even) td { background: #f8fafc; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>
            <h2>${title}</h2>
            <p>Dicetak pada: ${fmtDateTime(fmtNow())} | Total: ${rows.length} data</p>
            <table>
                <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
        </body>
        </html>
    `;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);

    addLog('EXPORT', title, `Export PDF: ${title}`);
    toast('Jendela cetak PDF dibuka.', 'info');
}

function exportSiswaPdf() {
    const headers = ['No', 'NISN', 'Nama Lengkap', 'Gender', 'Kelas', 'Jurusan', 'No. Telepon', 'Status'];
    const rows = allSiswa.map((s, i) => [
        i + 1, s.nisn, s.nama_lengkap, s.gender, s.kelas, s.jurusan, s.no_tlpn || '-', s.status
    ]);
    exportToPdf('Data Siswa', headers, rows);
}

function exportAdminPdf() {
    const headers = ['No', 'Username', 'Email', 'Role', 'Dibuat', 'Diperbarui'];
    const rows = allAdmin.map((a, i) => [
        i + 1, a.username, a.email || '-', 'Super Admin', fmtDate(a.created_at), fmtDate(a.updated_at)
    ]);
    exportToPdf('Data Admin', headers, rows);
}

document.addEventListener('DOMContentLoaded', () => {
    initSession();
    initDate();
    initSidebar();
    initNav();
    initModal();
    initConfirm();
    initSiswaEvents();
    initAdminEvents();
    initLogsEvents();
    updateNotifBadge();
    navigateTo('dashboard');
});