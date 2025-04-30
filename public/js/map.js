// Mapa y capas
let map;
let routeLayer;
let markersLayer;

// Variables para seguimiento en tiempo real
let liveTrackingEnabled = false;
let liveTrackingInterval = 5000; // 5 segundos por defecto
let trackingTimerId = null;
let liveMarker = null;
let livePolyline = null;
let livePositions = [];

// Inicializar mapa
function initMap() {
  // Crear mapa centrado en Colombia (ajustar según tu área de interés)
  map = L.map('map').setView([6.2476, -75.5658], 12);

  // Añadir capa base de OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Crear capas para rutas y marcadores
  routeLayer = L.layerGroup().addTo(map);
  markersLayer = L.layerGroup().addTo(map);
}

// Mostrar una ruta de dispositivo en el mapa
// Mostrar una ruta de dispositivo en el mapa con puntos por ciudad
function showDeviceRoute(route, deviceId) {
  // Limpiar capas existentes
  routeLayer.clearLayers();
  markersLayer.clearLayers();

  if (!route || route.length === 0) {
    alert('No hay datos de ruta disponibles para mostrar');
    return;
  }

  // Crear polilínea para la ruta
  const routePath = route.map((point) => [point.lat, point.lng]);
  const polyline = L.polyline(routePath, {
    color: '#007bff',
    weight: 3,
    opacity: 0.7,
  }).addTo(routeLayer);

  // Añadir marcadores para cada punto con colores según la ciudad
  route.forEach((point, index) => {
    // Color según ciudad
    let markerColor = '#3388ff'; // Azul por defecto

    if (point.city) {
      switch (point.city.toLowerCase()) {
        case 'bello':
          markerColor = '#28a745'; // Verde
          break;
        case 'medellín':
          markerColor = '#dc3545'; // Rojo
          break;
        case 'envigado':
          markerColor = '#ffc107'; // Amarillo
          break;
      }
    }

    // Solo mostrar marcador cada 3 puntos para no sobrecargar el mapa, excepto inicio y fin
    if (index === 0 || index === route.length - 1 || index % 3 === 0) {
      const marker = L.circleMarker([point.lat, point.lng], {
        radius: index === 0 || index === route.length - 1 ? 8 : 5,
        color: '#fff',
        fillColor: markerColor,
        fillOpacity: 0.8,
        weight: 1,
      }).addTo(markersLayer);

      marker.bindPopup(`
              <strong>Punto ${index + 1}/${route.length}</strong><br>
              Ciudad: ${point.city || 'Desconocido'}<br>
              Fecha: ${new Date(point.timestamp).toLocaleString()}<br>
              Coordenadas: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}<br>
              Precisión: ${point.accuracy.toFixed(1)} metros
          `);
    }
  });

  // Añadir marcadores adicionales para inicio y fin
  const startPoint = route[0];
  const endPoint = route[route.length - 1];

  // Marcador de inicio
  const startMarker = L.circleMarker([startPoint.lat, startPoint.lng], {
    radius: 10,
    color: '#fff',
    fillColor: '#28a745',
    fillOpacity: 1,
    weight: 2,
  }).addTo(markersLayer);

  startMarker.bindPopup(`
      <strong>Inicio de Ruta</strong><br>
      Ciudad: ${startPoint.city || 'Desconocido'}<br>
      Dispositivo: ${deviceId}<br>
      Fecha: ${new Date(startPoint.timestamp).toLocaleString()}<br>
      Coordenadas: ${startPoint.lat.toFixed(6)}, ${startPoint.lng.toFixed(6)}
  `);

  // Marcador de fin
  const endMarker = L.circleMarker([endPoint.lat, endPoint.lng], {
    radius: 10,
    color: '#fff',
    fillColor: '#dc3545',
    fillOpacity: 1,
    weight: 2,
  }).addTo(markersLayer);

  endMarker.bindPopup(`
      <strong>Fin de Ruta</strong><br>
      Ciudad: ${endPoint.city || 'Desconocido'}<br>
      Dispositivo: ${deviceId}<br>
      Fecha: ${new Date(endPoint.timestamp).toLocaleString()}<br>
      Coordenadas: ${endPoint.lat.toFixed(6)}, ${endPoint.lng.toFixed(6)}
  `);

  // Añadir leyenda de colores
  addLegend();

  // Ajustar vista del mapa para mostrar toda la ruta
  map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
}

