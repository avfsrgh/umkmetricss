<?php
// ── Database: Supabase (PostgreSQL) ───────────────────────────
// Ambil dari Supabase Dashboard > Connect > Connection string.
//  • Direct connection : db.<project-ref>.supabase.co : 5432  (user: postgres)
//  • Session pooler    : aws-0-<region>.pooler.supabase.com : 5432 (user: postgres.<project-ref>)  ← disarankan jika hosting hanya IPv4
//  • Transaction pooler: aws-0-<region>.pooler.supabase.com : 6543 (user: postgres.<project-ref>)
define('DB_HOST',    getenv('DB_HOST')    ?: 'db.YOUR_PROJECT_REF.supabase.co');
define('DB_PORT',    getenv('DB_PORT')    ?: '5432');
define('DB_NAME',    getenv('DB_NAME')    ?: 'postgres');
define('DB_USER',    getenv('DB_USER')    ?: 'postgres');
define('DB_PASS',    getenv('DB_PASS')    ?: '');
define('DB_SSLMODE', getenv('DB_SSLMODE') ?: 'require');   // Supabase mewajibkan SSL
define('DB_TIMEZONE', getenv('DB_TIMEZONE') ?: 'Asia/Jakarta');
define('APP_ENV',    getenv('APP_ENV')    ?: 'development');
define('APP_DEBUG',  APP_ENV === 'development');
define('CORS_ORIGIN', getenv('CORS_ORIGIN') ?: '*');
define('JWT_SECRET', getenv('JWT_SECRET')   ?: 'NexaUMKM_JWT_Secret_Key_2026_XYZ');
define('JWT_EXPIRE', 60 * 60 * 8);
define('PAGE_LIMIT_DEFAULT', 15);
define('PAGE_LIMIT_MAX',    100);
