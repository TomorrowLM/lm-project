(function () {
  'use strict';

  var banner = document.querySelector('.hero__banner');
  if (!banner) return;

  var imagesAttr = banner.getAttribute('data-images');
  if (!imagesAttr) return;

  var images;
  try {
    images = JSON.parse(imagesAttr);
  } catch (e) {
    return;
  }

  if (!images || images.length === 0) return;

  var currentIndex = 0;
  var total = images.length;
  var throttleTimer = null;
  var THROTTLE_MS = 500;

  function switchTo(index) {
    if (index === currentIndex) return;
    banner.style.opacity = '0';
    setTimeout(function () {
      banner.src = images[index];
      currentIndex = index;
      banner.style.opacity = '1';
    }, 300);
  }

  function next() {
    var nextIndex = (currentIndex + 1) % total;
    switchTo(nextIndex);
  }

  function prev() {
    var prevIndex = (currentIndex - 1 + total) % total;
    switchTo(prevIndex);
  }

  banner.addEventListener('wheel', function (e) {
    if (throttleTimer) return;

    e.preventDefault();

    if (e.deltaY > 0) {
      next();
    } else {
      prev();
    }

    throttleTimer = setTimeout(function () {
      throttleTimer = null;
    }, THROTTLE_MS);
  }, { passive: false });

  // ========================================
  // API Integration Module
  // ========================================

  (function ApiIntegration() {
    'use strict';

    var API_URL = 'http://122.51.80.75:3600/white/test';
    var TIMEOUT_MS = 10000; // 10 seconds
    var dataElement = document.querySelector('.hero__data');

    if (!dataElement) return;

    /**
     * Fetch data from API with timeout
     * @returns {Promise<Object>} API response data
     */
    function fetchData() {
      var controller = new AbortController();
      var timeoutId = setTimeout(function () {
        controller.abort();
      }, TIMEOUT_MS);

      return fetch(API_URL, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: controller.signal
      })
      .then(function (response) {
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error('HTTP error: ' + response.status);
        }

        return response.json();
      })
      .catch(function (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
          throw new Error('请求超时');
        }

        if (error.message.indexOf('Failed to fetch') !== -1) {
          throw new Error('网络连接失败');
        }

        throw error;
      });
    }

    /**
     * Render loading state
     */
    function renderLoading() {
      dataElement.className = 'hero__data hero__data--loading';
      dataElement.textContent = '加载中...';
    }

    /**
     * Render success state with data
     * @param {Object} data - API response data
     */
    function renderSuccess(data) {
      if (!data || !data.info) {
        renderError('数据格式异常');
        console.warn('API response missing data.info:', data);
        return;
      }

      dataElement.className = 'hero__data hero__data--success';
      dataElement.textContent = data.info;
    }

    /**
     * Render error state
     * @param {string} message - Error message
     */
    function renderError(message) {
      dataElement.className = 'hero__data hero__data--error';
      dataElement.textContent = message || '数据加载失败';
    }

    /**
     * Initialize API integration
     */
    function init() {
      renderLoading();

      fetchData()
        .then(function (response) {
          // Check business logic code
          if (response.code === 200) {
            renderSuccess(response.data);
          } else {
            renderError(response.message || '业务错误');
          }
        })
        .catch(function (error) {
          console.error('API request failed:', error);
          renderError(error.message || '数据加载失败');
        });
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
})();
