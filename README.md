AgroPlant — light countryside design and map without 403 errors

Safest installation if you already had the database connected: use the ZIP AgroPlant_Parche_Diseno_Mapa.zip; it only replaces index.html, css/estilos.css and js/app.js in your current folder. Do not alter api/config.php and do not reinstall MariaDB.

To open the full application: Apache running in XAMPP, standalone MariaDB running, and the browser at http://localhost/agroplant/index.html. Do not open the HTML directly from Downloads if you want to work with the database.

The map uses INEGI geometries and its own visual background instead of OpenStreetMap tiles, which can show 403 errors. Read CAMBIOS_DEL_MAPA.md for details.

AgroPlant · NASA Space Apps Challenge 2026

Agricultural platform in HTML + CSS + JavaScript + PHP + MariaDB. It does not require Python, pip or running .bat files.

1. Open it right away

You can open index.html with a double click to review the design and search the crops already included. The local view uses the approximate fallback map and, when the browser allows the connection, can query the Open-Meteo forecast.

For full functionality (MariaDB, INEGI municipalities, NASA POWER queries and saving analyses), you must serve the same index.html through Apache/PHP. An HTML file opened as file:// cannot securely access MariaDB or run PHP on its own.

2. Install on Windows with XAMPP + MariaDB
Install XAMPP with PHP 8.1+ and MariaDB/MySQL from https://www.apachefriends.org/.
Unzip this folder inside C:\xampp\htdocs\agroplant\ so that C:\xampp\htdocs\agroplant\index.html exists.
Open the XAMPP Control Panel and start only Apache if you already have a standalone MariaDB 12.3 on port 3306. Do not start XAMPP's MySQL, because it would cause a port conflict.
Go to http://localhost/phpmyadmin/.
Open the SQL tab and paste the contents of database/00_crear_base.sql (it creates agroplant_db).
Select the agroplant_db database in phpMyAdmin; run/import in this order:
database/01_estructura.sql (tables)
database/02_datos.sql (32 states, 90 crops, 90 Google Images links)
database/03_comprobar.sql (verifies the counts)
Since you use a standalone MariaDB, edit api/config.php: host 127.0.0.1, port 3306, database agroplant_db, and the real username and password of your MariaDB. Do not upload passwords to repositories.
Check http://localhost/agroplant/api/probar_conexion.php. It should return "conexion": true. Then open http://localhost/agroplant/index.html.
To verify the connection, visit http://localhost/agroplant/api/index.php?a=status. It should report "mariadb":true.

You do not need Python, you do not need to install Visual C++ Build Tools, and you do not need to run .bat files. Avoid turning off Windows Smart App Control.

If Apache uses a different port

Open, for example, http://localhost:8080/agroplant/index.html if you changed Apache's port to 8080.

If MariaDB does not connect

Check that MariaDB 12.3 is running as a Windows service, that you created the database, and that api/config.php has the correct host, port, username and password. Confirm that the pdo_mysql and curl extensions are enabled in PHP. They usually come installed with XAMPP.

3. How a farmer uses it
Choose a crop by typing its name.
Select when they plan to plant.
Choose a state and wait for the list of INEGI municipalities to appear. They can also zoom into the map and choose a municipality by tapping it.
Tap their plot (point) on the map and check the weather and the five-day forecast.
Indicate what they planted before, soil type, water availability and priority.
Press "Revisar mi siembra" ("Check my planting") to compare their crop, three alternatives and three rotation strategies.
On the crop cards they can open the photographs found on Google Images. The thumbnails on the page are requested from Wikipedia/Wikimedia when available, and must respect the authorship and license indicated at their source.

If the crop does not appear, "¿No encuentras tu cultivo?" ("Can't find your crop?") lets the user register it in MariaDB. No percentage is made up for it without sufficient parameters.

