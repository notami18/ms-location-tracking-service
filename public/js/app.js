let markers = {};
let routes = {};
let devicePaths = {};
let currentDeviceId = null;
let selectedDateRange = { start: null, end: null };
let isRealTimeTracking = false;
let realTimeInterval = null;
let wsClient;
let isWebSocketActive = false;
let pollingActive = false;
let pollingInterval = null;
let activeRoute = null;
let routeMarkers = [];
let isRouteModeActive = false;
let isFullFleetMode = false;
let fleetMarkers = {};

// DOM elements
const deviceSelect = document.getElementById('deviceSelect');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const searchButton = document.getElementById('searchButton');
const realTimeToggle = document.getElementById('realTimeToggle');
const intervalInput = document.getElementById('interval');
const activeDevicesList = document.getElementById('activeDevices');
const connectionStatus = document.getElementById('connectionStatus');

// Inicializar la aplicación cuando se carga el DOM
document.addEventListener('DOMContentLoaded', function () {
  // Configurar datepickers con valores por defecto
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  // Formatear para input datetime-local (YYYY-MM-DDThh:mm)
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');

  if (startDateInput && endDateInput) {
    // Establecer valor por defecto: 24 horas atrás hasta ahora
    const formatDate = (date) => {
      return date.toISOString().substring(0, 16); // Formato YYYY-MM-DDThh:mm
    };

    startDateInput.value = formatDate(yesterday);
    endDateInput.value = formatDate(now);
  }

  // Enlazar botón de búsqueda
  const routeButton = document.getElementById('routeButton');
  if (routeButton) {
    routeButton.addEventListener('click', searchRoutes);
  }

  // Cargar lista de dispositivos
  loadDevices();

  // Configurar eventos
  setupEventListeners();

  // Inicializar cliente WebSocket
  initWebSocket();

  // Mostrar dispositivos activos inicialmente
  fetchActiveDevices();

  // Configurar el toggle de tiempo real
  if (realTimeToggle) {
    realTimeToggle.addEventListener('change', toggleRealTimeTracking);
  }

  // Intervalo
  if (intervalInput) {
    intervalInput.addEventListener('change', function () {
      // Si el tracking está activo, reiniciarlo con el nuevo intervalo
      if (isRealTimeTracking) {
        stopRealTimeTracking();
        startRealTimeTracking();
      }
    });
  }

  const fleetButton = document.getElementById('routeButton');
  if (fleetButton) {
    // Reemplazar el event listener existente
    const newFleetButton = fleetButton.cloneNode(true);
    fleetButton.parentNode.replaceChild(newFleetButton, fleetButton);
    
    // Asignar nuevo event listener
    newFleetButton.addEventListener('click', viewFullFleet);
  }
  
  // También añadir estilos CSS para marcadores de dispositivos
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.innerText = `
    .device-marker {
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 18px;
      border-radius: 50%;
      box-shadow: 0 0 10px rgba(0,0,0,0.3);
    }
    .android-marker {
      background-color: #3ddc84;
    }
    .ios-marker {
      background-color: #000000;
    }
    .generic-marker {
      background-color: #3498db;
    }
    .device-active {
      color: #2ecc71;
      font-weight: bold;
    }
    .device-inactive {
      color: #e74c3c;
      font-weight: bold;
    }
    .mock-warning {
      color: #e74c3c;
      font-weight: 500;
      font-size: 0.9rem;
    }
    body.fleet-mode .sidebar {
      opacity: 0.9;
    }
  `;
  document.head.appendChild(styleSheet);
});

