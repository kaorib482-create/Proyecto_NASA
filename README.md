# AgroPlant — diseño campo claro y mapa sin errores 403

**Instalación más segura si ya tenías la base conectada:** usa el ZIP `AgroPlant_Parche_Diseno_Mapa.zip`; solo sustituye `index.html`, `css/estilos.css` y `js/app.js` en tu carpeta actual. No alteres `api/config.php` ni reinstales MariaDB.

**Para abrir la aplicación completa:** Apache encendido en XAMPP, MariaDB independiente en marcha y navegador en `http://localhost/agroplant/index.html`. No abras el HTML directamente desde Descargas para trabajar con la base.

El mapa usa geometrías INEGI y un fondo visual propio en vez de mosaicos de OpenStreetMap que pueden mostrar errores 403. Lee `CAMBIOS_DEL_MAPA.md` para los detalles.

---

# AgroPlant · NASA Space Apps Challenge 2026

**Plataforma agrícola en HTML + CSS + JavaScript + PHP + MariaDB**. No requiere Python, pip ni ejecutar `.bat`.

## 1. Abrirla de inmediato

Puedes abrir **`index.html`** con doble clic para revisar el diseño y buscar los cultivos ya incorporados. La vista local usa el mapa de respaldo aproximado y, cuando el navegador permite la conexión, puede consultar el pronóstico de Open-Meteo.

**Para funciones completas** (MariaDB, municipios INEGI, consultas NASA POWER y guardar análisis), debes servir el mismo `index.html` con Apache/PHP. Un HTML abierto como `file://` no puede acceder de forma segura a MariaDB ni ejecutar PHP por sí solo.

## 2. Instalar en Windows con XAMPP + MariaDB

1. Instala XAMPP con PHP 8.1+ y MariaDB/MySQL, desde <https://www.apachefriends.org/>.
2. Descomprime esta carpeta dentro de `C:\xampp\htdocs\agroplant\` de modo que exista `C:\xampp\htdocs\agroplant\index.html`.
3. Abre **XAMPP Control Panel** e inicia **solo Apache** si ya tienes MariaDB 12.3 independiente en el puerto 3306. **No inicies MySQL de XAMPP**, porque generaría un conflicto de puerto.
4. Entra a **http://localhost/phpmyadmin/**.
5. Abre la pestaña **SQL** e inserta el contenido de `database/00_crear_base.sql` (crea `agroplant_db`).
6. Selecciona la base `agroplant_db` en phpMyAdmin; ejecuta/importa **en este orden**:
   - `database/01_estructura.sql` (tablas)
   - `database/02_datos.sql` (32 estados, 90 cultivos, 90 enlaces Google Imágenes)
   - `database/03_comprobar.sql` (verifica conteos)
7. Como usas MariaDB independiente, edita `api/config.php`: host `127.0.0.1`, puerto `3306`, base `agroplant_db`, usuario y contraseña reales de tu MariaDB. No subas contraseñas a repositorios.
8. Comprueba **http://localhost/agroplant/api/probar_conexion.php**. Debe devolver `"conexion": true`. Luego abre **http://localhost/agroplant/index.html**.
9. Para comprobar la conexión, visita **http://localhost/agroplant/api/index.php?a=status**. Debería indicar `"mariadb":true`.

> No hace falta Python, ni instalar Visual C++ Build Tools, ni ejecutar `.bat`. Evita desactivar Smart App Control de Windows.

### Si Apache usa otro puerto

Abre, por ejemplo, `http://localhost:8080/agroplant/index.html` si cambiaste el puerto de Apache a `8080`.

### Si no conecta MariaDB

Comprueba que MariaDB 12.3 está iniciado como servicio de Windows, que creaste la base, y que en `api/config.php` se indican el host, puerto, usuario y contraseña correctos. Confirma que las extensiones `pdo_mysql` y `curl` están habilitadas en PHP. En XAMPP suelen venir instaladas.

## 3. Cómo lo usa un agricultor

1. Elige un cultivo escribiendo su nombre.
2. Selecciona cuándo piensa sembrar.
3. Elige un estado y espera a que aparezca la lista de municipios de INEGI. También puede acercar el mapa y elegir un municipio tocándolo.
4. Toca su parcela (punto) en el mapa y comprueba el clima y el pronóstico de cinco días.
5. Indica qué sembró antes, tipo de tierra, disponibilidad de agua y prioridad.
6. Pulsa **«Revisar mi siembra»** para comparar su cultivo, tres alternativas y tres estrategias de rotación.
7. En las tarjetas de cultivos puede abrir las fotografías encontradas en **Google Imágenes**. Las miniaturas de la página se solicitan a Wikipedia/Wikimedia cuando están disponibles y deben respetar la autoría y licencia indicada en su fuente.

Si no aparece el cultivo, **«¿No encuentras tu cultivo?»** permite registrarlo en MariaDB. No se le inventa un porcentaje sin parámetros suficientes.

## 4. Qué se actualiza y de dónde viene

