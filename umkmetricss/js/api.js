/**
 * UMKMetrics — Frontend API Client (Supabase)
 *
 * Frontend memanggil Supabase LANGSUNG (tanpa PHP / server sendiri):
 *   • Login & daftar  -> Supabase Auth
 *   • Submit / dashboard -> fungsi SQL (RPC) yang dibuat oleh supabase/setup.sql
 *
 * Antarmuka (AuthAPI, FormAPI, DashboardAPI) sama seperti versi PHP, sehingga
 * auth.js, form.js, dan main.js tidak perlu diubah.
 *
 * KONFIGURASI: ada 2 cara (pilih salah satu)
 *   A) Isi SUPABASE_URL & SUPABASE_ANON_KEY di bawah ini, ATAU
 *   B) Biarkan kosong: saat aplikasi dibuka pertama kali akan muncul layar
 *      setup untuk menempelkan URL & anon key (disimpan di browser).
 * Anon key BOLEH publik; keamanan dijaga oleh RLS di database.
 * JANGAN pernah memakai service_role key di sini.
 */
const SUPABASE_URL      = 'https://nzddckxcxridpqigrqzc.supabase.co';   // contoh: https://abcdefgh.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56ZGRja3hjeHJpZHBxaWdycXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3MDE3NzUsImV4cCI6MjEwOTI3Nzc3NX0.DYq_9TpkKrHK7NqhIsnoL9zcHb3fc4fEclNA4Tp4f54';   // Project Settings > API > anon / publishable key

// ── Konfigurasi & client ──────────────────────────────────────
const _CFG_KEY = 'nexa_supabase_cfg';
function _loadConfig() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) return { url: SUPABASE_URL, key: SUPABASE_ANON_KEY };
  try {
    const c = JSON.parse(localStorage.getItem(_CFG_KEY) || 'null');
    if (c && c.url && c.key) return c;
  } catch (e) { /* abaikan */ }
  return null;
}