// Inicializar cliente WebSocket
function initWebSocket() {
  // Opciones para el cliente WebSocket
  const wsOptions = {
    // URL base en producción o desarrollo
    baseUrl:
      window.location.hostname === 'localhost'
        ? 'ws://localhost:3000/ws'
        : `wss://${window.location.host}/ws`,

    // Callback cuando se conecta
    onConnect: () => {
      console.log('WebSocket conectado');
      updateConnectionStatus(true);

      // Suscribirse a todos los dispositivos
      wsClient.subscribeToAll();

      // Si hay un dispositivo seleccionado, suscribirse
      if (currentDeviceId) {
        wsClient.subscribeToDevice(currentDeviceId);
      }
    },

    // Callback cuando se desconecta
    onDisconnect: () => {
      console.log('WebSocket desconectado');
      updateConnectionStatus(false);
    },

    // Procesar actualizaciones de ubicación
    onLocationUpdate: (data) => {
      console.log('Actualización de ubicación recibida:', data);

      // Actualizar marcador en el mapa
      if (data.deviceId) {
        updateDeviceLocation(data);
      }
    },

    // Procesar actualizaciones de dispositivos activos
    onActiveDevicesUpdate: (devices, count) => {
      console.log(`Recibidos ${count} dispositivos activos`);
      updateActiveDevicesList(devices);
    },

    // Manejar errores
    onError: (error) => {
      console.error('Error en WebSocket:', error);
      updateConnectionStatus(false, error.message);
    },
  };

  // Crear instancia del cliente
  wsClient = new LocationWebSocketClient(wsOptions);
}

// Actualizar el estado de conexión en la UI
function updateConnectionStatus(isConnected, message = null) {
  if (connectionStatus) {
    if (isConnected) {
      connectionStatus.textContent = 'WebSocket Activo';
      connectionStatus.className = 'status-badge status-connected';
    } else {
      connectionStatus.textContent = message || 'Desconectado';
      connectionStatus.className = 'status-badge status-disconnected';
    }
  }
}

// Configurar listeners de eventos
function setupEventListeners() {
  // Buscar rutas al hacer clic en el botón
  if (searchButton) {
    searchButton.addEventListener('click', searchRoutes);
  }

  // Toggle seguimiento en tiempo real
  if (realTimeToggle) {
    realTimeToggle.addEventListener('change', toggleRealTimeTracking);
  }

  // Cambio de dispositivo
  if (deviceSelect) {
    deviceSelect.addEventListener('change', function () {
      currentDeviceId = this.value;
      clearMap();

      if (currentDeviceId) {
        // Cargar última ubicación conocida
        fetchLatestLocation(currentDeviceId);

        // Si hay WebSocket activo, suscribirse al dispositivo
        if (wsClient && wsClient.isConnected) {
          wsClient.subscribeToDevice(currentDeviceId);
        }
      }
    });
  }
}

