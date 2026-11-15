# AgroPlant · Actualización de diseño y mapa

## Qué se corrigió
- Diseño claro con crema, salvia, olivo y mostaza.
- El fondo del mapa dejó de consumir mosaicos de OpenStreetMap, fuente que estaba devolviendo mensajes 403.
- Se mantienen los polígonos estatales, la animación al apuntar, el zoom y los municipios INEGI (cuando el servicio devuelve geometrías).
- Las capas opcionales radar y NASA se ocultan al detectar fallos de descarga de imágenes, sin ensuciar el mapa.
- Al abrir el archivo con doble clic, se muestra una indicación para usar Apache si se necesita MariaDB y NASA POWER.

## Instalar actualización sin perder tu MariaDB
1. Cierra AgroPlant en el navegador y haz copia de seguridad de `C:\xampp\htdocs\agroplant`.
2. Extrae el ZIP **PARCHE** en `C:\xampp\htdocs\`. Deben reemplazarse solo estos tres archivos:
    - `agroplant/index.html`
    - `agroplant/css/estilos.css`
    - `agroplant/js/app.js`
3. **No borres ni reemplaces `api/config.php`**, porque contiene la conexión de tu MariaDB actual.
4. Inicia **Apache** desde XAMPP. No inicies MySQL de XAMPP si ya utilizas MariaDB independiente en 3306.
5. Abre `http://localhost/agroplant/index.html` y pulsa `Ctrl + F5` para renovar archivos.

## Qué fuentes se muestran
- **Temperatura, humedad y pronóstico reciente:** Open-Meteo.
- **Límites estatales y municipales:** INEGI. Si falla INEGI, se muestra una división estatal **aproximada**, sin fingir precisión municipal.
- **Datos climáticos históricos para la recomendación:** NASA POWER por la API PHP.
- **Capa satelital opcional:** NASA GIBS/GPM, si la imagen está disponible. No debe confundirse con clima instantáneo.

La compatibilidad agrícola es una **puntuación orientativa**, no probabilidad estadística de cosecha.

## Verificación sin cambiar la base de datos
- `http://localhost/agroplant/api/index.php?a=status` debe devolver `mariadb:true` si tu conexión sigue correcta.
- `http://localhost/agroplant/index.html` abre la interfaz completa.
- La nueva versión no requiere volver a ejecutar scripts SQL.
