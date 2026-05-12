const state = {
  role: 'admin',
  loading: false,
};

(function checkExistingSession() {
    const role = sessionStorage.getItem('auth_role');
    const raw  = sessionStorage.getItem('auth_user');
    if (!role || !raw) return;
    try {
        JSON.parse(raw);
        if (role === 'admin') { window.location.replace('/dashboard'); return; }
        if (role === 'siswa') {
            const user = JSON.parse(raw);
            window.location.replace(`/siswa?id=${user.id}`);
        }
    } catch { /* invalid session, stay on auth */ }
})();

function switchRole(role) {
  if (state.role === role) return;
  state.role = role;

  const indicator = document.querySelector('.role-indicator');
  const btns = document.querySelectorAll('.role-btn');
  const formAdmin = document.getElementById('form-admin');
  const formSiswa = document.getElementById('form-siswa');

  btns.forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-role="${role}"]`).classList.add('active');

  if (role === 'siswa') {
    indicator.style.transform = 'translateX(calc(100% + 4px))';
    formAdmin.classList.add('hidden');
    formSiswa.classList.remove('hidden');
  } else {
    indicator.style.transform = 'translateX(0)';
    formSiswa.classList.add('hidden');
    formAdmin.classList.remove('hidden');
  }

  clearErrors();
  hideAlert();
}

function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  const icon = btn.querySelector('.material-symbols-rounded');
  if (input.type === 'password') {
    input.type = 'text';
    icon.textContent = 'visibility_off';
  } else {
    input.type = 'password';
    icon.textContent = 'visibility';
  }
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
  document.querySelectorAll('.field-input').forEach(el => el.classList.remove('is-error'));
}

function showError(id, msg) {
  const errEl = document.getElementById(id);
  if (errEl) errEl.textContent = msg;
}

function markFieldError(inputId) {
  const input = document.getElementById(inputId);
  if (input) input.classList.add('is-error');
}

function showAlert(msg) {
  const modal = document.getElementById('error-modal');
  document.getElementById('modal-msg').textContent = msg;
  modal.classList.remove('hidden');
  document.getElementById('modal-close-btn').focus();
}

function hideAlert() {
  document.getElementById('form-alert').classList.add('hidden');
}

function closeModal() {
  const modal = document.getElementById('error-modal');
  modal.classList.add('fade-out');
  setTimeout(() => {
    modal.classList.remove('fade-out');
    modal.classList.add('hidden');
  }, 180);
}

function setLoading(val) {
  state.loading = val;
  const btn = document.getElementById('btn-submit');
  const text = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');

  btn.disabled = val;
  if (val) {
    text.style.opacity = '0';
    loader.classList.remove('hidden');
  } else {
    text.style.opacity = '1';
    loader.classList.add('hidden');
  }
}

function validateAdmin() {
  const username = document.getElementById('admin-username').value.trim();
  const password = document.getElementById('admin-password').value;
  let valid = true;

  if (!username) {
    showError('err-username', 'Username wajib diisi');
    markFieldError('admin-username');
    valid = false;
  }
  if (!password) {
    showError('err-password', 'Password wajib diisi');
    markFieldError('admin-password');
    valid = false;
  } else if (password.length < 6) {
    showError('err-password', 'Password minimal 6 karakter');
    markFieldError('admin-password');
    valid = false;
  }

  return valid ? { username, password } : null;
}

function validateSiswa() {
  const nama = document.getElementById('siswa-nama').value.trim();
  const nisn = document.getElementById('siswa-nisn').value.trim();
  let valid = true;

  if (!nama) {
    showError('err-nama', 'Nama lengkap wajib diisi');
    markFieldError('siswa-nama');
    valid = false;
  }
  if (!nisn) {
    showError('err-nisn', 'NISN wajib diisi');
    markFieldError('siswa-nisn');
    valid = false;
  } else if (!/^\d{8,20}$/.test(nisn)) {
    showError('err-nisn', 'NISN harus berupa angka (8-20 digit)');
    markFieldError('siswa-nisn');
    valid = false;
  }

  return valid ? { nama_lengkap: nama, nisn } : null;
}

async function loginAdmin(payload) {
  const res = await fetch('/api/auth/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function loginSiswa(payload) {
  const result = await fetch(`/api/data/siswa?search=${encodeURIComponent(payload.nama_lengkap)}`, {
    method: 'GET',
  });
  const data = await result.json();

  if (!data.success || !data.data.length) {
    return { success: false, message: 'Data siswa tidak ditemukan' };
  }

  const match = data.data.find(
    s => s.nama_lengkap.toLowerCase() === payload.nama_lengkap.toLowerCase()
      && s.nisn === payload.nisn
  );

  if (!match) return { success: false, message: 'Nama lengkap atau NISN tidak sesuai' };
  return { success: true, data: match };
}

async function handleLogin(e) {
  e.preventDefault();
  if (state.loading) return;

  clearErrors();
  hideAlert();

  let payload = null;
  if (state.role === 'admin') {
    payload = validateAdmin();
  } else {
    payload = validateSiswa();
  }

  if (!payload) return;

  setLoading(true);

  try {
    let result;
    if (state.role === 'admin') {
      result = await loginAdmin(payload);
      if (result.success) {
        sessionStorage.setItem('auth_role', 'admin');
        sessionStorage.setItem('auth_user', JSON.stringify(result.data));
        window.location.href = '/dashboard';
      } else {
        showAlert(result.message || 'Username atau password salah');
      }
    } else {
      result = await loginSiswa(payload);
      if (result.success) {
        sessionStorage.setItem('auth_role', 'siswa');
        sessionStorage.setItem('auth_user', JSON.stringify(result.data));
        window.location.href = `/siswa?id=${result.data.id}`;
      } else {
        showAlert(result.message || 'Data tidak ditemukan');
      }
    }
  } catch (err) {
    showAlert('Koneksi bermasalah. Coba lagi.');
  } finally {
    setLoading(false);
  }
}

document.querySelectorAll('.field-input').forEach(input => {
  input.addEventListener('input', () => {
    input.classList.remove('is-error');
    hideAlert();
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

document.getElementById('error-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});