const _cfg = _loadConfig();
let sb = null;
if (_cfg && window.supabase && typeof window.supabase.createClient === 'function') {
  sb = window.supabase.createClient(_cfg.url, _cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
}

// Layar setup jika belum dikonfigurasi
function _showSetupScreen() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.92);display:flex;align-items:center;justify-content:center;padding:20px;font-family:Plus Jakarta Sans,system-ui,sans-serif';
  wrap.innerHTML = `
    <div style="background:#fff;max-width:460px;width:100%;border-radius:16px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,.4)">
      <h2 style="margin:0 0 6px;font-size:20px;color:#0f172a">Hubungkan ke Supabase</h2>
      <p style="margin:0 0 18px;font-size:13px;color:#64748b;line-height:1.5">
        Tempel <b>Project URL</b> dan <b>anon / publishable key</b> dari Supabase Dashboard →
        Project Settings → API. Disimpan hanya di browser ini.</p>
      <label style="font-size:12px;font-weight:600;color:#334155">Project URL</label>
      <input id="nxCfgUrl" placeholder="https://xxxx.supabase.co" style="width:100%;box-sizing:border-box;margin:4px 0 12px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px">
      <label style="font-size:12px;font-weight:600;color:#334155">Anon / publishable key</label>
      <input id="nxCfgKey" placeholder="eyJ... atau sb_publishable_..." style="width:100%;box-sizing:border-box;margin:4px 0 6px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px">
      <div id="nxCfgErr" style="color:#dc2626;font-size:12px;min-height:18px;margin-bottom:8px"></div>
      <button id="nxCfgSave" style="width:100%;padding:11px;border:0;border-radius:8px;background:#1a56db;color:#fff;font-weight:700;font-size:14px;cursor:pointer">Simpan & Lanjut</button>
    </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('#nxCfgSave').onclick = () => {
    const url = wrap.querySelector('#nxCfgUrl').value.trim().replace(/\/+$/, '');
    const key = wrap.querySelector('#nxCfgKey').value.trim();
    const err = wrap.querySelector('#nxCfgErr');
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url)) { err.textContent = 'Format URL tidak valid (contoh: https://abcdefgh.supabase.co).'; return; }
    if (key.length < 20) { err.textContent = 'Key tidak valid.'; return; }
    let isServiceRole = false;
    try {
      const payload = JSON.parse(atob((key.split('.')[1] || '').replace(/-/g, '+').replace(/_/g, '/')));
      isServiceRole = payload && payload.role === 'service_role';
    } catch (e) { /* bukan JWT (mis. sb_publishable_...) */ }
    if (isServiceRole || /^sb_secret_/i.test(key)) {
      err.textContent = 'Jangan pakai service_role / secret key. Gunakan anon / publishable key.'; return;
    }
    localStorage.setItem(_CFG_KEY, JSON.stringify({ url, key }));
    location.reload();
  };
}
if (!sb) {
  if (!window.supabase) console.error('[UMKMetrics] supabase-js gagal dimuat (cek koneksi / CDN).');
  else if (document.body) _showSetupScreen();
  else document.addEventListener('DOMContentLoaded', _showSetupScreen);
}

// ── Token & user cache (sinkron, untuk cek login saat load) ───
const TokenStore = {
  get()       { return localStorage.getItem('nexa_token'); },
  set(t)      { localStorage.setItem('nexa_token', t); },
  clear()     { localStorage.removeItem('nexa_token'); },
  getUser()   { try { return JSON.parse(localStorage.getItem('nexa_user') || 'null'); } catch { return null; } },
  setUser(u)  { localStorage.setItem('nexa_user', JSON.stringify(u)); },
  clearUser() { localStorage.removeItem('nexa_user'); },
};

// Sinkronkan cache dengan sesi Supabase (refresh token otomatis)
if (sb) {
  sb.auth.onAuthStateChange((event, session) => {
    if (session && session.access_token) {
      TokenStore.set(session.access_token);
    } else if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
      const hadCachedUser = !!TokenStore.getUser();
      TokenStore.clear();
      TokenStore.clearUser();
      // Sesi sudah habis padahal UI mengira masih login -> kembali ke halaman login
      if (hadCachedUser) location.reload();
    }
  });
}

// ── Helper hasil & error ──────────────────────────────────────
function _fail(message, status) {
  return { ok: false, success: false, status: status || 400, message, data: null };
}
const _NOT_CONFIGURED = 'Supabase belum dikonfigurasi.';

function _isNetworkError(err) {
  return err && /failed to fetch|networkerror|network request failed|load failed/i.test(err.message || '');
}

function _authMessage(err) {
  const m = (err.message || '').toLowerCase();
  const code = err.code || '';
  if (code === 'invalid_credentials' || m.includes('invalid login')) return 'Email atau kata sandi salah.';
  if (code === 'email_not_confirmed' || m.includes('not confirmed')) return 'Email belum dikonfirmasi. Cek kotak masuk email Anda.';
  if (code === 'user_already_exists' || m.includes('already registered')) return 'Email sudah terdaftar.';
  if (code === 'weak_password' || m.includes('password should')) return 'Kata sandi terlalu lemah (minimal 6 karakter).';
  if (m.includes('database error saving new user')) return 'Pendaftaran ditolak. Pastikan UMKM ini belum memiliki Owner terdaftar.';
  if (code === 'over_email_send_rate_limit' || m.includes('rate limit')) return 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.';
  return err.message || 'Terjadi kesalahan.';
}

// Panggil fungsi SQL (RPC). Fungsi mengembalikan { ok, message, data, status }.
async function _rpc(fn, args) {
  if (!sb) return _fail(_NOT_CONFIGURED, 500);
  const { data, error } = await sb.rpc(fn, args || {});
  if (error) {
    if (_isNetworkError(error)) throw new Error(error.message);
    const expired = /jwt/i.test(error.message || '');
    return _fail(expired ? 'Sesi berakhir. Silakan login ulang.' : (error.message || 'Terjadi kesalahan server.'),
                 expired ? 401 : 500);
  }
  const r = data || {};
  return {
    ok: !!r.ok, success: !!r.ok,
    status: r.status || (r.ok ? 200 : 400),
    message: r.message || '',
    data: r.data === undefined ? null : r.data,
  };
}

async function _fetchProfile(uid) {
  const { data, error } = await sb.from('profiles')
    .select('id,umkm_name,email,role,lokasi,sektor,omzet,is_active')
    .eq('id', uid).maybeSingle();
  if (error) { if (_isNetworkError(error)) throw new Error(error.message); return null; }
  return data;
}

function _userPayload(p) {
  return {
    user_id:   p.id,
    role:      p.role,
    email:     p.email,
    umkm_name: p.umkm_name,
    lokasi:    p.lokasi || '',
    sektor:    p.sektor || '',
    omzet:     p.omzet === undefined ? null : p.omzet,
  };
}

// ── AUTH API ──────────────────────────────────────────────────
const AuthAPI = {
  async register(payload) {
    if (!sb) return _fail(_NOT_CONFIGURED, 500);
    const email = String(payload.email || '').trim().toLowerCase();
    const role  = payload.role || 'owner';
    const name  = String(payload.umkm_name || '').trim();
    const omzet = (payload.omzet === null || payload.omzet === undefined || isNaN(payload.omzet)) ? null : Number(payload.omzet);

    // 1. Cegah Owner ganda untuk UMKM yang sama
    const chk = await _rpc('check_registration', { p_umkm_name: name, p_role: role });
    if (!chk.ok) return _fail(chk.message || 'Data registrasi tidak valid.', 409);

    // 2. Buat akun (profil dibuat otomatis oleh trigger di database)
    const { data, error } = await sb.auth.signUp({
      email,
      password: payload.password,
      options: { data: { umkm_name: name, role, lokasi: payload.lokasi || '', sektor: payload.sektor || '', omzet } },
    });
    if (error) {
      if (_isNetworkError(error)) throw new Error(error.message);
      return _fail(_authMessage(error), error.status || 400);
    }
    // Email sudah terdaftar (Supabase mengembalikan user palsu bila konfirmasi email aktif)
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return _fail('Email sudah terdaftar.', 409);
    }
    if (!data.session) {
      return _fail('Registrasi berhasil. Silakan cek email untuk konfirmasi, lalu login. ' +
                   '(Admin: matikan "Confirm email" di Supabase agar langsung masuk.)', 202);
    }

    const prof = await _fetchProfile(data.user.id);
    const user = prof ? _userPayload(prof)
      : { user_id: data.user.id, role, email, umkm_name: name, lokasi: payload.lokasi || '', sektor: payload.sektor || '', omzet };
    TokenStore.set(data.session.access_token);
    TokenStore.setUser(user);
    return { ok: true, success: true, status: 200, message: 'Registrasi berhasil.', data: user };
  },

  async login(payload) {
    if (!sb) return _fail(_NOT_CONFIGURED, 500);
    const email = String(payload.email || '').trim().toLowerCase();
    const { data, error } = await sb.auth.signInWithPassword({ email, password: payload.password || '' });
    if (error) {
      if (_isNetworkError(error)) throw new Error(error.message);
      return _fail(_authMessage(error), 401);
    }

    const prof = await _fetchProfile(data.user.id);
    if (!prof) { await sb.auth.signOut(); return _fail('Profil akun tidak ditemukan.', 404); }
    if (prof.is_active === false) { await sb.auth.signOut(); return _fail('Akun tidak aktif. Hubungi admin.', 403); }
    if (payload.role && payload.role !== prof.role) {
      await sb.auth.signOut();
      return _fail(`Akun ini terdaftar sebagai ${prof.role}, bukan ${payload.role}.`, 403);
    }

    const user = _userPayload(prof);
    TokenStore.set(data.session.access_token);
    TokenStore.setUser(user);
    return { ok: true, success: true, status: 200, message: 'Login berhasil.', data: user };
  },

  logout() {
    TokenStore.clear();
    TokenStore.clearUser();
    if (sb) sb.auth.signOut().catch(() => {});
  },

  getUser()    { return TokenStore.getUser(); },
  isLoggedIn() { return !!TokenStore.get(); }
};

// ── FORM API ──────────────────────────────────────────────────
const FormAPI = {
  async submit(answers) {
    return _rpc('submit_questionnaire', { p_answers: answers || {} });
  }
};

// ── DASHBOARD API ─────────────────────────────────────────────
const DashboardAPI = {
  async getStats()   { return _rpc('dashboard_stats'); },
  async getUmkmList(opts) {
    opts = opts || {};
    return _rpc('umkm_list', {
      p_limit:  opts.limit  || 15,
      p_offset: opts.offset || 0,
      p_search: opts.q      || '',
    });
  },
  async getFactorAverages() { return _rpc('factor_averages'); },
  async getMe() {
    if (!sb) return _fail(_NOT_CONFIGURED, 500);
    const { data } = await sb.auth.getUser();
    if (!data || !data.user) return _fail('Tidak terautentikasi. Silakan login.', 401);
    const prof = await _fetchProfile(data.user.id);
    return prof ? { ok: true, success: true, status: 200, message: '', data: _userPayload(prof) }
                : _fail('Profil tidak ditemukan.', 404);
  }
};