// Cargar lista de dispositivos
async function loadDevices() {
  try {
    const response = await fetch('/api/devices');
    const data = await response.json();

    if (data.success && data.devices) {
      // Limpiar select
      deviceSelect.innerHTML =
        '<option value="">Selecciona un dispositivo</option>';

      // Añadir opciones
      data.devices.forEach((device) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.name || device.deviceId;
        deviceSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error cargando dispositivos:', error);
  }
}

// Obtener dispositivos activos
async function fetchActiveDevices() {
  try {
    const response = await fetch('/api/locations/active');
    const data = await response.json();

    if (data.success) {
      updateActiveDevicesList(data.devices);
    }
  } catch (error) {
    console.error('Error obteniendo dispositivos activos:', error);
  }
}

// Obtener última ubicación de un dispositivo
async function fetchLatestLocation(deviceId) {
  try {
    const response = await fetch(`/api/locations/device/${deviceId}/latest`);
    const data = await response.json();

    if (data.success && data.location) {
      updateDeviceLocation({
        deviceId,
        location: {
          lat: data.location.lat,
          lng: data.location.lng,
        },
        timestamp: data.location.timestamp,
        accuracy: data.location.accuracy,
        isMock: data.location.isMock,
        city: data.location.city,
      });

      // Centrar mapa en ubicación - usamos la función global de map.js
      if (window.mapUtils && window.mapUtils.centerMap) {
        window.mapUtils.centerMap(data.location.lat, data.location.lng, 15);
      }
    }
  } catch (error) {
    console.error('Error obteniendo última ubicación:', error);
  }
}

// Función corregida para buscar rutas sin depender de IDs específicos
async function searchRoutes() {
  if (!currentDeviceId) {
    alert('Por favor selecciona un dispositivo');
    return;
  }
  
  // Obtener fechas del formulario
  const startDate = document.getElementById('startDate') ? 
                   document.getElementById('startDate').value : null;
  const endDate = document.getElementById('endDate') ? 
                 document.getElementById('endDate').value : null;
  
  if (!startDate || !endDate) {
    alert('Por favor selecciona un rango de fechas');
    return;
  }
  
  try {
    // Buscar el botón por texto o clase en lugar de ID
    const fleetButton = document.querySelector('button:contains("Flota"), button.btn-primary');
    
    // Mostrar indicador de carga (si encontramos el botón)
    const originalButtonText = fleetButton ? fleetButton.textContent : '';
    if (fleetButton) {
      fleetButton.textContent = 'Cargando...';
    }
    
    // Formatear fechas para la API
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Validar rango de fechas
    if (start > end) {
      alert('La fecha de inicio no puede ser posterior a la fecha final');
      if (fleetButton) {
        fleetButton.textContent = originalButtonText;
      }
      return;
    }
    
    const queryParams = new URLSearchParams({
      startDate: start.toISOString(),
      endDate: end.toISOString()
    });
    
    console.log(`Buscando ruta para ${currentDeviceId} desde ${start.toISOString()} hasta ${end.toISOString()}`);
    
    const response = await fetch(`/api/locations/device/${currentDeviceId}/route?${queryParams}`);
    const data = await response.json();
    
    // Restablecer botón
    if (fleetButton) {
      fleetButton.textContent = originalButtonText;
    }
    
    if (data.success) {
      // Limpiar rutas anteriores
      clearRoutes();
      
      if (data.route && data.route.length > 0) {
        // Entrar en modo ruta
        isRouteModeActive = true;
        
        // Dibujar ruta en el mapa
        drawRoute(currentDeviceId, data.route);
        
        // Mostrar información de la ruta
        showRouteInfo(data);
      } else {
        alert('No se encontraron puntos de ubicación en este rango de fechas');
      }
    } else {
      alert('Error al buscar la ruta');
    }
  } catch (error) {
    console.error('Error buscando rutas:', error);
    alert('Error de conexión al buscar la ruta');
    
    // Restaurar texto del botón si es posible
    const fleetButton = document.querySelector('button:contains("Flota"), button.btn-primary');
    if (fleetButton) {
      fleetButton.textContent = 'Ver Flota Completa';
    }
  }
}


// Agregar soporte para :contains si el navegador no lo tiene
if (!window.jQuery && !Element.prototype.matches) {
  Element.prototype.matches = Element.prototype.msMatchesSelector || 
                              Element.prototype.webkitMatchesSelector;
}

if (!window.jQuery) {
  // Polyfill para selector :contains
  document.querySelector = (function(originalQuerySelector) {
    return function(selector) {
      try {
        if (selector.includes(':contains(')) {
          // Extraer el texto a buscar
          const match = selector.match(/:contains\("(.+?)"\)/);
          if (match) {
            const textToFind = match[1];
            const baseSelector = selector.replace(/:contains\("(.+?)"\)/, '');
            
            // Buscar todos los elementos que coincidan con el selector base
            const elements = document.querySelectorAll(baseSelector || '*');
            
            // Filtrar por los que contienen el texto
            for (let i = 0; i < elements.length; i++) {
              if (elements[i].textContent.includes(textToFind)) {
                return elements[i];
              }
            }
            return null;
          }
        }
        
        // Caso normal
        return originalQuerySelector.call(document, selector);
      } catch (e) {
        console.error('Error en selector personalizado:', e);
        // Fallback al selector normal
        return originalQuerySelector.call(document, selector.split(':contains')[0]);
      }
    };
  })(document.querySelector);
}


// Mostrar información de la ruta
function showRouteInfo(routeData) {
  const infoElement = document.createElement('div');
  infoElement.className = 'route-info';
  infoElement.innerHTML = `
    <h3>Información de Ruta</h3>
    <p>Dispositivo: ${routeData.deviceId}</p>
    <p>Puntos: ${routeData.pointCount}</p>
    <p>Desde: ${new Date(routeData.startDate).toLocaleString()}</p>
    <p>Hasta: ${new Date(routeData.endDate).toLocaleString()}</p>
  `;

  // Añadir a la interfaz si existe el contenedor
  const container = document.querySelector('.sidebar') || document.body;

  // Eliminar infos previos
  const oldInfo = container.querySelector('.route-info');
  if (oldInfo) {
    container.removeChild(oldInfo);
  }

  container.appendChild(infoElement);
}

// Función para manejar el toggle de seguimiento en tiempo real
function toggleRealTimeTracking() {
  isRealTimeTracking = realTimeToggle.checked;

  if (isRealTimeTracking) {
    // Activar el sistema elegido (WebSocket o polling)
    startRealTimeTracking();
  } else {
    // Detener todos los sistemas de tracking
    stopRealTimeTracking();
  }
}

// Iniciar seguimiento en tiempo real
function startRealTimeTracking() {
  if (!currentDeviceId) {
    alert('Por favor selecciona un dispositivo');
    realTimeToggle.checked = false;
    return;
  }

  const seconds = parseInt(intervalInput.value) || 5;
  const interval = seconds * 1000;

  // Iniciar con WebSocket si está disponible
  if (wsClient && wsClient.isConnected) {
    // Mostrar estado en la interfaz
    updateConnectionStatus(true);
    isWebSocketActive = true;

    // Asegurarse de estar suscrito
    wsClient.subscribeToDevice(currentDeviceId);
    console.log(`WebSocket activado para el dispositivo ${currentDeviceId}`);
  } else {
    // Caso fallback: usar polling
    isWebSocketActive = false;
    startPolling(interval);
  }
}

// Iniciar polling como alternativa a WebSocket
function startPolling(interval) {
  stopPolling(); // Detener si ya está corriendo

  console.log(
    `Iniciando polling para el dispositivo ${currentDeviceId} cada ${
      interval / 1000
    } segundos`
  );
  pollingActive = true;

  pollingInterval = setInterval(() => {
    if (currentDeviceId) {
      fetchLatestLocation(currentDeviceId);
    }
  }, interval);

  // Actualizar UI para mostrar que polling está activo
  updateConnectionStatus(false, 'Usando polling');
}

// Detener polling
function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    pollingActive = false;
    console.log('Polling detenido');
  }
}

