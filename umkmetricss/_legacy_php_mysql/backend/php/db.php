<?php
require_once __DIR__ . '/config.php';

/**
 * Wrapper PDO untuk Supabase (PostgreSQL).
 *
 * Catatan:
 *  - execute() pada INSERT otomatis menambahkan "RETURNING id" dan
 *    mengembalikan id baris baru (pengganti lastInsertId MySQL).
 *  - Untuk UPDATE/DELETE, execute() mengembalikan jumlah baris terpengaruh.
 *  - Jika memakai Transaction pooler (port 6543), prepared statement
 *    server-side tidak didukung → emulate prepares dinyalakan otomatis.
 */
class DB {
    private static ?PDO $pdo = null;

    public static function pdo(): PDO {
        if (self::$pdo === null) {
            $dsn = "pgsql:host=" . DB_HOST . ";port=" . DB_PORT
                 . ";dbname=" . DB_NAME . ";sslmode=" . DB_SSLMODE;
            $viaTxPooler = (string)DB_PORT === '6543';
            $opts = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => $viaTxPooler,
            ];
            try {
                self::$pdo = new PDO($dsn, DB_USER, DB_PASS, $opts);
                self::$pdo->exec("SET TIME ZONE '" . DB_TIMEZONE . "'");
            } catch (PDOException $e) {
                http_response_code(503);
                echo json_encode(['success'=>false,'message'=>APP_DEBUG ? 'DB error: '.$e->getMessage() : 'Service unavailable.']);
                exit;
            }
        }
        return self::$pdo;
    }

    public static function fetchAll(string $sql, array $p = []): array {
        $s = self::pdo()->prepare($sql);
        self::run($s, $p);
        return $s->fetchAll();
    }

    public static function fetchOne(string $sql, array $p = []): ?array {
        $s = self::pdo()->prepare($sql);
        self::run($s, $p);
        return $s->fetch() ?: null;
    }

    public static function execute(string $sql, array $p = []): int {
        $isInsert = (bool)preg_match('/^\s*INSERT\s/i', $sql);
        if ($isInsert && !preg_match('/\sRETURNING\s/i', $sql)) {
            $sql = rtrim(rtrim($sql), ';') . ' RETURNING id';
        } else {
            $isInsert = false;
        }
        $s = self::pdo()->prepare($sql);
        self::run($s, $p);
        if ($isInsert) {
            $id = $s->fetchColumn();
            return $id !== false ? (int)$id : $s->rowCount();
        }
        return $s->rowCount();
    }

    /** Bind parameter dengan tipe yang benar (int/null/string) lalu eksekusi. */
    private static function run(PDOStatement $s, array $p): void {
        foreach (array_values($p) as $i => $v) {
            $type = is_int($v)  ? PDO::PARAM_INT
                  : (is_null($v) ? PDO::PARAM_NULL
                  : (is_bool($v) ? PDO::PARAM_BOOL : PDO::PARAM_STR));
            $s->bindValue($i + 1, $v, $type);
        }
        $s->execute();
    }
}
