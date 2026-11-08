# Revisión funcional de CubeControl de escritorio

La Ayuda (`F1`) reúne 37 temas en 13 capítulos, en español e inglés. Puedes buscar una función, recorrer un capítulo o seguir el recorrido completo. El progreso se guarda en el equipo. El recorrido lleva a los controles disponibles y no ejecuta por ti acciones como escribir un preset, activar una captura o grabar un video.

| Capítulo | Funciones cubiertas |
| --- | --- |
| Conexión y primeros pasos | Detección USB, acceso a la biblioteca sin pedal, aviso de seguridad, idioma y desconexión |
| Editor y presets | A/B/C, diales y bloques de efectos, historial, guardar y copiar |
| Tempo y señal | BPM, Tap, división del delay, metrónomo, analizador y animación opcional del cubo |
| Afinador | Entrada, rango, referencia A4, modos cromático, guitarra y octavas |
| Banco y pedal | Exportar y restaurar el banco, comparar, igualar niveles, copiar, cargar un IR y restablecer el aviso |
| Tonos | Búsqueda, filtros, favoritos, guardar, editar, aplicar, compartir y eliminar |
| Canciones | Tono, BPM, división, IR opcional, aplicar, asignar, compartir y eliminar |
| Shows y repertorios | Ordenar canciones, preparar los slots del pedal y exportar el repertorio con sus recursos |
| Escenario | Selección de canción, aplicación, asignación y atajos |
| IR y archivos compartidos | WAV locales, historial de respaldos, archivos de CubeControl y packs ZIP |
| Clips | Selección de entradas, encuadre, grabación, pedalera virtual, reproducción y guardado |
| Cuenta y sincronización | Acceso por enlace, sincronización manual, elección inicial y tonos duplicados |
| Diagnóstico y ayuda | ZIP de diagnóstico, resumen para el reporte, buscador y recorridos |

## Hallazgos corregidos

- La biblioteca deshabilita las acciones que necesitan una pedalera conectada. Buscar, importar y organizar archivos locales sigue disponible.
- En escenario, `Enter` respeta el botón que tiene el foco. El atajo de aplicación actúa desde el escenario, fuera de los controles interactivos y de los diálogos.
- El afinador y el analizador esperan una acción explícita antes de abrir una entrada de audio. Abrir esas pantallas desde la ayuda no solicita acceso al micrófono.
- Un solo botón abre los archivos compartidos y los packs ZIP. Los fallos al elegir o leer el archivo se muestran en la biblioteca. El reporte también muestra los errores al intentar abrir la carpeta de diagnóstico.

## Alcance de la validación

En el renderizador de escritorio con dispositivo simulado se comprobó que los 37 temas abren y resaltan su control, el recorrido avanza entre capítulos y la búsqueda en español admite palabras sin tilde. También se comprobaron el inicio y la detención de la entrada de audio con una señal simulada, los atajos de escenario, un error al abrir un archivo y el bloqueo de las acciones en vivo sin pedal.

En Clips se probó una toma con cámara y audio simulados, el cambio al editor durante la grabación, la vista previa vertical y la reproducción del MP4 exportado con pistas de video y audio. Pasaron también las 83 pruebas automatizadas y la compilación de escritorio.

Para dar por verificado el comportamiento con equipo real faltan una prueba con un CUBE Baby (presets, restauración de banco y escritura y lectura de IR), una toma con la cámara y la entrada de audio reales, y un ciclo de acceso y sincronización con dos clientes en una cuenta de prueba.

La revisión de código detectó además un riesgo en la [lectura incremental de Supabase](../packages/library-sync/src/supabase/remote.ts): consulta cuatro tablas por separado y avanza un cursor común al mayor número leído. Si cambia una tabla ya consultada antes de que otra devuelva un cambio posterior, el primer cambio puede quedar detrás del cursor. Las consultas tampoco paginan explícitamente. La validación de la nube debe cubrir cambios simultáneos y bibliotecas que superen una página.
