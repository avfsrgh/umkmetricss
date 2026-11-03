# ARCHITECTURE.md — UMKMetrics (Supabase)

## Gambaran Umum

**UMKMetrics** adalah platform analitik kesehatan organisasi untuk UMKM. Pemilik UMKM dan pegawainya mengisi formulir penilaian **6 faktor kesehatan organisasi** (OH-Index), lalu aplikasi menampilkan skor, dashboard, dan perbandingan antar UMKM.

Backend sepenuhnya dijalankan oleh **Supabase** (Auth + PostgreSQL). **Tidak ada server PHP**: frontend statis memanggil Supabase langsung.

---

## Struktur Direktori

```
UMKMetrics-Main/
├── supabase/
│   └── setup.sql         # SATU file: tabel, RLS, trigger, fungsi (paste ke SQL Editor)
├── html/index.html       # Frontend (memuat ../js dan ../css)
├── Frontend/             # Varian frontend mandiri (root = folder ini)
├── js/
│   ├── api.js            # Klien Supabase (Auth + RPC) — antarmuka AuthAPI/FormAPI/DashboardAPI
│   ├── auth.js           # Login / register / logout
│   ├── form.js           # Formulir 6 faktor & validasi sisi klien
│   └── main.js           # View router + Chart.js dashboard
├── css/                  # auth.css, main.css
└── _legacy_php_mysql/    # Backend PHP + MySQL lama (tidak dipakai lagi)
```

---

## Arsitektur Sistem

```
Browser (HTML/JS statis)
   │  supabase-js (HTTPS, JWT dari Supabase Auth)
   ▼
Supabase
 ├── Auth ............ email + password, sesi & refresh token otomatis
 ├── Postgres
 │    ├── profiles ........ profil user (dibuat otomatis oleh trigger saat daftar)
 │    ├── submissions ..... hasil penilaian + skor 6 faktor
 │    ├── answers ......... jawaban per pertanyaan
 │    ├── validation_log .. log error/warning validasi
 │    └── factor_definitions / question_definitions (referensi)
 └── Fungsi SQL (RPC)
      ├── check_registration(umkm_name, role)  — cegah Owner ganda (boleh anon)
      ├── submit_questionnaire(answers)        — validasi + skor + simpan
      ├── dashboard_stats()                    — agregat dashboard
      ├── umkm_list(limit, offset, search)     — tabel UMKM + skor
      └── factor_averages()                    — rata-rata per faktor
```

### Keamanan
- **Row Level Security aktif** di semua tabel; user hanya bisa *membaca* datanya sendiri. Tidak ada policy tulis — penulisan hanya lewat fungsi `SECURITY DEFINER` yang memvalidasi `auth.uid()`.
- Data agregat lintas UMKM hanya bisa diambil lewat fungsi RPC oleh user yang sudah login.
- Aturan bisnis (satu kuesioner per akun, satu Owner per UMKM, Pegawai baru bisa mengisi setelah Owner) ditegakkan di database, bukan hanya di frontend.
- `anon key` di frontend aman untuk publik. **Jangan pernah** memakai `service_role` key di frontend.

---

## Setup (3 langkah)

1. **Database:** Supabase Dashboard → SQL Editor → tempel seluruh `supabase/setup.sql` → Run.
2. **Auth:** Authentication → Providers → Email → matikan **Confirm email** (agar user langsung masuk setelah daftar).
3. **Hubungkan frontend:** buka `html/index.html` lewat web server statis (mis. `npx serve .` dari root project lalu buka `/html/`). Saat pertama kali dibuka, tempel **Project URL** dan **anon key** (Project Settings → API) di layar setup — tidak perlu mengedit kode. Untuk deploy publik, isi `SUPABASE_URL` / `SUPABASE_ANON_KEY` di `js/api.js` agar pengunjung tidak diminta.

---

## 6 Faktor Kesehatan Organisasi (OH-Index)

Penilaian menggunakan **33 pertanyaan** yang dikelompokkan ke dalam 6 faktor:

| Kode  | Nama Faktor              | Kode Pertanyaan    | Skala Maks |
|-------|--------------------------|--------------------|:----------:|
| `INS` | Institutional (Kelembagaan) | OH-1 s/d OH-6  | 3          |
| `OV`  | Organizational Values    | OH-18 s/d OH-25    | 5          |
| `LDI` | Leadership & Decision    | OH-7 s/d OH-12     | 5          |
| `WEQ` | Workforce Equity         | OH-13 s/d OH-17    | 5          |
| `OPS` | Operational Systems      | OH-26 s/d OH-31    | 5          |
| `ECT` | External & Compliance    | OH-32 s/d OH-35    | 5          |

Skor tiap faktor dinormalisasi ke skala 0–5, kemudian digabungkan menjadi **skor komposit** dan dikategorikan sebagai label kesehatan organisasi (health_category).

---

## Alur Data Utama

### Submit Penilaian (Owner)
```
form.js validasi client-side → FormAPI.submit → RPC submit_questionnaire
  → validasi & hitung skor 6 faktor + komposit (di database)
  → INSERT submissions, answers, validation_log
  → kembalikan skor + kategori ke frontend → dashboard
```

### Submit Penilaian (Pegawai)
```
(sama seperti Owner, role = employee)
  → butuh Owner UMKM yang sama sudah mengisi (validation_pass = 1)
  → skor OV/LDI/WEQ dirata-rata dari semua pegawai UMKM tsb
  → skor komposit submission Owner diperbarui (status = validated)
```

---

## Teknologi

| Layer      | Teknologi                                   |
|------------|---------------------------------------------|
| Frontend   | HTML, Vanilla JS, CSS                       |
| Charting   | Chart.js 4.4.1 (CDN)                        |
| Backend    | Supabase (Auth, PostgreSQL, fungsi SQL/RPC) |
| Klien      | supabase-js 2.45.4 (CDN)                    |
| Hosting    | Hosting statis apa pun (Netlify, Vercel, GitHub Pages, dll.) |
