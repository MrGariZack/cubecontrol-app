import type { Locale } from "../i18n";

type Translation = Readonly<Record<Locale, string>>;
export type GuidePage =
  | "current" | "connect" | "editor" | "device" | "tuner" | "clips"
  | "tones" | "songs" | "shows" | "irs" | "backups" | "packs" | "stage" | "account";

export type GuideStep = {
  readonly id: string;
  readonly page: GuidePage;
  readonly title: Translation;
  readonly body: Translation;
};
export type GuideChapter = {
  readonly id: string;
  readonly title: Translation;
  readonly steps: readonly GuideStep[];
};

const step = (id: string, page: GuidePage, es: string, en: string, esBody: string, enBody: string): GuideStep =>
  ({ id, page, title: { es, en }, body: { es: esBody, en: enBody } });

export const GUIDE: readonly GuideChapter[] = [
  {
    id: "start",
    title: {"es":"Conexión y primeros pasos","en":"Connection and first steps"},
    steps: [
      step("connection", "connect", "Conectar y trabajar sin pedal", "Connect or work offline", "Conecta el CUBE Baby por USB y espera la detección o pulsa Conectar USB. Si no aparece, revisa el cable de datos y vuelve a conectarlo. La biblioteca abre sin pedal.", "Connect the CUBE Baby over USB and wait for detection or choose Connect USB. If it is missing, check the data cable and reconnect it. The library opens without a pedal."),
      step("safety", "connect", "Aviso de seguridad", "Safety notice", "Lee y acepta el aviso al iniciar. Editar en vivo, guardar el banco y escribir un IR tienen efectos distintos. El dispositivo permite volver a mostrar el aviso en el próximo inicio.", "Read and accept the startup notice. Live editing, saving the bank, and writing an IR have different effects. Device settings can show the notice again on the next launch."),
      step("language", "current", "Idioma y desconexión", "Language and disconnect", "Cambia el idioma con el selector. Desconectar vuelve a la pantalla de inicio. Desde el modo biblioteca, Salir de la biblioteca cumple esa misma función.", "Change the language from the selector. Disconnect returns to the startup screen. In library mode, Leave library does the same."),
    ],
  },
  {
    id: "tone",
    title: {"es":"Editor y presets","en":"Editor and presets"},
    steps: [
      step("slots", "editor", "Presets A, B y C", "Presets A, B and C", "Elige un slot en la barra lateral o en la pedalera virtual para recuperar su tono. El LED de cada sección muestra si está activa.", "Choose a slot in the sidebar or on the virtual pedal to recall its tone. Each section LED shows whether that section is enabled."),
      step("amp", "editor", "Amplificador, ganancia, tono y volumen", "Amp, gain, tone and volume", "Arrastra un dial hacia arriba o abajo, o enfócalo y usa las flechas. TYPE elige el amplificador, GAIN cambia la ganancia, TONE el color y VOLUME el nivel.", "Drag a dial up or down, or focus it and use the arrow keys. TYPE selects the amp, GAIN changes drive, TONE changes its color, and VOLUME sets the level."),
      step("effects", "editor", "Gabinete, reverb, delay y modulación", "Cabinet, reverb, delay and modulation", "IR CAB selecciona el gabinete y REVERB añade ambiente. TIME, FB y MIX cambian el tiempo, las repeticiones y la mezcla del delay. MOD va de chorus a phaser con el efecto apagado en el centro.", "IR CAB selects the cabinet and REVERB adds space. TIME, FB and MIX set delay time, repeats and wet level. MOD goes from chorus to phaser with the effect off at the center."),
      step("sections", "editor", "Activar o silenciar bloques", "Toggle effect blocks", "Pulsa el LED o los rótulos de cada bloque. A controla IR y reverb, B modulación y delay, y C amplificador y tono. Pulsar el footswitch del slot ya activo también alterna su bloque.", "Click the LED or labels for a block. A controls IR and reverb, B modulation and delay, and C amp and tone. Pressing the already active footswitch also toggles its block."),
      step("history", "editor", "Deshacer y rehacer", "Undo and redo", "Usa las flechas del historial para recuperar ajustes en vivo. Un cambio en vivo no equivale a guardar el preset en el banco del pedal.", "Use the history buttons to recover live settings. A live change is separate from saving a preset to the pedal bank."),
      step("store", "editor", "Guardar y copiar presets", "Save and copy presets", "Guardar escribe el tono en el slot activo. Copiar a escribe en otro slot. Revisa el destino y confirma, porque se reemplaza el contenido anterior del slot elegido.", "Save writes the tone to the active slot. Copy to writes to another slot. Check the destination and confirm because it replaces the contents of that slot."),
    ],
  },
  {
    id: "tempo",
    title: {"es":"Tempo y señal","en":"Tempo and signal"},
    steps: [
      step("tap", "editor", "Tempo manual y Tap", "Manual tempo and tap tempo", "Escribe los BPM o marca el pulso varias veces con Tap. Úsalo para preparar el delay al ritmo de la canción.", "Enter the BPM or tap the beat several times. Use it to set the delay to the song tempo."),
      step("division", "editor", "División del delay y metrónomo", "Delay subdivision and metronome", "Selecciona una figura para calcular el tiempo del delay a partir del tempo. Activa el metrónomo para escuchar la referencia y apágalo cuando termines.", "Choose a note value to calculate delay time from the tempo. Turn the metronome on to hear the beat and off when finished."),
      step("scope", "editor", "Analizador de señal", "Signal analyzer", "LIVE usa la entrada de audio del sistema para mostrar el espectro. OFF libera la entrada. RUN e IDLE alternan la animación interactiva del cubo sin cambiar el tono.", "LIVE uses the system audio input for the spectrum. OFF releases the input. RUN and IDLE toggle the interactive cube animation without changing the tone."),
    ],
  },
  {
    id: "tuning",
    title: {"es":"Afinador","en":"Tuner"},
    steps: [
      step("tuner-input", "tuner", "Entrada, rango y referencia A4", "Input, range and A4 reference", "Elige el micrófono o interfaz, el rango de guitarra, bajo o amplio y la referencia A4. Inicia la escucha, toca una nota y detenla cuando termines.", "Choose the microphone or interface, guitar, bass or wide range, and the A4 reference. Start listening, play a note and stop when done."),
      step("tuner-modes", "tuner", "Cromático, guitarra y octavas", "Chromatic, guitar and octaves", "Cromático muestra la nota más cercana y su desviación. Guitarra ayuda a afinar EADGBE. Octavas compara la nota con una raíz y permite fijarla, soltarla o dejar que se bloquee al afinar.", "Chromatic shows the closest note and its offset. Guitar helps tune EADGBE. Octaves compares the note with a root you can lock, release, or let the tuner lock automatically."),
    ],
  },
  {
    id: "hardware",
    title: {"es":"Banco y pedalera","en":"Bank and pedal"},
    steps: [
      step("bank", "device", "Exportar o restaurar el banco", "Export or restore the bank", "Exportar guarda A, B y C en JSON. Importar restaura los tres slots desde un banco válido. Haz una copia del banco actual antes de reemplazarlo.", "Export saves A, B and C to JSON. Import restores all three slots from a valid bank file. Export the current bank before replacing it."),
      step("compare", "device", "Comparar, igualar y copiar", "Compare, match levels and copy", "Abre Comparar para ver diferencias entre el tono en vivo y A/B/C. Elige una referencia para igualar volúmenes o copia de un slot a otro desde el diálogo.", "Open Compare to see differences between the live tone and A/B/C. Choose a reference to match volumes, or copy between slots from the dialog."),
      step("load-ir", "device", "Cargar IR y ajustar distancia", "Load IR and set mic distance", "Elige un gabinete y la distancia antes de seleccionar un WAV. Al confirmar, CubeControl respalda el sector y comprueba lo escrito antes de seleccionar ese gabinete.", "Choose a cabinet and mic distance before selecting a WAV. After confirmation, CubeControl backs up the sector and checks what was written before selecting that cabinet."),
      step("reset-safety", "device", "Restablecer el aviso", "Reset the safety notice", "Usa este control si quieres volver a leer y aceptar el aviso la próxima vez que abras CubeControl.", "Use this control to read and accept the notice again the next time you open CubeControl."),
    ],
  },
  {
    id: "library",
    title: {"es":"Tonos de biblioteca","en":"Library tones"},
    steps: [
      step("tone-find", "tones", "Buscar y organizar tonos", "Find and organize tones", "Busca por nombre, etiquetas o notas. Usa los filtros de perfil o favoritos para encontrar tonos de ensayo, directo o grabación.", "Search by name, tags or notes. Use profile and favorites filters to find rehearsal, live or recording tones."),
      step("tone-save", "tones", "Guardar, aplicar y actualizar tonos", "Save, apply and update tones", "Guarda el ajuste en vivo como tono de biblioteca, con nombre, perfil, notas y etiquetas. Selecciona uno para aplicarlo, reemplazarlo con tus ajustes actuales, marcarlo como favorito, compartirlo o eliminarlo.", "Save the live settings as a library tone with a name, profile, notes and tags. Select a tone to apply it, replace it with current settings, favorite it, share it or delete it."),
    ],
  },
  {
    id: "songs",
    title: {"es":"Canciones","en":"Songs"},
    steps: [
      step("song-create", "songs", "Crear o editar una canción", "Create or edit a song", "Vincula un tono guardado con una canción. Añade notas, BPM y división si los necesitas. En el segundo paso puedes asociar un IR y su distancia.", "Link a saved tone to a song. Add notes, BPM and a subdivision if needed. In the second step you can attach an IR and its mic distance."),
      step("song-play", "songs", "Aplicar, asignar y compartir", "Apply, assign and share", "Selecciona la canción para aplicar su tono y tempo, o asignarla a A, B o C. Si lleva un IR, cargarlo requiere confirmación. También puedes compartir la canción o eliminarla.", "Select a song to apply its tone and tempo or assign it to A, B or C. Loading an attached IR requires confirmation. You can also share or delete the song."),
    ],
  },
  {
    id: "shows",
    title: {"es":"Shows y repertorio","en":"Shows and setlists"},
    steps: [
      step("show-build", "shows", "Crear un show y ordenar el repertorio", "Build a show and order the set", "Crea un show, añade canciones y arrástralas para ordenarlas. Pulsa el nombre del show para editarlo y usa Quitar para sacar una canción del repertorio. Puedes eliminar un show desde su ficha.", "Create a show, add songs, and drag them into order. Edit the show name in its title field and choose Remove to take a song off the set. Delete a show from its detail view."),
      step("show-bank", "shows", "Preparar A/B/C", "Prepare A/B/C", "Desde el show, elige qué canción se escribirá en cada slot y confirma. Un slot sin asignación conserva su contenido. Exporta el banco antes si quieres guardar sus presets actuales.", "From the show, choose the song to write to each slot and confirm. An unassigned slot keeps its contents. Export the bank first to keep your current presets."),
      step("show-export", "shows", "Compartir o exportar un show", "Share or export a show", "Compartir crea un archivo de CubeControl con el show y sus dependencias de biblioteca. Exportar ZIP crea un pack de recursos. El botón del show activo en la barra vuelve a la biblioteca.", "Share creates a CubeControl file with the show and its library dependencies. Export ZIP creates an asset pack. The active-show button in the toolbar returns to the library."),
    ],
  },
  {
    id: "performance",
    title: {"es":"Escenario","en":"Stage"},
    steps: [
      step("stage-open", "shows", "Entrar al modo escenario", "Open stage mode", "Selecciona un show con canciones y abre Modo escenario. Verás el tema actual y los temas contiguos sin tener que buscar en la biblioteca.", "Select a show with songs and open Stage mode. It shows the current and adjacent songs without searching the library."),
      step("stage-actions", "stage", "Navegar, aplicar y asignar en directo", "Navigate, apply and assign live", "Usa los botones o las flechas para navegar. Enter aplica la canción y A/B/C la escribe en ese slot. Escape vuelve al repertorio. Los atajos funcionan cuando el escenario tiene el foco.", "Use the buttons or arrow keys to navigate. Enter applies the song and A/B/C writes it to that slot. Escape returns to the set. Shortcuts work when the stage has focus."),
    ],
  },
  {
    id: "assets",
    title: {"es":"IR y archivos compartidos","en":"IR and shared files"},
    steps: [
      step("irs", "irs", "Biblioteca de IR", "IR library", "Importa un WAV para guardarlo localmente, selecciónalo después para escribirlo en el gabinete elegido o elimina el archivo de tu biblioteca. Importar a la biblioteca no escribe en el pedal.", "Import a WAV to keep it locally, then select it to write it to a cabinet or delete it from your library. Importing into the library does not write to the pedal."),
      step("ir-backups", "backups", "Recuperar un IR anterior", "Restore a previous IR", "El historial muestra el gabinete, la fecha y el origen de cada respaldo. Restaurar reemplaza el IR del gabinete indicado y requiere confirmación.", "History lists the cabinet, date and source of each backup. Restore replaces the IR in the indicated cabinet and requires confirmation."),
      step("packs", "packs", "Abrir archivos y exportar packs", "Open shared files and export packs", "Abre un archivo compartido de CubeControl o un pack ZIP y revisa qué se importará. También puedes exportar un ZIP existente desde la lista de packs.", "Open a shared CubeControl file or ZIP pack and review what will be imported. You can also export an existing ZIP from the pack list."),
    ],
  },
  {
    id: "video",
    title: {"es":"Clips","en":"Clips"},
    steps: [
      step("clip-input", "clips", "Preparar audio, cámara y encuadre", "Prepare audio, camera and framing", "Elige la entrada de la pedalera o interfaz, la cámara y el formato horizontal o vertical. Activa la vista previa, toca unas notas y comprueba el nivel.", "Choose the pedal or interface input, the camera and landscape or portrait framing. Enable preview, play a few notes and check the level."),
      step("clip-record", "clips", "Grabar con la pedalera virtual", "Record with the virtual pedal", "Activa la pedalera virtual si quieres mostrar el preset y los ajustes del editor. Pulsa Grabar. Puedes cambiar de preset mientras grabas y volver a Clips para detener la toma.", "Enable the virtual pedal to show the editor preset and settings. Choose Record. You can change presets during the take and return to Clips to stop it."),
      step("clip-save", "clips", "Revisar y guardar el video", "Review and save the video", "Después de detener la toma, reprodúcela y guárdala en el equipo. CubeControl usa MP4 si está disponible o WebM como alternativa. El límite es de cinco minutos por toma.", "After stopping the take, play it back and save it to your computer. CubeControl uses MP4 when available and WebM otherwise. Each take lasts up to five minutes."),
    ],
  },
  {
    id: "cloud",
    title: {"es":"Cuenta y sincronización","en":"Account and sync"},
    steps: [
      step("account", "account", "Entrar, sincronizar y cerrar sesión", "Sign in, sync and sign out", "Abre el icono de cuenta y pide un enlace de acceso por correo. Una vez dentro, puedes sincronizar manualmente o cerrar sesión. La cuenta es opcional para trabajar localmente.", "Open the account icon and request an email sign-in link. After signing in, you can sync manually or sign out. An account is optional for local use."),
      step("sync", "account", "Resolver la primera sincronización", "Resolve the first sync", "Si ambos lados tienen datos, revisa la elección entre usar la nube y subir este equipo. Si aparecen tonos gemelos puedes unirlos. La sincronización de IR comparte metadatos y conserva los WAV locales.", "If both sides have data, review the choice between using the cloud and uploading this device. You can merge matching tones when offered. IR sync shares metadata and preserves local WAVs."),
    ],
  },
  {
    id: "support",
    title: {"es":"Ayuda y diagnóstico","en":"Help and diagnostics"},
    steps: [
      step("report", "current", "Diagnóstico y reporte de errores", "Diagnostics and bug reports", "En Reportar problema escribe cómo reproducirlo y exporta el ZIP de diagnóstico. Puedes mostrarlo en su carpeta, copiar un resumen o abrir GitHub para preparar el reporte.", "In Report a problem, describe how to reproduce the issue and export the diagnostic ZIP. You can show it in its folder, copy a summary, or open GitHub to prepare a report."),
      step("help", "current", "Buscar ayuda o repetir un recorrido", "Find help or repeat a guide", "Abre Ayuda o pulsa F1. Busca una función o recorre un capítulo a tu ritmo. Los controles que están disponibles se resaltan en la pantalla donde puedes usarlos.", "Open Help or press F1. Search for a feature or take a chapter at your own pace. Available controls are highlighted where you can use them."),
    ],
  },
];
