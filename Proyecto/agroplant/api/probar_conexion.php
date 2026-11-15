<?php
/**
 * AgroPlant: prueba de conexión y de tablas para instalación LOCAL.
 * No imprime usuarios, contraseñas ni detalles internos de la base.
 * El navegador nunca tiene acceso directo a MariaDB.
 */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function responder(array $datos, int $codigo = 200): never {
    http_response_code($codigo);
    echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

if (!extension_loaded('pdo_mysql')) {
    responder([
        'conexion' => false,
        'mensaje' => 'PHP no tiene habilitada la extensión pdo_mysql.',
        'solucion' => 'En XAMPP, habilita extension=pdo_mysql en php.ini y reinicia Apache.'
    ], 503);
}

$config = require __DIR__ . '/config.php';
try {
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $config['db_host'], (int) $config['db_port'], $config['db_name']
    );
    $conexion = new PDO($dsn, $config['db_user'], $config['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => 5
    ]);
    $tablas = ['estados', 'municipios', 'cultivos', 'imagenes_cultivo', 'parcelas',
               'historial_siembra', 'fuentes', 'analisis', 'estrategias_rotacion', 'ciclos_rotacion'];
    $resultado = [];
    foreach ($tablas as $tabla) {
        try {
            $total = $conexion->query("SELECT COUNT(*) FROM `$tabla`")->fetchColumn();
            $resultado[$tabla] = (int) $total;
        } catch (PDOException $e) {
            $resultado[$tabla] = 'Falta importar esta tabla';
        }
    }
    $completa = !in_array('Falta importar esta tabla', $resultado, true);
    responder([
        'conexion' => true,
        'base_de_datos' => $config['db_name'],
        'tablas_completas' => $completa,
        'mensaje' => $completa ? 'AgroPlant conectado a MariaDB.' : 'Conectado. Faltan tablas por importar.',
        'registros' => $resultado
    ]);
} catch (PDOException $e) {
    $codigo = (int) ($e->errorInfo[1] ?? 0);
    if ($codigo === 1045) {
        $explicacion = 'Usuario o contraseña incorrectos. Revisa api/config.php.';
    } elseif ($codigo === 1049) {
        $explicacion = 'La base agroplant_db no existe o tiene otro nombre.';
    } elseif (in_array($codigo, [2002, 2003, 2006], true)) {
        $explicacion = 'No se puede acceder a MariaDB en 127.0.0.1:3306. Comprueba que el servicio esté iniciado.';
    } else {
        $explicacion = 'Comprueba que MariaDB esté iniciado y que los datos de api/config.php sean correctos.';
    }
    responder(['conexion' => false, 'mensaje' => 'No se pudo conectar a MariaDB.', 'solucion' => $explicacion], 503);
}
