// Elementos del DOM
const deviceSelect = document.getElementById('deviceSelect');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const searchButton = document.getElementById('searchButton');
const statsContent = document.getElementById('stats-content');
const routeHistoryContent = document.getElementById('route-history-content');

const trackingSwitch = document.getElementById('trackingSwitch');
const trackingInterval = document.getElementById('trackingInterval');
const trackingStatus = document.getElementById('trackingStatus');

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar el mapa
  initMap();

  // Configurar fechas por defecto (último día)
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  // Formatear fechas para input datetime-local (YYYY-MM-DDThh:mm)
  startDateInput.value = formatDateForInput(yesterday);
  endDateInput.value = formatDateForInput(now);

  // Cargar dispositivos
  loadDevices();

  // Cargar estadísticas
  loadStats();

  // Event listeners
  deviceSelect.addEventListener('change', onDeviceChange);
  searchButton.addEventListener('click', onSearch);

  // Event listeners para el seguimiento en tiempo real
  trackingSwitch.addEventListener('change', onTrackingSwitchChange);
  trackingInterval.addEventListener('change', onTrackingIntervalChange);
});

// Formatear fecha para input datetime-local
function formatDateForInput(date) {
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(
    date.getDate()
  )}T${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
}

// Añadir cero a números menores de 10
function padZero(num) {
  return num < 10 ? `0${num}` : num;
}

// Cargar dispositivos en el select
async function loadDevices() {
  const devices = await getDevices();

  // Limpiar opciones actuales
  deviceSelect.innerHTML =
    '<option value="">Seleccione dispositivo...</option>';

  // Añadir opciones
  devices.forEach((deviceId) => {
    const option = document.createElement('option');
    option.value = deviceId;
    option.textContent = deviceId;
    deviceSelect.appendChild(option);
  });
}

// Cargar estadísticas
async function loadStats() {
  const result = await getStats();

  if (!result.success) {
    statsContent.innerHTML = `<p class="error">Error: ${result.message}</p>`;
    return;
  }

  const stats = result.stats;

  statsContent.innerHTML = `
        <div class="stat-item">
            <strong>Total de ubicaciones:</strong> ${stats.totalLocations}
        </div>
        <div class="stat-item">
            <strong>Ubicaciones recientes (30 días):</strong> ${
              stats.recentLocations
            }
        </div>
        <div class="stat-item">
            <strong>Dispositivos registrados:</strong> ${stats.deviceCount}
        </div>
        <div class="stat-item">
            <strong>Última actualización:</strong> ${
              stats.lastUpdateAt
                ? new Date(stats.lastUpdateAt).toLocaleString()
                : 'N/A'
            }
        </div>
    `;
}

// Evento de cambio de dispositivo
async function onDeviceChange() {
  const deviceId = deviceSelect.value;

  if (!deviceId) {
    routeHistoryContent.innerHTML =
      '<p>Seleccione un dispositivo para ver su historial</p>';
    return;
  }

  // Cargar historial de rutas
  const result = await getRouteHistory(deviceId);

  if (!result.success) {
    routeHistoryContent.innerHTML = `<p class="error">Error: ${result.message}</p>`;
    return;
  }

  if (result.dailyRoutes.length === 0) {
    routeHistoryContent.innerHTML =
      '<p>No hay datos de ruta disponibles para este dispositivo</p>';
    return;
  }

  // Mostrar historial
  let html = '';

  result.dailyRoutes.forEach((day) => {
    const date = new Date(day.date).toLocaleDateString();

    // Determinar ciudades principales en el día
    let cities = '';
    if (day.previewRoute && day.previewRoute.length > 0) {
      // Aquí normalmente verificaríamos las ciudades,
      // pero como no tenemos esa info en el historial, mostramos genérico
      cities = 'Área Metropolitana de Medellín';
    }

    html += `
            <div class="route-item" data-date="${
              day.date
            }" data-device="${deviceId}">
                <div class="date">${date}</div>
                <div class="details">
                    <span>${day.pointCount} puntos</span>
                    ${cities ? `<span class="cities">${cities}</span>` : ''}
                </div>
            </div>
        `;
  });

  routeHistoryContent.innerHTML = html;

  // Mostrar vista previa del historial en el mapa
  showRouteHistoryPreview(result.dailyRoutes);

  // Añadir event listeners a los elementos del historial
  document.querySelectorAll('.route-item').forEach((item) => {
    item.addEventListener('click', onRouteItemClick);
  });
}

// Evento de click en item de historial
async function onRouteItemClick(event) {
  const item = event.currentTarget;
  const deviceId = item.dataset.device;
  const dateStr = item.dataset.date;

  // Convertir string a Date
  const date = new Date(dateStr);

  // Obtener rango de 24 horas
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  // Actualizar inputs de fecha
  startDateInput.value = formatDateForInput(startDate);
  endDateInput.value = formatDateForInput(endDate);

  // Buscar ruta
  await loadRouteForDateRange(deviceId, startDate, endDate);
}