// Detener seguimiento en tiempo real (tanto WebSocket como polling)
function stopRealTimeTracking() {
  // Detener polling si está activo
  stopPolling();

  // Desconectar WebSocket (opcional - podrías mantenerlo conectado)
  if (isWebSocketActive) {
    // Solo cancelar la suscripción, no desconectar completamente
    if (wsClient && wsClient.isConnected && currentDeviceId) {
      wsClient.unsubscribeFromDevice(currentDeviceId);
    }
    isWebSocketActive = false;
  }

  // Actualizar UI
  updateConnectionStatus(false, 'Tracking desactivado');
}

// Actualizar ubicación de un dispositivo en el mapa
function updateDeviceLocation(data) {
  if (!data || !data.location || !data.deviceId) return;

  const { deviceId, location, timestamp, accuracy, isMock, city } = data;

  // Formatear texto del popup
  const date = new Date(timestamp).toLocaleString();
  let popupContent = `
    <strong>${deviceId}</strong><br>
    Actualizado: ${date}<br>
    ${city ? `Ciudad: ${city}<br>` : ''}
    Precisión: ${accuracy || 'N/A'} m
  `;

  if (isMock) {
    popupContent += '<br><span class="mock-warning">Ubicación simulada</span>';
  }

  // Utilizamos las funciones de map.js
  if (window.mapUtils) {
    if (window.mapUtils.updateMarker) {
      window.mapUtils.updateMarker(
        deviceId,
        location.lat,
        location.lng,
        popupContent
      );
    }

    // Si está en seguimiento del dispositivo actual, centrar mapa
    if (
      isRealTimeTracking &&
      deviceId === currentDeviceId &&
      window.mapUtils.centerMap
    ) {
      window.mapUtils.centerMap(location.lat, location.lng);
    }

    // Si está en seguimiento, añadir punto a la ruta
    if (
      isRealTimeTracking &&
      deviceId === currentDeviceId &&
      window.mapUtils.addPointToPath
    ) {
      window.mapUtils.addPointToPath(deviceId, [location.lat, location.lng]);
    }
  }
}

// Dibujar ruta en el mapa (versión mejorada)
function drawRoute(deviceId, routePoints) {
  if (!routePoints || routePoints.length === 0) return;

  // Usar la función de mapUtils si está disponible
  if (window.mapUtils && window.mapUtils.drawFullRoute) {
    activeRoute = window.mapUtils.drawFullRoute(deviceId, routePoints);
    return;
  }

  // Implementación de respaldo por si no está disponible mapUtils
  // Convertir puntos al formato que espera Leaflet
  const points = routePoints.map((point) => [point.lat, point.lng]);

  // Crear línea
  const route = L.polyline(points, {
    color: getRandomColor(),
    weight: 4,
    opacity: 0.8,
  }).addTo(map);

  // Añadir marcadores en puntos importantes
  addRouteMarkers(points, routePoints);

  // Guardar referencia
  activeRoute = route;

  // Ajustar mapa para mostrar toda la ruta
  map.fitBounds(route.getBounds(), { padding: [50, 50] });
}

