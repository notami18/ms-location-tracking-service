// Variables globales
let websocket;
let trackingEnabled = false;
// let trackingInterval = null;
let trackingIntervalSeconds = 5;
let currentDevice = null;

// Inicializar aplicación
function initApp() {
  console.log('Inicializando aplicación...');

  // Cargar dispositivos
  loadDevices();

  // Configurar controles de UI
  setupUIControls();

  // Inicializar selectores de fecha
  setupDatePickers();

  // Verificar si ya hay un token de autenticación
  const token = localStorage.getItem('authToken');
  if (!token) {
    console.warn('No hay token de autenticación');
  }

  console.log('Aplicación inicializada');
}

function setupDatePickers() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Formato YYYY-MM-DD para inputs date
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Configurar fechas predeterminadas
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');

  if (startDateInput) {
    startDateInput.value = formatDate(yesterday);
  }

  if (endDateInput) {
    endDateInput.value = formatDate(today);
  }
}

// Cargar lista de dispositivos
// Cargar lista de dispositivos
async function loadDevices() {
  try {
    const response = await apiClient.getDevices();
    console.log('Respuesta completa de getDevices:', response);

    // Intentar determinar el formato correcto de la respuesta
    let devices = response;

    // Si es un objeto con estructura { success: true, data: [...] }
    if (response && typeof response === 'object' && response.data) {
      devices = response.data;
    }

    // Si no hay dispositivos disponibles, crear demo
    if (!devices || !Array.isArray(devices) || devices.length === 0) {
      devices = [
        { deviceId: 'dev001', name: 'Dispositivo 001' },
        { deviceId: 'dev002', name: 'Dispositivo 002' },
        { deviceId: 'dev003', name: 'Dispositivo 003' },
      ];
    }

    populateDeviceSelect(devices);
  } catch (error) {
    console.error('Error cargando dispositivos:', error);

    // En caso de error, cargar dispositivos de demostración
    const demoDevices = [
      { deviceId: 'dev001', name: 'Dispositivo 001' },
      { deviceId: 'dev002', name: 'Dispositivo 002' },
      { deviceId: 'dev003', name: 'Dispositivo 003' },
    ];

    populateDeviceSelect(demoDevices);
  }
}

// Llenar select de dispositivos
function populateDeviceSelect(devices) {
  const select = document.getElementById('deviceSelect');
  if (!select) return;

  // Limpiar opciones existentes
  select.innerHTML = '<option value="">Seleccione dispositivo...</option>';

  // Verificar formato de devices
  console.log('Formato de datos recibidos:', devices);

  // Si devices no es un array o está vacío, usar dispositivos de demostración
  if (!Array.isArray(devices) || devices.length === 0) {
    console.log('Usando dispositivos de demostración');
    devices = [
      { deviceId: 'dev001', name: 'Dispositivo 001' },
      { deviceId: 'dev002', name: 'Dispositivo 002' },
      { deviceId: 'dev003', name: 'Dispositivo 003' },
    ];
  }

  // Si devices es un objeto con una propiedad data que contiene el array (formato común de API)
  if (
    !Array.isArray(devices) &&
    devices &&
    devices.data &&
    Array.isArray(devices.data)
  ) {
    console.log('Formato de API detectado, usando devices.data');
    devices = devices.data;
  }

  // Agregar dispositivos
  devices.forEach((device) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.name || `Dispositivo ${device.deviceId}`;
    select.appendChild(option);
  });

  console.log(
    'Select de dispositivos actualizado con',
    devices.length,
    'dispositivos'
  );
}

// Configurar controles de UI
function setupUIControls() {
  console.log('Configurando controles de UI...');

  // Switch de tracking
  const trackingSwitch = document.getElementById('trackingSwitch');
  if (trackingSwitch) {
    trackingSwitch.addEventListener('change', function () {
      toggleTracking(this.checked);
    });
  }

  // Input de intervalo
  const intervalInput = document.getElementById('trackingInterval');
  if (intervalInput) {
    intervalInput.addEventListener('change', function () {
      trackingIntervalSeconds = parseInt(this.value) || 5;

      // Si el tracking está activo, reiniciar con nuevo intervalo
      if (trackingEnabled) {
        toggleTracking(false);
        toggleTracking(true);
      }
    });
  }

  // Botón de búsqueda
  const searchButton = document.getElementById('searchButton');
  if (searchButton) {
    searchButton.addEventListener('click', searchLocationHistory);
  }

  console.log('Controles de UI configurados');
}

