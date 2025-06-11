// public/js/deviceHistory.js
/**
 * Módulo para gestionar el historial de dispositivos
 */
(function () {
  // Variables del módulo
  let deviceHistoryList = [];
  let filteredDevices = [];
  let selectedDeviceId = null;
  let currentFilter = {
    days: 30,
    onlyActive: false,
    searchText: '',
  };

  // Elementos DOM
  let deviceHistoryContainer;
  let deviceHistoryFilterDays;
  let deviceHistorySearchInput;
  let deviceHistoryActiveToggle;

  // Inicialización al cargar el DOM
  document.addEventListener('DOMContentLoaded', function () {
    console.log('Inicializando módulo de historial de dispositivos');
    initializeElements();
    loadDeviceHistory();
  });

  // Inicializar elementos DOM
  function initializeElements() {
    // Buscar contenedor de historial (si no existe, crearlo)
    deviceHistoryContainer = document.getElementById('deviceHistoryList');
    if (!deviceHistoryContainer) {
      createHistoryUI();
      deviceHistoryContainer = document.getElementById('deviceHistoryList');
    }

    // Obtener elementos de filtro
    deviceHistoryFilterDays = document.getElementById(
      'deviceHistoryFilterDays'
    );
    deviceHistorySearchInput = document.getElementById('deviceHistorySearch');
    deviceHistoryActiveToggle = document.getElementById(
      'deviceHistoryActiveToggle'
    );

    // Configurar eventos
    if (deviceHistoryFilterDays) {
      deviceHistoryFilterDays.addEventListener('change', function () {
        currentFilter.days = parseInt(this.value) || 30;
        loadDeviceHistory();
      });
    }

    if (deviceHistorySearchInput) {
      deviceHistorySearchInput.addEventListener('input', function () {
        currentFilter.searchText = this.value.trim().toLowerCase();
        filterDevices();
        renderDeviceHistory();
      });
    }

    if (deviceHistoryActiveToggle) {
      deviceHistoryActiveToggle.addEventListener('change', function () {
        currentFilter.onlyActive = this.checked;
        loadDeviceHistory();
      });
    }
  }

  // Crear interfaz de usuario para historial
  function createHistoryUI() {
    // Buscar el contenedor sidebar
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) {
      console.warn(
        'No se encontró el contenedor sidebar para agregar el historial'
      );
      return;
    }

    // Crear sección de historial después de dispositivos activos
    const deviceListContainer = document.querySelector(
      '.device-list-container'
    );
    const historySection = document.createElement('div');
    historySection.className = 'device-history-container';
    historySection.innerHTML = `
          <h2>Historial de Dispositivos</h2>
          <div class="history-filters">
              <div class="filter-group">
                  <label for="deviceHistoryFilterDays">Últimos días:</label>
                  <select id="deviceHistoryFilterDays">
                      <option value="7">7 días</option>
                      <option value="30" selected>30 días</option>
                      <option value="90">90 días</option>
                      <option value="0">Todos</option>
                  </select>
              </div>
              <div class="filter-group">
                  <label for="deviceHistorySearch">Buscar:</label>
                  <input type="text" id="deviceHistorySearch" placeholder="ID o Ciudad">
              </div>
              <div class="filter-group toggle-container">
                  <label for="deviceHistoryActiveToggle">Solo activos:</label>
                  <label class="switch">
                      <input type="checkbox" id="deviceHistoryActiveToggle">
                      <span class="slider"></span>
                  </label>
              </div>
          </div>
          <ul id="deviceHistoryList" class="device-history-list">
              <li class="no-devices">Cargando dispositivos...</li>
          </ul>
      `;

    // Insertar después de la lista de dispositivos activos
    if (deviceListContainer && deviceListContainer.nextSibling) {
      sidebar.insertBefore(historySection, deviceListContainer.nextSibling);
    } else {
      sidebar.appendChild(historySection);
    }

    // Añadir estilos CSS
    const styleSheet = document.createElement('style');
    styleSheet.type = 'text/css';
    styleSheet.innerText = `
          .device-history-container {
              margin-bottom: 1.5rem;
              border-bottom: 1px solid #eee;
              padding-bottom: 1.5rem;
          }
          .device-history-container h2 {
              margin-bottom: 1rem;
              font-size: 1.2rem;
              color: #2c3e50;
          }
          .history-filters {
              margin-bottom: 1rem;
          }
          .filter-group {
              margin-bottom: 0.5rem;
          }
          .filter-group label {
              display: block;
              margin-bottom: 0.3rem;
              font-weight: 500;
          }
          .filter-group input,
          .filter-group select {
              width: 100%;
              padding: 0.4rem;
              border: 1px solid #ddd;
              border-radius: 4px;
          }
          .device-history-list {
              list-style: none;
              max-height: 200px;
              overflow-y: auto;
          }
          .device-history-item {
              padding: 0.7rem;
              border-bottom: 1px solid #eee;
              display: flex;
              justify-content: space-between;
              align-items: center;
              cursor: pointer;
              transition: background-color 0.2s;
          }
          .device-history-item:hover {
              background-color: #f5f5f5;
          }
          .device-history-item.selected {
              background-color: #e3f2fd;
          }
          .device-info {
              display: flex;
              flex-direction: column;
          }
          .device-id {
              font-weight: 500;
              color: #2c3e50;
          }
          .device-time {
              font-size: 0.8rem;
              color: #7f8c8d;
          }
          .device-city {
              font-size: 0.8rem;
              color: #3498db;
          }
          .device-active {
              display: inline-block;
              width: 8px;
              height: 8px;
              background-color: #2ecc71;
              border-radius: 50%;
              margin-right: 4px;
          }
          .device-inactive {
              display: inline-block;
              width: 8px;
              height: 8px;
              background-color: #e74c3c;
              border-radius: 50%;
              margin-right: 4px;
          }
      `;
    document.head.appendChild(styleSheet);
  }

  // Cargar historial de dispositivos
  async function loadDeviceHistory() {
    try {
      // Mostrar estado de carga
      deviceHistoryContainer.innerHTML =
        '<li class="no-devices">Cargando dispositivos...</li>';

      // Construir URL con filtros
      const url = `/api/history/devices?days=${currentFilter.days}&onlyActive=${currentFilter.onlyActive}`;

      // Realizar solicitud
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        deviceHistoryList = data.devices || [];
        console.log(
          `Cargados ${deviceHistoryList.length} dispositivos históricos`
        );

        // Aplicar filtros
        filterDevices();
        renderDeviceHistory();
      } else {
        deviceHistoryContainer.innerHTML =
          '<li class="no-devices">Error cargando dispositivos</li>';
      }
    } catch (error) {
      console.error('Error cargando historial de dispositivos:', error);
      deviceHistoryContainer.innerHTML =
        '<li class="no-devices">Error de conexión</li>';
    }
  }

  // Filtrar dispositivos según criterios actuales
  function filterDevices() {
    if (!deviceHistoryList || deviceHistoryList.length === 0) {
      filteredDevices = [];
      return;
    }

    // Aplicar filtro de texto si existe
    if (currentFilter.searchText) {
      filteredDevices = deviceHistoryList.filter((device) => {
        return (
          device.deviceId.toLowerCase().includes(currentFilter.searchText) ||
          (device.city &&
            device.city.toLowerCase().includes(currentFilter.searchText))
        );
      });
    } else {
      filteredDevices = [...deviceHistoryList];
    }
  }

  // Renderizar lista de dispositivos
  function renderDeviceHistory() {
    if (!deviceHistoryContainer) return;

    // Limpiar contenedor
    deviceHistoryContainer.innerHTML = '';

    // Verificar si hay dispositivos para mostrar
    if (filteredDevices.length === 0) {
      deviceHistoryContainer.innerHTML =
        '<li class="no-devices">No hay dispositivos disponibles</li>';
      return;
    }

    // Crear elementos para cada dispositivo
    filteredDevices.forEach((device) => {
      const lastSeen = new Date(device.lastSeen).toLocaleString();
      const li = document.createElement('li');
      li.className = `device-history-item ${
        device.deviceId === selectedDeviceId ? 'selected' : ''
      }`;
      li.dataset.deviceId = device.deviceId;

      li.innerHTML = `
              <div class="device-info">
                  <span class="device-id">
                      <span class="${
                        device.isActive ? 'device-active' : 'device-inactive'
                      }"></span>
                      ${device.deviceId}
                  </span>
                  <span class="device-time">${lastSeen}</span>
                  ${
                    device.city
                      ? `<span class="device-city">${device.city}</span>`
                      : ''
                  }
              </div>
              <div class="device-actions">
                  <button class="btn btn-sm btn-primary history-locate-btn" title="Ver ubicación">
                      <i class="fas fa-map-marker-alt"></i>
                  </button>
              </div>
          `;

      // Evento de clic para seleccionar dispositivo
      li.addEventListener('click', function (e) {
        // Ignorar si se hizo clic en el botón
        if (e.target.closest('.history-locate-btn')) return;

        selectHistoricalDevice(device.deviceId);
      });

      // Evento para el botón de localizar
      const locateBtn = li.querySelector('.history-locate-btn');
      if (locateBtn) {
        locateBtn.addEventListener('click', function () {
          locateHistoricalDevice(device.deviceId);
        });
      }

      deviceHistoryContainer.appendChild(li);
    });
  }

  // Seleccionar dispositivo del historial
  function selectHistoricalDevice(deviceId) {
    // Actualizar selección
    selectedDeviceId = deviceId;

    // Actualizar interfaz
    const items = document.querySelectorAll('.device-history-item');
    items.forEach((item) => {
      item.classList.toggle('selected', item.dataset.deviceId === deviceId);
    });

    // Seleccionar en el dropdown global (si existe)
    const deviceSelect = document.getElementById('deviceSelect');
    if (deviceSelect) {
      // Verificar si el dispositivo existe en el dropdown
      const exists = Array.from(deviceSelect.options).some(
        (option) => option.value === deviceId
      );

      if (exists) {
        deviceSelect.value = deviceId;

        // Disparar evento change
        const event = new Event('change');
        deviceSelect.dispatchEvent(event);
      } else {
        // Si no existe, añadirlo
        const option = document.createElement('option');
        option.value = deviceId;
        option.textContent = deviceId;
        deviceSelect.appendChild(option);

        deviceSelect.value = deviceId;

        // Disparar evento change
        const event = new Event('change');
        deviceSelect.dispatchEvent(event);
      }
    }
  }

  // Localizar dispositivo histórico en el mapa
  function locateHistoricalDevice(deviceId) {
    // Buscar dispositivo en la lista filtrada
    const device = filteredDevices.find((d) => d.deviceId === deviceId);
    if (!device) return;

    // Seleccionar en la lista
    selectHistoricalDevice(deviceId);

    // Usar función global para localizar si está disponible
    if (window.fetchLatestLocation) {
      window.fetchLatestLocation(deviceId);
    } else {
      console.warn('Función fetchLatestLocation no disponible');

      // Implementación alternativa básica
      if (
        device.location &&
        device.location.coordinates &&
        device.location.coordinates.length === 2 &&
        window.map
      ) {
        // Crear marcador temporal
        const lat = device.location.coordinates[1];
        const lng = device.location.coordinates[0];

        // Centrar mapa
        window.map.setView([lat, lng], 15);

        // Mostrar popup con información
        const popup = L.popup()
          .setLatLng([lat, lng])
          .setContent(
            `
                      <strong>${device.deviceId}</strong><br>
                      Última vez visto: ${new Date(
                        device.lastSeen
                      ).toLocaleString()}<br>
                      ${device.city ? `Ciudad: ${device.city}<br>` : ''}
                      ${
                        device.isActive
                          ? '<span class="device-active-text">Activo</span>'
                          : '<span class="device-inactive-text">Inactivo</span>'
                      }
                  `
          )
          .openOn(window.map);
      }
    }
  }

  // Actualizar lista cuando se reciben datos nuevos
  window.addEventListener('deviceUpdated', function (e) {
    if (e.detail && e.detail.deviceId) {
      loadDeviceHistory();
    }
  });

  // Exponer funciones públicas
  window.deviceHistory = {
    loadDeviceHistory,
    selectHistoricalDevice,
    locateHistoricalDevice,
  };
})();