| Elemento | Proveedor | Frecuencia / alcance |
|---|---|---|
| Temperatura, lluvia, humedad del aire, viento | Open-Meteo | Modelo actualizado; caché local de 15 minutos |
| Pronóstico próximo | Open-Meteo | Cinco días a partir de hoy |
| Colores regionales del mapa | Open-Meteo | Un punto de referencia por entidad, **no** promedio de todo un estado; caché de 25 minutos |
| Radar reciente de lluvia | RainViewer | Últimos fotogramas disponibles (no necesariamente toda la República); no es NASA |
| Capa NASA de precipitación | NASA GPM IMERG vía GIBS WMS | Observación con retraso de publicación; se intenta mostrar una fecha anterior, sin garantizar disponibilidad de cada tesela |
| Evaluación climática del mes de siembra | NASA POWER climatology API | Promedio histórico mensual por coordenadas, **no pronóstico exacto de la fecha futura**; caché 24 horas |
| Estados y municipios | INEGI Catálogo Único | Geometrías oficiales solicitadas bajo demanda y almacenadas en caché una semana |
| Fotos de cultivos | Wikipedia/Wikimedia | Miniatura enlazada al artículo, cuando está disponible |
| Búsquedas de fotografías | Google Imágenes | Se guarda la **URL de búsqueda**, no se extraen ni copian imágenes de Google |

Se conservan las fuentes NASA **SMAP, Landsat, ECOSTRESS, SRTM** y demás recursos del desafío como fuentes para próximas ampliaciones; **no se afirma que todos estén integrados**. Actualmente el análisis funcional usa POWER y la capa de precipitación usa GPM/GIBS si el servicio responde.

## 5. Límites honestos del prototipo

- El **0–100** es un índice *heurístico y no calibrado* de compatibilidad; no es una probabilidad estadística de éxito de cosecha. Los umbrales y rangos iniciales de 18 cultivos son orientativos, sujetos a revisión agronómica local.
- Se incluyen **90 cultivos** para búsquedas y fotos; los que carecen de requerimientos revisados quedan clasificados como **«Sin datos suficientes»**, no reciben porcentaje inventado.
- El análisis usa climatología del **mes** elegido, no puede prometer el tiempo que habrá un día futuro en específico.
- Aunque se muestre una capa de meteorología regional, el clima varía dentro de cada estado y municipio. El mapa permite elegir un punto de la parcela.
- El mapa intenta usar fronteras de INEGI; si falla, el respaldo estatal es **aproximado**, identificado como tal. Los límites municipales **no se falsifican**: si INEGI está fuera de servicio, el selector lo avisa.
- La descarga de municipios ocurre **por estado**, no se incluyen sus más de 2,000 geometrías en el ZIP; cuando están disponibles, se incorporan a MariaDB automáticamente.
- Las recomendaciones NO estiman rendimiento, ingreso ni fecha exacta de cosecha; faltan variedad, suelo medido, plagas, manejo, riego efectivo y mercado.
- Es un prototipo **local de hackathon** sin autenticación multiusuario ni controles contra abuso; para desplegarlo públicamente añade autenticación, roles y límites de peticiones, además de revisión de seguridad.
- Las dependencias CDN (Leaflet), servicios en línea, fotografías e imágenes NASA requieren conexión a Internet.

## 6. Estructura

```
agroplant/
 ├── index.html                 <- el HTML principal
 ├── css/estilos.css           <- tonos verdes, oliva, arena y mostaza
 ├── js/app.js                 <- buscador, mapa, capas, clima y resultados
 ├── js/catalogo.js            <- catálogo de respaldo para vista HTML
 ├── js/mapa_respaldo.js       <- geometría estatal provisional, aproximada
 ├── api/index.php             <- API PHP y conexión segura con MariaDB
 ├── api/config.php            <- credenciales locales editables
 ├── data/catalogo_completo.json
 ├── database/00_crear_base.sql
 ├── database/01_estructura.sql
 ├── database/02_datos.sql
 ├── database/03_comprobar.sql
 └── cache/                    <- respuestas externas temporales
```

## 7. Cómo ampliar el catálogo

Los parámetros de cultivo viven en la tabla `cultivos`, las búsquedas en `imagenes_cultivo` y los estados en `estados`. Puedes usar SQL y phpMyAdmin para añadir rangos revisados a nuevos cultivos. Las miniaturas Wikimedia se recuperan automáticamente cuando el proveedor está disponible y se almacenan en el campo `url_imagen`. Los enlaces de Google ya se incluyen en los registros iniciales.

## 8. Enlaces técnicos y créditos

- NASA POWER: <https://power.larc.nasa.gov/docs/services/api/temporal/climatology/>
- NASA GPM / IMERG: <https://gpm.nasa.gov/data/imerg>
- NASA GIBS: <https://nasa-gibs.github.io/gibs-api-docs/access-basics/>
- INEGI geoestadística: <https://www.inegi.org.mx/servicios/catalogounico.html>
- Open-Meteo: <https://open-meteo.com/>
- RainViewer (radar y atribución obligatoria): <https://www.rainviewer.com/api.html>
- OpenStreetMap: <https://www.openstreetmap.org/copyright>

El código del proyecto es un prototipo educativo para el NASA Space Apps Challenge, no producto agrícola validado.
