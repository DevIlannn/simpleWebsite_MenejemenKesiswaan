const STORAGE_ROLE = 'auth_role';
const STORAGE_USER = 'auth_user';

const el = {
    skeleton:      document.getElementById('profile-skeleton'),
    content:       document.getElementById('profile-content'),
    errorState:    document.getElementById('error-state'),
    topbarName:    document.getElementById('topbar-name'),
    topbarAvatar:  document.getElementById('topbar-avatar'),
    statusBadge:   document.getElementById('student-status-badge'),
    badgeLabel:    document.getElementById('badge-label'),
    studentPhoto:  document.getElementById('student-photo'),
    studentName:   document.getElementById('student-name'),
    studentNisn:   document.getElementById('student-nisn'),
    metaKelas:     document.getElementById('meta-kelas'),
    metaJurusan:   document.getElementById('meta-jurusan'),
    detailNama:    document.getElementById('detail-nama'),
    detailNisn:    document.getElementById('detail-nisn'),
    detailGender:  document.getElementById('detail-gender'),
    detailKelas:   document.getElementById('detail-kelas'),
    detailJurusan: document.getElementById('detail-jurusan'),
    detailTlpn:    document.getElementById('detail-tlpn'),
    detailStatus:  document.getElementById('detail-status'),
    detailCreated: document.getElementById('detail-created'),
    btnLogout:     document.getElementById('btn-logout'),
};

function formatDate(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleDateString('id-ID', {
        day:   '2-digit',
        month: 'long',
        year:  'numeric',
    });
}

function getStatusLabel(status) {
    const map = {
        aktif:    'Aktif',
        lulus:    'Lulus',
        pindah:   'Pindah',
        nonaktif: 'Nonaktif',
    };
    return map[status] || status;
}

function applyStatus(status) {
    const normalized = (status || 'nonaktif').toLowerCase();
    el.statusBadge.className = `student-badge status-${normalized}`;
    el.badgeLabel.textContent = getStatusLabel(normalized);
}

function getInitialsAvatar(nama) {
    const parts = (nama || 'S').trim().split(' ');
    const initials = parts.length >= 2
        ? parts[0][0] + parts[1][0]
        : parts[0].slice(0, 2);
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0F1F3D';
    ctx.fillRect(0, 0, 120, 120);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 44px Sora, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials.toUpperCase(), 60, 62);
    return canvas.toDataURL('image/png');
}

function setPhotoSrc(foto, nama) {
    if (foto && foto.length > 100) {
        const src = foto.startsWith('data:') ? foto : `data:image/jpeg;base64,${foto}`;
        el.studentPhoto.src = src;
    } else if (foto && foto.startsWith('http')) {
        el.studentPhoto.src = foto;
    } else {
        el.studentPhoto.src = getInitialsAvatar(nama);
    }
}

function setTopbarAvatar(foto, nama) {
    if (foto && foto.length > 100) {
        const src = foto.startsWith('data:') ? foto : `data:image/jpeg;base64,${foto}`;
        el.topbarAvatar.innerHTML = `<img src="${src}" alt="${nama}" loading="lazy">`;
    } else if (foto && foto.startsWith('http')) {
        el.topbarAvatar.innerHTML = `<img src="${foto}" alt="${nama}" loading="lazy">`;
    }
}

function renderProfile(data) {
    setPhotoSrc(data.foto_profil, data.nama_lengkap);
    setTopbarAvatar(data.foto_profil, data.nama_lengkap);

    el.topbarName.textContent = data.nama_lengkap || '-';
    el.studentName.textContent = data.nama_lengkap || '-';
    el.studentNisn.textContent = `NISN: ${data.nisn || '-'}`;

    el.metaKelas.querySelector('span').textContent   = data.kelas   || '-';
    el.metaJurusan.querySelector('span').textContent = data.jurusan || '-';

    applyStatus(data.status);

    el.detailNama.textContent    = data.nama_lengkap || '-';
    el.detailNisn.textContent    = data.nisn         || '-';
    el.detailGender.textContent  = data.gender       || '-';
    el.detailKelas.textContent   = data.kelas        || '-';
    el.detailJurusan.textContent = data.jurusan      || '-';
    el.detailTlpn.textContent    = data.no_tlpn      || '-';
    el.detailStatus.textContent  = getStatusLabel(data.status);
    el.detailCreated.textContent = formatDate(data.created_at);
}

function showContent() {
    el.skeleton.classList.add('hidden');
    el.content.classList.remove('hidden');
}

function showError() {
    el.skeleton.classList.add('hidden');
    el.errorState.classList.remove('hidden');
}

async function fetchFreshData(id) {
    const res = await fetch(`/api/data/siswa/${id}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
}

async function init() {
    const role = sessionStorage.getItem(STORAGE_ROLE);
    const raw  = sessionStorage.getItem(STORAGE_USER);

    if (role !== 'siswa' || !raw) {
        window.location.href = '/auth';
        return;
    }

    let userData;
    try {
        userData = JSON.parse(raw);
    } catch {
        showError();
        return;
    }

    const params  = new URLSearchParams(window.location.search);
    const queryId = params.get('id');
    const id      = queryId || userData.id;

    if (!id) {
        showError();
        return;
    }

    try {
        const fresh = await fetchFreshData(id);
        if (fresh) {
            sessionStorage.setItem(STORAGE_USER, JSON.stringify(fresh));
            renderProfile(fresh);
        } else {
            renderProfile(userData);
        }
        showContent();
    } catch {
        renderProfile(userData);
        showContent();
    }
}

el.btnLogout.addEventListener('click', () => {
    sessionStorage.removeItem(STORAGE_ROLE);
    sessionStorage.removeItem(STORAGE_USER);
    window.location.href = '/auth';
});

init();