4. What gets updated and where it comes from
Element	Provider	Frequency / scope
Temperature, rain, air humidity, wind	Open-Meteo	Updated model; 15-minute local cache
Upcoming forecast	Open-Meteo	Five days starting today
Regional map colors	Open-Meteo	One reference point per state, not an average of the whole state; 25-minute cache
Recent rain radar	RainViewer	Latest available frames (not necessarily the whole country); not NASA
NASA precipitation layer	NASA GPM IMERG via GIBS WMS	Observation with publication delay; an earlier date is attempted, with no guarantee that every tile is available
Climate evaluation of the planting month	NASA POWER climatology API	Monthly historical average by coordinates, not an exact forecast for the future date; 24-hour cache
States and municipalities	INEGI Catálogo Único	Official geometries requested on demand and cached for one week
Crop photos	Wikipedia/Wikimedia	Thumbnail linked to the article, when available
Photo searches	Google Images	The search URL is stored; images from Google are not extracted or copied

The NASA sources SMAP, Landsat, ECOSTRESS, SRTM and other challenge resources are kept as sources for future expansions; it is not claimed that all of them are integrated. Currently, the functional analysis uses POWER, and the precipitation layer uses GPM/GIBS if the service responds.

5. Honest limitations of the prototype
The 0–100 score is a heuristic, uncalibrated compatibility index; it is not a statistical probability of harvest success. The initial thresholds and ranges for 18 crops are indicative and subject to local agronomic review.
90 crops are included for searching and photos; those without reviewed requirements are classified as "Sin datos suficientes" ("Insufficient data") and do not receive a made-up percentage.
The analysis uses the climatology of the month chosen; it cannot promise the weather on a specific future day.
Even when a regional weather layer is shown, the climate varies within each state and municipality. The map lets the user pick a point on their plot.
The map tries to use INEGI borders; if that fails, the state-level fallback is approximate and is identified as such. Municipal boundaries are not faked: if INEGI is down, the selector says so.
Municipalities are downloaded per state; their more than 2,000 geometries are not included in the ZIP, and when available they are added to MariaDB automatically.
The recommendations do NOT estimate yield, income or the exact harvest date; they lack variety, measured soil, pests, management, effective irrigation and market data.
It is a local hackathon prototype with no multi-user authentication or abuse controls; to deploy it publicly, add authentication, roles and request limits, plus a security review.
The CDN dependencies (Leaflet), online services, photographs and NASA images require an Internet connection.
6. Structure
agroplant/
 ├── index.html                 <- the main HTML
 ├── css/estilos.css           <- green, olive, sand and mustard tones
 ├── js/app.js                 <- search, map, layers, weather and results
 ├── js/catalogo.js            <- fallback catalog for the HTML view
 ├── js/mapa_respaldo.js       <- provisional, approximate state geometry
 ├── api/index.php             <- PHP API and secure connection to MariaDB
 ├── api/config.php            <- editable local credentials
 ├── data/catalogo_completo.json
 ├── database/00_crear_base.sql
 ├── database/01_estructura.sql
 ├── database/02_datos.sql
 ├── database/03_comprobar.sql
 └── cache/                    <- temporary external responses
7. How to expand the catalog

Crop parameters live in the cultivos table, searches in imagenes_cultivo and states in estados. You can use SQL and phpMyAdmin to add reviewed ranges to new crops. Wikimedia thumbnails are retrieved automatically when the provider is available and are stored in the url_imagen field. The Google links are already included in the initial records.

8. Technical links and credits
NASA POWER: https://power.larc.nasa.gov/docs/services/api/temporal/climatology/
NASA GPM / IMERG: https://gpm.nasa.gov/data/imerg
NASA GIBS: https://nasa-gibs.github.io/gibs-api-docs/access-basics/
INEGI geostatistics: https://www.inegi.org.mx/servicios/catalogounico.html
Open-Meteo: https://open-meteo.com/
RainViewer (radar and mandatory attribution): https://www.rainviewer.com/api.html
OpenStreetMap: https://www.openstreetmap.org/copyright

The project code is an educational prototype for the NASA Space Apps Challenge, not a validated agricultural product.
