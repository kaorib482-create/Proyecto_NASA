# AgroPlant

Proyecto desarrollado para el evento de la NASA del **14 y 15 de noviembre**, dentro del enfoque **"Cambio de rumbo: adapta granjas con datos de la NASA"**.

## Propósito

AgroPlant ayuda a pequeños productores a adaptar sus cultivos al cambio climático. Con datos de la NASA, avisa con tiempo cuándo el clima pone en riesgo un cultivo (sequía, lluvias fuertes o calor) y propone una alternativa para cada problema encontrado.

## Tipo de aplicación

Sitio web responsivo (funciona en computadora y celular) con:

- Tablero de alertas por cultivo.
- Mapa con la ubicación del cultivo.
- Indicador de porcentaje de éxito según semilla, fecha y zona.

## Funcionalidades

1. Buscador de semillas y estados.
2. Selector de semilla con ficha técnica (ciclo, estación ideal, suelo, agua y temperatura óptima).
3. Selector de fecha de siembra.
4. Mapa de temperatura del estado seleccionado.
5. Pronóstico de los próximos días.
6. Porcentaje de éxito con recomendación práctica.

## Tecnologías implementadas

> Confirma o ajusta esta lista según lo que use el equipo.

| Capa | Tecnología |
|------|------------|
| Frontend | HTML, CSS y JavaScript |
| Backend | PHP |
| Base de datos | MySQL (phpMyAdmin) |
| Servidor local | XAMPP |
| Datos climáticos | NASA POWER API |
| Control de versiones | Git y GitHub |

## Instalación y ejecución

1. Instala [XAMPP](https://www.apachefriends.org/) e inicia **Apache** y **MySQL**.
2. Clona el repositorio dentro de `htdocs`:
   ```bash
   git clone <URL-DEL-REPOSITORIO> C:/xampp/htdocs/agroplant
   ```
3. Crea la base de datos ejecutando el script `database/esquemaBD.sql` (desde phpMyAdmin o la terminal).
4. Revisa los datos de conexión en `config/conexion.php`.
5. Abre en el navegador: `http://localhost/agroplant`

## Estructura del proyecto
#
## Responsables

| Rol | Integrante |
|-----|------------|
| Analista de datos | Jorge |
| Desarrollo del backend | Emiliano |
| Desarrollo del frontend | Uriel |
| Diseño de UI | Kaori |
| Análisis en agronomía | Aldo |
| Especialista en geografía | Luis |

## Acuerdo de integración

- **Ramas:** cada integrante desarrolla su caso de uso en una rama propia y lo integra a `main` mediante *pull request*. Otro integrante del equipo lo revisa antes de fusionar.
- **Base de datos:** tablas y campos en minúsculas con guion bajo. La conexión se reutiliza siempre desde `config/conexion.php`.
- **Cambios a la BD:** se acuerdan entre el equipo y se hacen en `database/esquemaBD.sql`, nunca solo en phpMyAdmin.
- **Sincronización:** `git pull` al iniciar cada sesión y `git push` al terminar.
- **Antes de fusionar:** recrear la BD con el script y comprobar que la aplicación se ejecuta en XAMPP.
- **Conflictos:** se resuelven en la rama local, sin *push* forzado.

## Referencias y evidencias

- NASA POWER: <https://power.larc.nasa.gov/>
- Presentación 