// Añadir leyenda al mapa
function addLegend() {
  // Eliminar leyenda existente si hay
  if (map.legend) {
    map.removeControl(map.legend);
  }

  // Crear nueva leyenda
  const legend = L.control({ position: 'bottomright' });

  legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend');
    div.style.backgroundColor = 'white';
    div.style.padding = '10px';
    div.style.borderRadius = '5px';
    div.style.boxShadow = '0 0 5px rgba(0,0,0,0.2)';

    div.innerHTML = '<h4>Ciudades</h4>';
    div.innerHTML +=
      '<div style="display:flex;align-items:center;margin:5px 0;"><span style="background:#28a745;width:15px;height:15px;display:inline-block;border-radius:50%;margin-right:5px;"></span> Bello</div>';
    div.innerHTML +=
      '<div style="display:flex;align-items:center;margin:5px 0;"><span style="background:#dc3545;width:15px;height:15px;display:inline-block;border-radius:50%;margin-right:5px;"></span> Medellín</div>';
    div.innerHTML +=
      '<div style="display:flex;align-items:center;margin:5px 0;"><span style="background:#ffc107;width:15px;height:15px;display:inline-block;border-radius:50%;margin-right:5px;"></span> Envigado</div>';

    return div;
  };

  legend.addTo(map);
  map.legend = legend;
}

// Mostrar historial de rutas resumido
function showRouteHistoryPreview(routeData) {
  routeLayer.clearLayers();
  markersLayer.clearLayers();

  if (!routeData || routeData.length === 0) {
    return;
  }

  // Crear un grupo de capas para hacer fitBounds después
  const bounds = L.latLngBounds();

  // Mostrar puntos de inicio y fin para cada día
  routeData.forEach((day) => {
    if (!day.startPoint || !day.endPoint) return;

    // Añadir al bounds para el fitBounds
    bounds.extend(day.startPoint);
    bounds.extend(day.endPoint);

    // Marcador de inicio
    const startMarker = L.circleMarker(day.startPoint, {
      radius: 6,
      color: '#fff',
      fillColor: '#28a745',
      fillOpacity: 0.7,
      weight: 1,
    }).addTo(markersLayer);

    startMarker.bindPopup(`
            <strong>Inicio de Ruta</strong><br>
            Fecha: ${new Date(day.date).toLocaleDateString()}<br>
            Puntos: ${day.pointCount}
        `);

    // Marcador de fin
    const endMarker = L.circleMarker(day.endPoint, {
      radius: 6,
      color: '#fff',
      fillColor: '#dc3545',
      fillOpacity: 0.7,
      weight: 1,
    }).addTo(markersLayer);

    endMarker.bindPopup(`
            <strong>Fin de Ruta</strong><br>
            Fecha: ${new Date(day.date).toLocaleDateString()}<br>
            Puntos: ${day.pointCount}
        `);

    // Opcional: dibujar línea de vista previa si hay suficientes puntos
    if (day.previewRoute && day.previewRoute.length > 1) {
      L.polyline(day.previewRoute, {
        color: '#007bff',
        weight: 2,
        opacity: 0.5,
        dashArray: '5, 10',
      }).addTo(routeLayer);
    }
  });

  // Ajustar vista si hay puntos
  if (!bounds.isValid()) return;
  map.fitBounds(bounds, { padding: [50, 50] });
}

