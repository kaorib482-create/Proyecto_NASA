USE agroplant_db;
SELECT 'Estados' AS tabla, COUNT(*) AS registros FROM estados
UNION ALL SELECT 'Municipios descargados', COUNT(*) FROM municipios
UNION ALL SELECT 'Cultivos', COUNT(*) FROM cultivos
UNION ALL SELECT 'Fotos y Google links', COUNT(*) FROM imagenes_cultivo
UNION ALL SELECT 'Parcelas', COUNT(*) FROM parcelas
UNION ALL SELECT 'Análisis', COUNT(*) FROM analisis;

SELECT c.nombre AS cultivo, c.familia, i.url_google, i.url_imagen
FROM cultivos c LEFT JOIN imagenes_cultivo i ON c.id=i.id_cultivo
ORDER BY c.nombre LIMIT 30;
SELECT e.nombre AS estado,m.nombre AS municipio
FROM municipios m JOIN estados e ON m.codigo_estado=e.codigo
ORDER BY e.nombre,m.nombre LIMIT 25;
