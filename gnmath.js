(function(){
'use strict';

class AdBlockDetector {
  constructor(document, config) {
    this.document = document;
    this.config = config;
    this.pubId = config.getField(1); // "pub-5521219086088837"
    this.checkUrl = config.getField(2) || "https://fundingchoicemessages.google.com/b/pub-5521219086088837";
    this.scriptUrl = config.getField(13) || "https://fundingchoicemessages.google.com/el/AGSKWxUdJ72GavzpjZZtOS2Ov-xzQG-5QvSnpPh8BvEnFTDDYLj1eOmWMSb_C9b1cP8VLXiyUxnJ7IXDDEDULWozs7eqQ==";
    this.hasShownWarning = false;
    this.warningElement = null;
    this.testElements = [];
  }

  start() {
    this.detectAdBlock();
  }

  detectAdBlock() {
    this.checkPreload();
    this.loadScript(this.checkUrl, 3, false, 
      () => {
        // Скрипт загрузился успешно - реклама не блокируется
        this.loadAd(this.config.getField(14));
      },
      () => {
        // Скрипт не загрузился - возможна блокировка
        this.showBlockingTest();
      }
    );
  }

  loadScript(url, retries, removeOnLoad, successCallback, errorCallback) {
    try {
      const script = this.document.createElement('script');
      script.async = true;
      
      // Безопасная установка src с nonce
      script.src = url;
      const nonceEl = this.document.querySelector('script[nonce]');
      if (nonceEl) {
        const nonce = nonceEl.nonce || nonceEl.getAttribute('nonce') || '';
        nonce && script.setAttribute('nonce', nonce);
      }
      
      this.document.head.appendChild(script);
      
      script.addEventListener('load', () => {
        successCallback();
        if (removeOnLoad) {
          this.document.head.removeChild(script);
        }
      });
      
      script.addEventListener('error', () => {
        if (retries > 0) {
          this.loadScript(url, retries - 1, removeOnLoad, successCallback, errorCallback);
        } else {
          if (removeOnLoad) {
            this.document.head.removeChild(script);
          }
          errorCallback();
        }
      });
    } catch (error) {
      errorCallback();
    }
  }

  checkPreload() {
    const key = btoa(this.pubId);
    if (window[key]) {
      // Предзагруженный контент доступен
      this.loadAd(this.config.getField(5));
    }
  }

  showBlockingTest() {
    // Показать начальное сообщение
    this.loadAd(this.config.getField(8));
    
    // Запустить тест на блокировку
    this.runBlockTest(
      () => {
        // Тест провален - точно есть блокировщик
        this.loadAd(this.config.getField(7));
        this.showWarning();
      },
      () => {
        // Тест пройден - возможно временная проблема
        this.loadAd(this.config.getField(6));
      },
      this.config.getField(9),
      this.config.getIntField(10),
      this.config.getIntField(11)
    );
  }

  runBlockTest(onBlocked, onNotBlocked, className, timeout, retries) {
    const createTestElement = (parent) => {
      const testDiv = this.document.createElement('div');
      testDiv.className = className;
      testDiv.style.width = '1px';
      testDiv.style.height = '1px';
      testDiv.style.position = 'absolute';
      testDiv.style.left = '-10000px';
      testDiv.style.top = '-10000px';
      testDiv.style.zIndex = '-10000';
      
      parent.appendChild(testDiv);
      
      setTimeout(() => {
        if (testDiv) {
          if (testDiv.offsetHeight !== 0 && testDiv.offsetWidth !== 0) {
            // Элемент видим - блокировщика нет
            onNotBlocked();
          } else {
            // Элемент скрыт - есть блокировщик
            onBlocked();
          }
          testDiv.parentNode && testDiv.parentNode.removeChild(testDiv);
        } else {
          onBlocked();
        }
      }, timeout);
    };

    const attemptCreation = (remainingAttempts) => {
      if (this.document.body) {
        createTestElement(this.document.body);
      } else if (remainingAttempts > 0) {
        setTimeout(() => attemptCreation(remainingAttempts - 1), timeout);
      } else {
        onBlocked();
      }
    };

    attemptCreation(retries || 3);
  }

  showWarning() {
    if (this.document.body && !this.hasShownWarning) {
      this.createWarningMessage();
      this.hasShownWarning = true;
      
      // Проверить отображение и повторно показать если нужно
      setTimeout(() => {
        this.verifyWarningDisplay(3);
      }, 50);
    }
  }

  verifyWarningDisplay(retries) {
    if (retries <= 0 || 
        (this.warningElement && 
         this.warningElement.offsetHeight !== 0 && 
         this.warningElement.offsetWidth !== 0)) {
      return;
    }
    
    // Удалить и пересоздать если не отображается
    if (this.warningElement && this.warningElement.parentNode) {
      this.warningElement.parentNode.removeChild(this.warningElement);
    }
    
    this.createWarningMessage();
    
    setTimeout(() => {
      this.verifyWarningDisplay(retries - 1);
    }, 50);
  }

  createWarningMessage() {
    // Удалить старый элемент если есть
    if (this.warningElement && this.warningElement.parentNode) {
      this.warningElement.parentNode.removeChild(this.warningElement);
    }

    // Создаем контейнер предупреждения
    const warningContainer = this.document.createElement('div');
    warningContainer.className = 'google-funding-choices-warning';
    warningContainer.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      width: ${this.getRandom(100, 110)}%;
      z-index: ${this.getRandom(2147483544, 2147483644)};
      background-color: rgb(${this.getRandom(249, 259)}, ${this.getRandom(242, 252)}, ${this.getRandom(219, 229)});
      box-shadow: 0 0 12px #888;
      color: rgb(${this.getRandom(0, 10)}, ${this.getRandom(0, 10)}, ${this.getRandom(0, 10)});
      display: flex;
      justify-content: center;
      font-family: Roboto, Arial;
    `;

    // Внутренний контейнер
    const innerContainer = this.document.createElement('div');
    innerContainer.style.cssText = `
      width: ${this.getRandom(80, 85)}%;
      max-width: ${this.getRandom(750, 775)}px;
      margin: 24px;
      display: flex;
      align-items: flex-start;
      justify-content: center;
    `;

    // Иконка предупреждения
    const icon = this.document.createElement('img');
    icon.className = this.generateId();
    icon.src = 'https://www.gstatic.com/images/icons/material/system/1x/warning_amber_24dp.png';
    icon.alt = 'Warning icon';
    icon.style.cssText = `
      height: 24px;
      width: 24px;
      padding-right: 16px;
    `;

    // Текстовый контейнер
    const textContainer = this.document.createElement('div');
    
    // Добавляем случайные элементы для обхода блокировщиков
    for (let i = 0; i < this.getRandom(1, 5); i++) {
      const spacer = this.document.createElement('div');
      spacer.className = this.generateId();
      textContainer.appendChild(spacer);
    }
    
    // Заголовок
    const title = this.document.createElement('div');
    title.style.fontWeight = 'bold';
    title.textContent = 'You are seeing this message because ad or script blocking software is interfering with this page.';
    
    // Еще случайные элементы
    for (let i = 0; i < this.getRandom(1, 5); i++) {
      const spacer = this.document.createElement('div');
      spacer.className = this.generateId();
      textContainer.appendChild(spacer);
    }
    
    // Описание
    const description = this.document.createElement('div');
    description.textContent = 'Disable any ad or script blocking software, then reload this page.';
    
    // Финальные случайные элементы
    for (let i = 0; i < this.getRandom(1, 5); i++) {
      const spacer = this.document.createElement('div');
      spacer.className = this.generateId();
      textContainer.appendChild(spacer);
    }

    // Собираем структуру
    textContainer.appendChild(title);
    textContainer.appendChild(description);
    
    // Добавляем случайные элементы вокруг иконки
    for (let i = 0; i < this.getRandom(1, 5); i++) {
      const spacer = this.document.createElement('div');
      spacer.className = this.generateId();
      innerContainer.appendChild(spacer);
    }
    
    innerContainer.appendChild(icon);
    innerContainer.appendChild(textContainer);
    
    // Добавляем случайные элементы вокруг внутреннего контейнера
    for (let i = 0; i < this.getRandom(1, 5); i++) {
      const spacer = this.document.createElement('div');
      spacer.className = this.generateId();
      warningContainer.appendChild(spacer);
    }
    
    warningContainer.appendChild(innerContainer);
    
    // Финальные случайные элементы
    for (let i = 0; i < this.getRandom(1, 5); i++) {
      const spacer = this.document.createElement('div');
      spacer.className = this.generateId();
      warningContainer.appendChild(spacer);
    }
    
    // Добавляем на страницу
    this.document.body.appendChild(warningContainer);
    this.warningElement = warningContainer;
    
    // Добавляем случайные элементы на страницу для обхода блокировщиков
    for (let i = 0; i < this.getRandom(1, 5); i++) {
      const randomEl = this.document.createElement('div');
      randomEl.className = this.generateId();
      this.document.body.appendChild(randomEl);
      this.testElements.push(randomEl);
    }
  }

  getRandom(min, max) {
    return Math.floor(min + Math.random() * (max - min));
  }

  generateId() {
    return Math.floor(Math.random() * 2147483648).toString(36) + 
           Math.abs(Math.floor(Math.random() * 2147483648) ^ Date.now()).toString(36);
  }

  loadAd(url) {
    if (!this.hasShownWarning && url) {
      this.hasShownWarning = true;
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.send();
      } catch (error) {
        console.error('Failed to load ad:', error);
      }
    }
  }

  cleanup() {
    // Удалить все тестовые элементы
    this.testElements.forEach(el => {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    this.testElements = [];
    
    // Удалить предупреждение
    if (this.warningElement && this.warningElement.parentNode) {
      this.warningElement.parentNode.removeChild(this.warningElement);
      this.warningElement = null;
    }
  }
}

// Конфигурация с реальными URL
const config = {
  fields: {
    1: "pub-5521219086088837",
    2: "https://fundingchoicemessages.google.com/b/pub-5521219086088837",
    5: "https://fundingchoicemessages.google.com/el/AGSKWxXg8sBPZD_Puv3vZ-knZmrxjg0A7GxlDW2avGH83bSoKCDzwbr3XTrU0atVnyRtIw6B4lQZ7WB7zd7hR8-5QHq1jOQ==",
    6: "https://fundingchoicemessages.google.com/el/AGSKWxXKh5Ks6QpYlu6x8vobS9721JGYrvBdluO2XWGCGu_iBBbpitTz-_prG1-vjb-QUU7wb8EwIJdgT0q9KfGfd4CyjA==",
    7: "https://fundingchoicemessages.google.com/el/AGSKWxXg_NTdedJqZ2JaODBHI9acOSoI9QlEiJNGG25APFjhcweM1Ua2-EelBz7kl2J1gG0mvWBr9SQZ008_ORgPzBonVg==",
    8: "https://fundingchoicemessages.google.com/el/AGSKWxhK7DGKu_ql6HsVAVdOUgtvt_ZqUVRROi2-YmKGgDvsIOl0m2rkl-lsWABV4uAY7CXB099lhKUV2dldtejaDgk7g==",
    9: "google-ads-test-element",
    10: "50",
    11: "3",
    12: "https://fundingchoicemessages.google.com/el/AGSKWxXJ72GavzjqZZtOS2Ov-xzQG-5QvSnpPh8BvEnFTDDYLj1eOmWMSb_C9b1cP8VLXiyUxnJ7IXDDEDULWozs7eqQ==",
    13: "https://fundingchoicemessages.google.com/el/AGSKWxUdJ72GavzpjZZtOS2Ov-xzQG-5QvSnpPh8BvEnFTDDYLj1eOmWMSb_C9b1cP8VLXiyUxnJ7IXDDEDULWozs7eqQ==",
    14: "https://fundingchoicemessages.google.com/el/AGSKWxX_4TDedJqZ2JaODBHI9acOSoI9QlEiJNGG25APFjhcweM1Ua2-EelBz7kl2J1gG0mvWBr9SQZ008_ORgPzBonVg=="
  },
  
  getField: function(id) {
    return this.fields[id] || "";
  },
  
  getIntField: function(id) {
    const value = this.getField(id);
    return value ? parseInt(value, 10) : 0;
  }
};

// Основная функция инициализации
function initializeAdBlockDetector(encodedConfig) {
  try {
    const decodedConfig = JSON.parse(atob(encodedConfig));
    const fullConfig = {
      fields: decodedConfig,
      getField: function(id) { 
        const val = this.fields[id];
        return val != null ? String(val) : "";
      },
      getIntField: function(id) { 
        const val = this.getField(id);
        return val ? parseInt(val, 10) : 0;
      }
    };
    
    const detector = new AdBlockDetector(document, fullConfig);
    detector.start();
    
    // Очистка при закрытии страницы
    window.addEventListener('beforeunload', () => {
      detector.cleanup();
    });
    
    return detector;
  } catch (error) {
    console.error('Failed to initialize ad block detector:', error);
    return null;
  }
}

// Автоматическая инициализация при загрузке DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Использовать конфиг по умолчанию
    const defaultConfig = btoa(JSON.stringify(config.fields));
    initializeAdBlockDetector(defaultConfig);
  });
} else {
  // DOM уже загружен
  const defaultConfig = btoa(JSON.stringify(config.fields));
  initializeAdBlockDetector(defaultConfig);
}

// Экспорт глобальной функции
window.__h82AlnkH6D91__ = initializeAdBlockDetector;

// Вызов с оригинальной конфигурацией
window.__h82AlnkH6D91__("WyJwdWItNTUyMTIxOTA4NjA4ODgzNyIsW251bGwsbnVsbCxudWxsLCJodHRwczovL2Z1bmRpbmdjaG9pY2VzbWVzc2FnZXMuZ29vZ2xlLmNvbS9iL3B1Yi01NTIxMjE5MDg2MDg4ODM3Il0sbnVsbCxudWxsLCJodHRwczovL2Z1bmRpbmdjaG9pY2VzbWVzc2FnZXMuZ29vZ2xlLmNvbS9lbC9BR1NLV3hVVklJMjdES3VfcWw2SHNWQVZkT1VndHZ0X3JacVVWUk9pMi1ZbUtHZ0R2c0lPbDBtMnJrbC1sc1dBSFY0dUFZN0NYQjA5OWxoS1VWMmRsdGVqYURnazdnXHUwMDNkXHUwMDNkP3RlXHUwMDNkVE9LRU5fRVhQT1NFRCIsImh0dHBzOi8vZnVuZGluZ2Nob2ljZXNtZXNzYWdlcy5nb29nbGUuY29tL2VsL0FHU0tXeFVkSjcyR2F2enBqWlp0T1MyT3YteHpRRy01UXZTbnBQaDhCdkVuRlRERFlMajFlT21XTVNiX0M5YjFjUDhWTFhpeVV4UW5KN0lYREVEVUxXb3pzczdlcFFcdTAwM2RcdTAwM2Q/YWJcdTAwM2QxXHUwMDI2c2JmXHUwMDNkMSIsImh0dHBzOi8vZnVuZGluZ2Nob2ljZXNtZXNzYWdlcy5nb29nbGUuY29tL2VsL0FHU0tXeFg4c0JQWkRfUHV2M3ZaLWtuWm1yeGpnMEE3R3hsRFcyYXZHSDgzYlNvS0NEendicjNYVHJVMGF0Vm55UnRJdzZCNGxRWjdXQjd6ZDdoUjgtNVFIcTFpT1FcdTAwM2RcdTAwM2Q/YWJcdTAwM2QyXHUwMDI2c2JmXHUwMDNkMSIsImh0dHBzOi8vZnVuZGluZ2Nob2ljZXNtZXNzYWdlcy5nb29nbGUuY29tL2VsL0FHU0tXeFhLaDVLczZRcFlsdTZ4OHZvYlM5NzIxSkdZcnZCZGx1TzJYV0dDR3VfaUJCQnBpdFR6LV9wckcxLXZqYi1SUVU3d2I4RXdJSmRnVDBxOUtmR2ZkNEN5akFcdTAwM2RcdTAwM2Q/c2JmXHUwMDNkMiIsImRpdi1ncHQtYWQiLDIwLDEwMCwiY0hWaUxUVTFNakV5TVRrd09EWXdPRGc0TXpjXHUwMDNkIixbbnVsbCxudWxsLG51bGwsImh0dHBzOi8vd3d3LmdzdGF0aWMuY29tLzBlbW4vZi9wL3B1Yi01NTIxMjE5MDg2MDg4ODM3LmpzP3VzcXBcdTAwM2RDQUkiXSwiaHR0cHM6Ly9mdW5kaW5nY2hvaWNlc21lc3NhZ2VzLmdvb2dsZS5jb20vZWwvQUdTS1d4WGdfNFREZWRKcVoySmFPREJITTlhY09Tb0k5UWxFaUpOR0cyNUFQRmpoY3dlTTFVYTItRWVsQno3a2wySjFnRzBtdldCcjlTUVowMDhfT1JnUHpCb052Z1x1MDAzZFx1MDAzZCJd");

})();