// Añadir marcadores a la ruta
function addRouteMarkers(points, routePoints) {
  // Punto inicial
  const startMarker = L.marker(points[0], {
    icon: L.divIcon({
      className: 'route-marker start-marker',
      html: '<i class="fas fa-play"></i>',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    }),
  }).addTo(map);

  // Información del punto inicial
  const startInfo = routePoints[0];
  startMarker.bindPopup(`
    <strong>Inicio</strong><br>
    Hora: ${new Date(startInfo.timestamp).toLocaleString()}<br>
    ${startInfo.city ? `Ciudad: ${startInfo.city}<br>` : ''}
  `);

  // Punto final
  const endMarker = L.marker(points[points.length - 1], {
    icon: L.divIcon({
      className: 'route-marker end-marker',
      html: '<i class="fas fa-flag-checkered"></i>',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    }),
  }).addTo(map);

  // Información del punto final
  const endInfo = routePoints[routePoints.length - 1];
  endMarker.bindPopup(`
    <strong>Final</strong><br>
    Hora: ${new Date(endInfo.timestamp).toLocaleString()}<br>
    ${endInfo.city ? `Ciudad: ${endInfo.city}<br>` : ''}
  `);

  // Guardar referencias para limpiar después
  routeMarkers.push(startMarker, endMarker);

  // Si hay más de 10 puntos, añadir marcadores intermedios cada ~20% de la ruta
  if (points.length > 10) {
    const step = Math.floor(points.length / 5);
    for (let i = step; i < points.length - step; i += step) {
      const marker = L.marker(points[i], {
        icon: L.divIcon({
          className: 'route-marker waypoint-marker',
          html: '<i class="fas fa-circle"></i>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
      }).addTo(map);

      // Información del punto intermedio
      const pointInfo = routePoints[i];
      marker.bindPopup(`
        <strong>Punto intermedio</strong><br>
        Hora: ${new Date(pointInfo.timestamp).toLocaleString()}<br>
        ${pointInfo.city ? `Ciudad: ${pointInfo.city}<br>` : ''}
      `);

      routeMarkers.push(marker);
    }
  }
}

// Limpiar rutas y marcadores
function clearRoutes() {
  // Usar la función de mapUtils si está disponible
  if (window.mapUtils && window.mapUtils.clearRoutes) {
    window.mapUtils.clearRoutes();
    activeRoute = null;
    isRouteModeActive = false;

    // Limpiar información de ruta
    const routeInfo = document.querySelector('.route-info');
    if (routeInfo) {
      routeInfo.remove();
    }

    return;
  }

  // Implementación de respaldo
  if (activeRoute && map) {
    map.removeLayer(activeRoute);
    activeRoute = null;
  }

  // Limpiar marcadores de ruta
  routeMarkers.forEach((marker) => {
    if (map) map.removeLayer(marker);
  });
  routeMarkers = [];

  // Restablecer estado
  isRouteModeActive = false;
}

// Generar color aleatorio
function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// Actualizar lista de dispositivos activos
function updateActiveDevicesList(devices) {
  if (!activeDevicesList) return;

  // Limpiar lista
  activeDevicesList.innerHTML = '';

  if (!devices || devices.length === 0) {
    activeDevicesList.innerHTML =
      '<li class="no-devices">No hay dispositivos activos</li>';
    return;
  }

  // Añadir dispositivos a la lista
  devices.forEach((device) => {
    const li = document.createElement('li');
    li.className = 'device-item';

    const lastSeen = new Date(device.lastSeen).toLocaleString();

    li.innerHTML = `
      <div class="device-info">
        <span class="device-id">${device.deviceId}</span>
        <span class="device-time">${lastSeen}</span>
      </div>
      <div class="device-actions">
        <button class="btn btn-sm btn-primary locate-btn" data-device="${device.deviceId}">
          <i class="fas fa-map-marker-alt"></i>
        </button>
      </div>
    `;

    // Añadir evento para localizar
    li.querySelector('.locate-btn').addEventListener('click', () => {
      // Seleccionar en el dropdown
      deviceSelect.value = device.deviceId;
      currentDeviceId = device.deviceId;

      // Cargar ubicación
      clearMap();
      fetchLatestLocation(device.deviceId);

      // Suscribirse vía WebSocket
      if (wsClient && wsClient.isConnected) {
        wsClient.subscribeToDevice(device.deviceId);
      }
    });

    activeDevicesList.appendChild(li);
  });
}

// Modificar la función clearMap para manejar flota
function clearMap() {
  // Salir del modo flota si está activo
  if (isFullFleetMode) {
    exitFullFleetMode();
  }
  
  // Usar la función de mapUtils si está disponible
  if (window.mapUtils && window.mapUtils.clearMap) {
    window.mapUtils.clearMap();
    return;
  }
  
  // Implementación de respaldo
  Object.values(markers).forEach(marker => {
    if (map) map.removeLayer(marker);
  });
  markers = {};
  
  // También limpiar rutas
  clearRoutes();
}

// Función para ver toda la flota en el mapa
async function viewFullFleet() {
  try {
    // Cambiar texto del botón mientras carga
    const fleetButton = document.getElementById('routeButton');
    if (fleetButton) {
      fleetButton.textContent = 'Cargando...';
    }

    // Desactivar modo de ruta si está activo
    if (isRouteModeActive) {
      clearRoutes();
    }

    // Verificar si ya estamos en modo flota
    if (isFullFleetMode) {
      // Salir del modo flota
      exitFullFleetMode();

      // Restaurar texto del botón
      if (fleetButton) {
        fleetButton.textContent = 'Ver Flota Completa';
      }
      return;
    }

    // Obtener ubicaciones más recientes de todos los dispositivos
    const response = await fetch('/api/locations/latest');
    const data = await response.json();

    // Restaurar texto del botón
    if (fleetButton) {
      fleetButton.textContent = 'Ocultar Flota';
    }

    if (data.success && data.data && data.data.length > 0) {
      // Limpiar mapa actual
      clearMap();

      // Entrar en modo flota
      isFullFleetMode = true;

      // Mostrar todos los dispositivos en el mapa
      showAllDevices(data.data);

      // Actualizar interfaz para mostrar que estamos en modo flota
      updateFleetModeUI(true);
    } else {
      alert('No se encontraron dispositivos activos');

      // Restaurar texto del botón
      if (fleetButton) {
        fleetButton.textContent = 'Ver Flota Completa';
      }
    }
  } catch (error) {
    console.error('Error obteniendo flota completa:', error);
    alert('Error de conexión al obtener la flota');

    // Restaurar texto del botón
    const fleetButton = document.getElementById('routeButton');
    if (fleetButton) {
      fleetButton.textContent = 'Ver Flota Completa';
    }
  }
}

// Mostrar todos los dispositivos en el mapa
function showAllDevices(devices) {
  // Crear bounds para ajustar el mapa
  const bounds = L.latLngBounds();

  // Procesar cada dispositivo
  devices.forEach((device) => {
    // Verificar que tenga datos de ubicación válidos
    if (
      !device.location ||
      !device.location.coordinates ||
      device.location.coordinates.length !== 2
    ) {
      console.warn(
        `Dispositivo ${device.deviceId} no tiene coordenadas válidas`
      );
      return;
    }

    // Extraer coordenadas (GeoJSON usa [lng, lat])
    const lat = device.location.coordinates[1];
    const lng = device.location.coordinates[0];

    // Formatear texto del popup
    const date = new Date(device.timestamp).toLocaleString();
    const popupContent = `
      <strong>${device.deviceId}</strong><br>
      Actualizado: ${date}<br>
      ${device.city ? `Ciudad: ${device.city}<br>` : ''}
      ${device.accuracy ? `Precisión: ${device.accuracy} m<br>` : ''}
      ${
        device.isActive
          ? '<span class="device-active">Activo</span>'
          : '<span class="device-inactive">Inactivo</span>'
      }
      ${
        device.isMock
          ? '<br><span class="mock-warning">Ubicación simulada</span>'
          : ''
      }
    `;

    // Crear marcador personalizado según tipo de dispositivo
    let marker;
    if (device.deviceId.startsWith('Android')) {
      // Marcador para Android
      marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'device-marker android-marker',
          html: '<i class="fas fa-android"></i>',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16],
        }),
      }).addTo(map);
    } else if (device.deviceId.startsWith('iOS')) {
      // Marcador para iOS
      marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'device-marker ios-marker',
          html: '<i class="fas fa-apple"></i>',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16],
        }),
      }).addTo(map);
    } else {
      // Marcador para otros dispositivos
      marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'device-marker generic-marker',
          html: '<i class="fas fa-mobile-alt"></i>',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16],
        }),
      }).addTo(map);
    }

    // Añadir popup
    marker.bindPopup(popupContent);

    // Añadir evento click
    marker.on('click', function () {
      // Seleccionar el dispositivo en el dropdown
      const deviceSelect = document.getElementById('deviceSelect');
      if (deviceSelect) {
        deviceSelect.value = device.deviceId;

        // Disparar evento change
        const event = new Event('change');
        deviceSelect.dispatchEvent(event);

        // Salir del modo flota
        exitFullFleetMode();
      }
    });

    // Guardar referencia
    fleetMarkers[device.deviceId] = marker;

    // Expandir bounds
    bounds.extend([lat, lng]);
  });

  // Ajustar mapa para mostrar todos los dispositivos
  if (!bounds.isValid()) {
    map.setView([6.2476, -75.5658], 12); // Centrar en Medellín por defecto
  } else {
    map.fitBounds(bounds, { padding: [50, 50] });
  }

  // Mostrar información de flota
  showFleetInfo(devices);
}

