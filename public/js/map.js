// Sugerencia para modificar tu archivo public/js/map.js

// Variables globales
let map;
let markers = {}; // Objeto para almacenar marcadores por deviceId
let devicePaths = {}; // Objeto para almacenar rutas por deviceId
let focusedDevice = null; // Dispositivo en foco
let isFleetView = false; // Modo vista de flota

// Inicialización del mapa
function initMap() {
  console.log('Inicializando mapa...');

  // Crear mapa centrado en Medellín
  map = L.map('map').setView([6.2476, -75.5659], 13);

  // Añadir capa de OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Escuchar eventos de WebSocket para actualizar ubicaciones
  listenForLocationUpdates();

  console.log('Mapa inicializado correctamente');
}

// Escuchar actualizaciones de ubicación via WebSocket
function listenForLocationUpdates() {
  console.log('Configurando listeners para actualizaciones de ubicación...');

  window.addEventListener('location-update', function (event) {
    console.log('Evento location-update recibido en map.js:', event.detail);

    const updateData = event.detail;
    if (updateData && updateData.deviceId && updateData.data) {
      updateDeviceLocation(updateData.deviceId, updateData.data);
    }
  });

  console.log('Listeners configurados');
}

// Actualizar ubicación de un dispositivo en el mapa
function updateDeviceLocation(deviceId, locationData) {
  console.log(`Actualizando ubicación para ${deviceId}:`, locationData);

  if (!locationData || !locationData.lat || !locationData.lng) {
    console.error('Datos de ubicación inválidos:', locationData);
    return;
  }

  const position = [locationData.lat, locationData.lng];

  // Crear o actualizar marcador
  if (!markers[deviceId]) {
    // Crear nuevo marcador
    const marker = L.marker(position, {
      title: `Dispositivo ${deviceId}`,
    }).addTo(map);

    // Añadir popup con información
    marker.bindPopup(createPopupContent(deviceId, locationData));

    // Guardar referencia
    markers[deviceId] = marker;

    // Inicializar path si no existe
    if (!devicePaths[deviceId]) {
      devicePaths[deviceId] = L.polyline([], {
        color: getDeviceColor(deviceId),
        weight: 3,
        opacity: 0.7,
      }).addTo(map);
    }

    console.log(`Nuevo marcador creado para ${deviceId}`);
  } else {
    // Actualizar marcador existente
    markers[deviceId].setLatLng(position);
    markers[deviceId].bindPopup(createPopupContent(deviceId, locationData));

    console.log(`Marcador actualizado para ${deviceId}`);
  }

  // Actualizar path
  if (devicePaths[deviceId]) {
    const path = devicePaths[deviceId];
    path.addLatLng(position);
    console.log(`Ruta actualizada para ${deviceId}`);
  }

  // Si este dispositivo está en foco, centrarlo
  if (focusedDevice === deviceId) {
    map.setView(position, map.getZoom());

    // Actualizar estadísticas
    updateDeviceStats(deviceId, locationData);
  }

  // Si estamos en vista de flota, actualizar estadísticas de flota
  if (isFleetView) {
    updateFleetStats();
  }
}

// Crear contenido del popup
function createPopupContent(deviceId, locationData) {
  const content = document.createElement('div');
  content.className = 'device-popup';

  // Título
  const title = document.createElement('h3');
  title.textContent = `Dispositivo ${deviceId}`;
  content.appendChild(title);

  // Información de ubicación
  const locationInfo = document.createElement('p');
  locationInfo.textContent = `Ciudad: ${locationData.city || 'Desconocida'}`;
  content.appendChild(locationInfo);

  // Velocidad
  const speedInfo = document.createElement('p');
  speedInfo.textContent = `Velocidad: ${Math.round(
    locationData.speed || 0
  )} km/h`;
  content.appendChild(speedInfo);

  // Timestamp
  const timeInfo = document.createElement('p');
  timeInfo.textContent = `Actualización: ${formatDate(locationData.timestamp)}`;
  content.appendChild(timeInfo);

  // Botón para seguir
  const followButton = document.createElement('button');
  followButton.className = 'follow-device-btn';
  followButton.textContent = 'Seguir este dispositivo';
  followButton.onclick = function () {
    focusDevice(deviceId);
    return false; // Evitar que el click cierre el popup
  };
  content.appendChild(followButton);

  return content;
}

// Formatear fecha
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString();
}