// Activar/Desactivar tracking en tiempo real
function toggleTracking(enable) {
  trackingEnabled = enable;

  const statusIndicator = document.getElementById('trackingStatus');
  if (statusIndicator) {
    statusIndicator.textContent = trackingEnabled ? 'Activo' : 'Inactivo';
    statusIndicator.className = trackingEnabled
      ? 'status-indicator active'
      : 'status-indicator';
  }

  if (trackingEnabled) {
    // Si hay un dispositivo seleccionado, subscribirse
    const deviceSelect = document.getElementById('deviceSelect');
    if (deviceSelect && deviceSelect.value) {
      currentDevice = deviceSelect.value;
      subscribeToDevice(currentDevice);
    } else {
      // Subscribirse a todos
      subscribeToAllDevices();
    }

    console.log('Tracking activado');
  } else {
    // Desactivar interval si existe
    if (trackingInterval) {
      clearInterval(trackingInterval);
      trackingInterval = null;
    }

    console.log('Tracking desactivado');
  }
}

// Subscribirse a un dispositivo específico
function subscribeToDevice(deviceId) {
  if (window.trackerWebSocket && window.trackerWebSocket.socket) {
    const socket = window.trackerWebSocket.socket;

    if (socket.readyState === 1) {
      // WebSocket.OPEN
      socket.send(
        JSON.stringify({
          action: 'subscribe',
          deviceId: deviceId,
        })
      );

      console.log(`Subscrito a dispositivo ${deviceId}`);
    }
  }
}

// Subscribirse a todos los dispositivos
function subscribeToAllDevices() {
  if (window.trackerWebSocket && window.trackerWebSocket.socket) {
    const socket = window.trackerWebSocket.socket;

    if (socket.readyState === 1) {
      // WebSocket.OPEN
      socket.send(
        JSON.stringify({
          action: 'subscribeAll',
        })
      );

      console.log('Subscrito a todos los dispositivos');
    }
  }
}

// Buscar historial de ubicaciones
async function searchLocationHistory() {
  const deviceSelect = document.getElementById('deviceSelect');
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');

  if (!deviceSelect || !startDateInput || !endDateInput) return;

  const deviceId = deviceSelect.value;
  const startDate = startDateInput.value;
  const endDate = endDateInput.value;

  if (!deviceId || !startDate || !endDate) {
    alert('Por favor complete todos los campos de búsqueda');
    return;
  }

  try {
    console.log(
      `Buscando historial para ${deviceId} entre ${startDate} y ${endDate}`
    );

    const locations = await apiClient.getLocationHistory(
      deviceId,
      startDate,
      endDate
    );

    if (!locations || locations.length === 0) {
      alert('No se encontraron datos para el período seleccionado');
      return;
    }

    // Mostrar ruta en mapa
    displayRouteHistory(deviceId, locations);

    // Actualizar historial
    updateRouteHistory(deviceId, locations);

    console.log(`Se encontraron ${locations.length} ubicaciones`);
  } catch (error) {
    console.error('Error buscando historial:', error);
    alert('Error al buscar historial de ubicaciones');
  }
}

// Mostrar ruta histórica en mapa
function displayRouteHistory(deviceId, locations) {
  if (!window.mapController) return;

  // Enfocar dispositivo
  window.mapController.focusDevice(deviceId);

  // Crear o actualizar ruta
  // (Esto debería implementarse en el controlador del mapa)
}

// Actualizar panel de historial
function updateRouteHistory(deviceId, locations) {
  const historyContent = document.getElementById('route-history-content');
  if (!historyContent) return;

  // Limpiar contenido actual
  historyContent.innerHTML = '';

  // Crear lista de ubicaciones
  const list = document.createElement('ul');
  list.className = 'location-list';

  // Añadir max 10 ubicaciones para no sobrecargar
  const displayLocations = locations.slice(0, 10);

  displayLocations.forEach((location) => {
    const item = document.createElement('li');

    const time = new Date(location.timestamp).toLocaleTimeString();
    const city = location.city || 'Desconocida';

    item.textContent = `${time} - ${city}`;
    list.appendChild(item);
  });

  historyContent.appendChild(list);

  // Añadir indicador si hay más
  if (locations.length > 10) {
    const moreInfo = document.createElement('p');
    moreInfo.className = 'more-info';
    moreInfo.textContent = `... y ${locations.length - 10} ubicaciones más`;
    historyContent.appendChild(moreInfo);
  }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initApp);