// Iniciar seguimiento en tiempo real
function startLiveTracking(deviceId, intervalSeconds) {
  if (!deviceId) {
    alert('Por favor seleccione un dispositivo para iniciar el seguimiento');
    return false;
  }

  // Configurar intervalo
  liveTrackingInterval = intervalSeconds * 1000;
  liveTrackingEnabled = true;

  // Crear capa para tracking en tiempo real si no existe
  if (!liveMarker) {
    livePositions = [];

    // Crear polilínea para la ruta en tiempo real
    livePolyline = L.polyline([], {
      color: '#ff4500',
      weight: 4,
      opacity: 0.8,
      dashArray: '10, 10',
    }).addTo(routeLayer);
  }

  // Iniciar la recuperación periódica de la ubicación
  updateLiveLocation(deviceId);

  // Configurar timer para actualizaciones regulares
  trackingTimerId = setInterval(() => {
    updateLiveLocation(deviceId);
  }, liveTrackingInterval);

  return true;
}

// Detener seguimiento en tiempo real
function stopLiveTracking() {
  if (trackingTimerId) {
    clearInterval(trackingTimerId);
    trackingTimerId = null;
  }

  liveTrackingEnabled = false;

  return true;
}

// Actualizar ubicación en tiempo real
async function updateLiveLocation(deviceId) {
  try {
    // Obtener última ubicación
    const result = await getLatestLocation(deviceId);

    if (!result.success || !result.location) {
      console.warn(
        'No se pudo obtener la ubicación en tiempo real:',
        result.message
      );
      return false;
    }

    const location = result.location;

    // Añadir a la lista de posiciones
    livePositions.push([location.lat, location.lng]);

    // Limitar el historial a las últimas 100 posiciones
    if (livePositions.length > 100) {
      livePositions.shift();
    }

    // Actualizar la polilínea
    livePolyline.setLatLngs(livePositions);

    // Eliminar el marcador anterior si existe
    if (liveMarker) {
      markersLayer.removeLayer(liveMarker);
    }

    // Color según ciudad
    let markerColor = '#3388ff'; // Azul por defecto

    if (location.city) {
      switch (location.city.toLowerCase()) {
        case 'bello':
          markerColor = '#28a745'; // Verde
          break;
        case 'medellín':
          markerColor = '#dc3545'; // Rojo
          break;
        case 'envigado':
          markerColor = '#ffc107'; // Amarillo
          break;
      }
    }

    // Crear nuevo marcador
    liveMarker = L.marker([location.lat, location.lng], {
      icon: L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${markerColor};" class="marker-pin"></div><div class="live-marker-pulse"></div>`,
        iconSize: [30, 42],
        iconAnchor: [15, 42],
      }),
    }).addTo(markersLayer);

    // Popup con información
    liveMarker.bindPopup(`
          <strong>Ubicación actual</strong><br>
          <strong>Dispositivo:</strong> ${deviceId}<br>
          <strong>Ciudad:</strong> ${location.city}<br>
          <strong>Hora:</strong> ${new Date(
            location.timestamp
          ).toLocaleString()}<br>
          <strong>Coordenadas:</strong> ${location.lat.toFixed(
            6
          )}, ${location.lng.toFixed(6)}<br>
          <strong>Precisión:</strong> ${location.accuracy.toFixed(1)} metros
          ${
            location.speed
              ? `<br><strong>Velocidad:</strong> ${(
                  location.speed * 3.6
                ).toFixed(1)} km/h`
              : ''
          }
          ${
            location.battery
              ? `<br><strong>Batería:</strong> ${location.battery.toFixed(0)}%`
              : ''
          }
      `);

    // Centrar el mapa en la nueva ubicación
    map.panTo([location.lat, location.lng]);

    return true;
  } catch (error) {
    console.error('Error actualizando ubicación en tiempo real:', error);
    return false;
  }
}

// Estilo CSS para el marcador personalizado
const markerStyle = document.createElement('style');
markerStyle.textContent = `
.marker-pin {
width: 18px;
height: 18px;
border-radius: 50%;
position: absolute;
top: 9px;
left: 9px;
transform: rotate(45deg);
border: 2px solid #fff;
}
.custom-div-icon {
background: none;
border: none;
}
`;
document.head.appendChild(markerStyle);