// Obtener color para dispositivo (para consistencia visual)
function getDeviceColor(deviceId) {
  // Generar color basado en deviceId para consistencia
  const colors = [
    '#e6194b',
    '#3cb44b',
    '#ffe119',
    '#4363d8',
    '#f58231',
    '#911eb4',
    '#46f0f0',
    '#f032e6',
    '#bcf60c',
    '#fabebe',
  ];
  const index = parseInt(deviceId.replace(/\D/g, '')) % colors.length;
  return colors[index];
}

// Enfocar un dispositivo específico
function focusDevice(deviceId) {
  focusedDevice = deviceId;
  isFleetView = false;

  // Mostrar panel de estadísticas del dispositivo
  document.getElementById('deviceStatsContainer').classList.remove('hidden');
  document.getElementById('fleetStatsContainer').classList.add('hidden');

  // Centrar mapa en dispositivo
  if (markers[deviceId]) {
    map.setView(markers[deviceId].getLatLng(), 15);
  }

  console.log(`Dispositivo ${deviceId} enfocado`);
}

// Activar vista de flota
function showFleetView() {
  focusedDevice = null;
  isFleetView = true;

  // Mostrar panel de estadísticas de flota
  document.getElementById('deviceStatsContainer').classList.add('hidden');
  document.getElementById('fleetStatsContainer').classList.remove('hidden');

  // Ajustar vista para mostrar todos los dispositivos
  const bounds = [];
  for (const deviceId in markers) {
    bounds.push(markers[deviceId].getLatLng());
  }

  if (bounds.length > 0) {
    map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
  }

  // Actualizar estadísticas de flota
  updateFleetStats();

  console.log('Vista de flota activada');
}

// Actualizar estadísticas de dispositivo
function updateDeviceStats(deviceId, locationData) {
  if (!locationData) return;

  document.getElementById('lastUpdateTime').textContent = formatDate(
    locationData.timestamp
  );
  document.getElementById('currentCity').textContent =
    locationData.city || 'Desconocida';
  document.getElementById('currentSpeed').textContent = `${Math.round(
    locationData.speed || 0
  )} km/h`;
  document.getElementById('accuracy').textContent = `${Math.round(
    locationData.accuracy || 0
  )} m`;

  console.log('Estadísticas de dispositivo actualizadas');
}

// Actualizar estadísticas de flota
function updateFleetStats() {
  // Contar dispositivos activos
  const activeDevices = Object.keys(markers).length;
  document.getElementById('activeDeviceCount').textContent = activeDevices;

  // Contar dispositivos en movimiento (velocidad > 5 km/h)
  let movingDevices = 0;
  let cityCount = {};

  for (const deviceId in markers) {
    const marker = markers[deviceId];
    const popup = marker.getPopup();

    if (popup) {
      const content = popup.getContent();
      const speedMatch = content.textContent.match(/Velocidad: (\d+) km\/h/);
      const cityMatch = content.textContent.match(/Ciudad: ([^<]+)/);

      if (speedMatch && parseInt(speedMatch[1]) > 5) {
        movingDevices++;
      }

      if (cityMatch) {
        const city = cityMatch[1].trim();
        cityCount[city] = (cityCount[city] || 0) + 1;
      }
    }
  }

  document.getElementById('movingDeviceCount').textContent = movingDevices;
  document.getElementById('stoppedDeviceCount').textContent =
    activeDevices - movingDevices;

  // Actualizar distribución por ciudad
  const cityDistribution = document.getElementById('cityDistribution');
  cityDistribution.innerHTML = '';

  for (const city in cityCount) {
    const cityItem = document.createElement('div');
    cityItem.className = 'city-item';

    const cityName = document.createElement('span');
    cityName.className = 'city-name';
    cityName.textContent = city;

    const cityDeviceCount = document.createElement('span');
    cityDeviceCount.className = 'city-count';
    cityDeviceCount.textContent = cityCount[city];

    cityItem.appendChild(cityName);
    cityItem.appendChild(cityDeviceCount);
    cityDistribution.appendChild(cityItem);
  }

  console.log('Estadísticas de flota actualizadas');
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function () {
  console.log('DOM cargado, inicializando componentes...');

  // Inicializar mapa
  initMap();

  // Configurar botones
  const viewFleetBtn = document.getElementById('viewFleetBtn');
  if (viewFleetBtn) {
    viewFleetBtn.addEventListener('click', showFleetView);
  }

  const deviceSelect = document.getElementById('deviceSelect');
  if (deviceSelect) {
    deviceSelect.addEventListener('change', function () {
      const deviceId = this.value;
      if (deviceId) {
        focusDevice(deviceId);
      }
    });
  }

  console.log('Componentes inicializados');
});

// Exponer funciones necesarias globalmente
window.mapController = {
  focusDevice,
  showFleetView,
  updateDeviceLocation,
};
