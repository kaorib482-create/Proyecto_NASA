<?php
// Si instalas AgroPlant desde cero, copia este archivo como api/config.php.
// En una instalación existente conserva tu config.php actual.
return [
    'db_host' => getenv('AGROPLANT_DB_HOST') ?: '127.0.0.1',
    'db_port' => (int)(getenv('AGROPLANT_DB_PORT') ?: 3306),
    'db_name' => getenv('AGROPLANT_DB_NAME') ?: 'agroplant_db',
    'db_user' => getenv('AGROPLANT_DB_USER') ?: 'agroplant_app',
    'db_pass' => getenv('AGROPLANT_DB_PASS') ?: 'COLOCA_AQUI_TU_CONTRASENA',
];
