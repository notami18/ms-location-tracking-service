// public/js/map.js
// Módulo para gestionar el mapa y sus funcionalidades

// Namespace para las funciones del mapa
window.mapUtils = (function () {
  // Variables privadas del módulo
  let map;
  let markers = {};
  let routes = {};
  let devicePaths = {};

  console.log('Inicializando mapa...');

  // Función para inicializar el mapa
  function initMap() {
    // Crear mapa centrado en Medellín
    map = L.map('map').setView([6.2476, -75.5658], 12);

    // Añadir capa de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    console.log('Mapa inicializado correctamente');
    return map;
  }

  // Configurar listeners para eventos del mapa
  function setupMapListeners() {
    console.log('Configurando listeners para actualizaciones de ubicación...');

    // Listener para cuando se completa el movimiento del mapa
    map.on('moveend', function () {
      // Aquí puedes implementar lógica específica cuando el mapa se mueve
    });

    // Listener para cuando se completa el zoom
    map.on('zoomend', function () {
      // Aquí puedes implementar lógica específica cuando cambia el zoom
    });

    console.log('Listeners configurados');
  }

  // Actualizar o crear marcador en el mapa
  function updateMarker(deviceId, lat, lng, popupContent) {
    // Si ya existe el marcador, actualizar posición
    if (markers[deviceId]) {
      markers[deviceId].setLatLng([lat, lng]);
      markers[deviceId].getPopup().setContent(popupContent);
    } else {
      // Crear nuevo marcador
      const marker = L.marker([lat, lng]).addTo(map);
      marker.bindPopup(popupContent);
      markers[deviceId] = marker;
    }

    return markers[deviceId];
  }

  // Centrar mapa en coordenadas
  function centerMap(lat, lng, zoom) {
    if (!map) return;

    // Si se proporciona zoom, usar setView
    if (zoom) {
      map.setView([lat, lng], zoom);
    } else {
      // Si no, solo panear al punto
      map.panTo([lat, lng]);
    }
  }

  // Añadir punto a una ruta en tiempo real
  function addPointToPath(deviceId, point) {
    if (!devicePaths[deviceId]) {
      devicePaths[deviceId] = [point];

      // Crear línea si no existe
      if (!routes[deviceId]) {
        routes[deviceId] = L.polyline([point], {
          color: getRandomColor(),
          weight: 3,
          opacity: 0.7,
        }).addTo(map);
      }
    } else {
      devicePaths[deviceId].push(point);
      routes[deviceId].setLatLngs(devicePaths[deviceId]);
    }
  }

  // Dibujar ruta completa
  function drawFullRoute(deviceId, routePoints) {
    if (!routePoints || routePoints.length === 0) return;

    // Convertir puntos al formato que espera Leaflet
    const points = routePoints.map((point) => [point.lat, point.lng]);

    // Crear línea
    const route = L.polyline(points, {
      color: getRandomColor(),
      weight: 4,
      opacity: 0.8,
    }).addTo(map);

    // Añadir marcadores en puntos importantes
    const startMarker = L.marker(points[0], {
      icon: L.divIcon({
        className: 'route-marker start-marker',
        html: '<i class="fas fa-play"></i>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    }).addTo(map);

    const endMarker = L.marker(points[points.length - 1], {
      icon: L.divIcon({
        className: 'route-marker end-marker',
        html: '<i class="fas fa-flag-checkered"></i>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    }).addTo(map);

    // Guardar referencia
    routes[deviceId] = route;

    // Ajustar mapa para mostrar toda la ruta
    map.fitBounds(route.getBounds(), { padding: [50, 50] });

    return route;
  }

  // Limpiar mapa (marcadores y rutas)
  function clearMap() {
    // Limpiar marcadores
    Object.values(markers).forEach((marker) => {
      map.removeLayer(marker);
    });
    markers = {};

    // Limpiar rutas
    clearRoutes();
  }

  // Limpiar rutas
  function clearRoutes() {
    Object.values(routes).forEach((route) => {
      map.removeLayer(route);
    });
    routes = {};
    devicePaths = {};
  }

  // Obtener color aleatorio para rutas
  function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  // Función para buscar ubicaciones en un área
  function searchInArea(lat, lng, radius) {
    // Implementar lógica para buscar en área
    console.log(
      `Buscando ubicaciones cerca de [${lat}, ${lng}] con radio ${radius}m`
    );

    // Mostrar área de búsqueda
    const circle = L.circle([lat, lng], {
      radius: radius,
      color: '#3498db',
      fillColor: '#3498db',
      fillOpacity: 0.2,
    }).addTo(map);

    // Centrar mapa en área
    map.fitBounds(circle.getBounds());

    return circle;
  }

  // Inicializar cuando el DOM esté cargado
  document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM cargado, inicializando componentes...');

    // Inicializar mapa
    initMap();

    // Configurar listeners
    setupMapListeners();

    console.log('Componentes inicializados');
  });

  // Exponer funciones públicas
  return {
    initMap,
    updateMarker,
    centerMap,
    addPointToPath,
    drawFullRoute,
    clearMap,
    clearRoutes,
    searchInArea,
    getRandomColor,
  };
})();