// Evento de búsqueda
async function onSearch() {
  const deviceId = deviceSelect.value;

  if (!deviceId) {
    alert('Por favor seleccione un dispositivo');
    return;
  }

  const startDateStr = startDateInput.value;
  const endDateStr = endDateInput.value;

  if (!startDateStr || !endDateStr) {
    alert('Por favor seleccione fechas de inicio y fin');
    return;
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  await loadRouteForDateRange(deviceId, startDate, endDate);
}

// Cargar ruta para un rango de fechas
async function loadRouteForDateRange(deviceId, startDate, endDate) {
  const result = await getDeviceRoute(deviceId, startDate, endDate);

  if (!result.success) {
    alert(`Error: ${result.message}`);
    return;
  }

  // Mostrar ruta en el mapa
  showDeviceRoute(result.route, deviceId);

  // Resaltar elementos en el historial
  document.querySelectorAll('.route-item').forEach((item) => {
    item.classList.remove('active');

    // Si la fecha del item está dentro del rango, marcar como activo
    const itemDate = new Date(item.dataset.date);
    if (
      itemDate >= startDate.setHours(0, 0, 0, 0) &&
      itemDate <= endDate.setHours(23, 59, 59, 999)
    ) {
      item.classList.add('active');
    }
  });
}

// Función para agregar datos de ejemplo (solo para desarrollo/pruebas)
async function addSampleData() {
  // Esta función simularía la inserción de datos de prueba en MongoDB
  // Solo para uso en desarrollo, no debe usarse en producción
  console.log(
    'Esta función sería implementada en un entorno real para agregar datos de ejemplo'
  );
}

// Evento de cambio del switch de seguimiento
function onTrackingSwitchChange() {
  const deviceId = deviceSelect.value;

  if (trackingSwitch.checked) {
    // Iniciar seguimiento
    if (!deviceId) {
      alert('Por favor seleccione un dispositivo primero');
      trackingSwitch.checked = false;
      return;
    }

    const intervalSeconds = parseInt(trackingInterval.value);
    if (isNaN(intervalSeconds) || intervalSeconds < 1 || intervalSeconds > 60) {
      alert('Por favor ingrese un intervalo válido entre 1 y 60 segundos');
      trackingInterval.value = '5';
      trackingSwitch.checked = false;
      return;
    }

    // Iniciar seguimiento
    const started = startLiveTracking(deviceId, intervalSeconds);

    if (started) {
      trackingStatus.textContent = `Activo (${intervalSeconds}s)`;
      trackingStatus.classList.add('active');
      trackingStatus.classList.remove('error');
    } else {
      trackingStatus.textContent = 'Error al iniciar';
      trackingStatus.classList.add('error');
      trackingStatus.classList.remove('active');
      trackingSwitch.checked = false;
    }
  } else {
    // Detener seguimiento
    stopLiveTracking();
    trackingStatus.textContent = 'Inactivo';
    trackingStatus.classList.remove('active', 'error');
  }
}

// Evento de cambio del intervalo de seguimiento
function onTrackingIntervalChange() {
  const intervalSeconds = parseInt(trackingInterval.value);

  // Validar entrada
  if (isNaN(intervalSeconds) || intervalSeconds < 1) {
    trackingInterval.value = '1';
  } else if (intervalSeconds > 60) {
    trackingInterval.value = '60';
  }

  // Si el seguimiento está activo, reiniciarlo con el nuevo intervalo
  if (trackingSwitch.checked) {
    const deviceId = deviceSelect.value;

    // Detener el seguimiento actual
    stopLiveTracking();

    // Reiniciar con el nuevo intervalo
    const intervalVal = parseInt(trackingInterval.value);
    const started = startLiveTracking(deviceId, intervalVal);

    if (started) {
      trackingStatus.textContent = `Activo (${intervalVal}s)`;
    }
  }
}

// Desactivar seguimiento cuando cambia el dispositivo seleccionado
function disableTrackingOnDeviceChange() {
  if (trackingSwitch.checked) {
    trackingSwitch.checked = false;
    stopLiveTracking();
    trackingStatus.textContent = 'Inactivo';
    trackingStatus.classList.remove('active', 'error');
  }
}

// Modificar onDeviceChange para desactivar seguimiento al cambiar dispositivo
const originalOnDeviceChange = onDeviceChange;
onDeviceChange = async function () {
  disableTrackingOnDeviceChange();
  await originalOnDeviceChange();
};

// Modificar onSearch para desactivar seguimiento al iniciar búsqueda
const originalOnSearch = onSearch;
onSearch = async function () {
  disableTrackingOnDeviceChange();
  await originalOnSearch();
};

// Modificar onRouteItemClick para desactivar seguimiento al seleccionar una ruta del historial
const originalOnRouteItemClick = onRouteItemClick;
onRouteItemClick = async function (event) {
  disableTrackingOnDeviceChange();
  await originalOnRouteItemClick(event);
};