// Mostrar información de la flota
function showFleetInfo(devices) {
  // Crear elemento de información
  const infoElement = document.createElement('div');
  infoElement.className = 'fleet-info';

  // Estadísticas básicas
  const activeDevices = devices.filter((d) => d.isActive).length;
  const androidDevices = devices.filter((d) =>
    d.deviceId.startsWith('Android')
  ).length;
  const iosDevices = devices.filter((d) => d.deviceId.startsWith('iOS')).length;
  const otherDevices = devices.length - androidDevices - iosDevices;

  infoElement.innerHTML = `
    <h3>Información de Flota</h3>
    <p>Total de dispositivos: ${devices.length}</p>
    <p>Dispositivos activos: ${activeDevices}</p>
    <p>Android: ${androidDevices} | iOS: ${iosDevices} | Otros: ${otherDevices}</p>
  `;

  // Añadir a la interfaz si existe el contenedor
  const container = document.querySelector('.sidebar') || document.body;

  // Eliminar infos previos
  const oldInfo = container.querySelector('.fleet-info');
  if (oldInfo) {
    container.removeChild(oldInfo);
  }

  container.appendChild(infoElement);
}

// Salir del modo flota
function exitFullFleetMode() {
  // Limpiar marcadores de flota
  Object.values(fleetMarkers).forEach(marker => {
    if (map) map.removeLayer(marker);
  });
  fleetMarkers = {};
  
  // Restablecer estado
  isFullFleetMode = false;
  
  // Actualizar interfaz
  updateFleetModeUI(false);
  
  // Restablecer texto del botón
  const fleetButton = document.getElementById('routeButton');
  if (fleetButton) {
    fleetButton.textContent = 'Ver Flota Completa';
  }
  
  // Limpiar información de flota
  const fleetInfo = document.querySelector('.fleet-info');
  if (fleetInfo) {
    fleetInfo.remove();
  }
  
  // Si hay un dispositivo seleccionado, mostrarlo
  if (currentDeviceId) {
    fetchLatestLocation(currentDeviceId);
  }
}

// Actualizar interfaz según modo flota
function updateFleetModeUI(isFleetMode) {
  // Actualizar clase en el cuerpo del documento
  document.body.classList.toggle('fleet-mode', isFleetMode);
  
  // Modificar controles si es necesario
  const deviceSelect = document.getElementById('deviceSelect');
  if (deviceSelect) {
    deviceSelect.disabled = isFleetMode;
  }
  
  // Si está en modo flota, desactivar tracking en tiempo real
  if (isFleetMode && realTimeToggle && realTimeToggle.checked) {
    realTimeToggle.checked = false;
    toggleRealTimeTracking();
  }
}
