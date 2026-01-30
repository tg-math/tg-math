const container = document.getElementById('container');
const zoneViewer = document.getElementById('zoneViewer');
let zoneFrame = document.getElementById('zoneFrame');
const searchBar = document.getElementById('searchBar');
const sortOptions = document.getElementById('sortOptions');
const filterOptions = document.getElementById('filterOptions');

const zonesurls = [
    "https://cdn.jsdelivr.net/%67%68/%67%6e%2d%6d%61%74%68/%61%73%73%65%74%73@%6d%61%69%6e/%7a%6f%6e%65%73%2e%6a%73%6f%6e",
    "https://cdn.jsdelivr.net/gh/gn-math/assets@latest/zones.json",
    "https://cdn.jsdelivr.net/gh/gn-math/assets@master/zones.json",
    "https://cdn.jsdelivr.net/gh/gn-math/assets/zones.json"
];

let zonesURL = zonesurls[Math.floor(Math.random() * zonesurls.length)];
const coverURL = "https://cdn.jsdelivr.net/gh/gn-math/covers@main";
const htmlURL = "https://cdn.jsdelivr.net/gh/gn-math/html@main";
let zones = [];
let popularityData = {};
const featuredContainer = document.getElementById('featuredZones');

function toTitleCase(str) {
    return str.replace(
        /\w\S*/g,
        text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
    );
}

async function listZones() {
    try {
        let sharesponse;
        let shajson;
        let sha;
        
        try {
            sharesponse = await fetch("https://api.github.com/repos/gn-math/assets/commits?t=" + Date.now());
        } catch (error) {
            console.error("Failed to fetch commits:", error);
        }
        
        if (sharesponse && sharesponse.status === 200) {
            try {
                shajson = await sharesponse.json();
                sha = shajson[0]['sha'];
                if (sha) {
                    zonesURL = `https://cdn.jsdelivr.net/gh/gn-math/assets@${sha}/zones.json`;
                }
            } catch (error) {
                try {
                    let secondarysharesponse = await fetch("https://raw.githubusercontent.com/gn-math/xml/refs/heads/main/sha.txt?t=" + Date.now());
                    if (secondarysharesponse && secondarysharesponse.status === 200) {
                        sha = (await secondarysharesponse.text()).trim();
                        if (sha) {
                            zonesURL = `https://cdn.jsdelivr.net/gh/gn-math/assets@${sha}/zones.json`;
                        }
                    }
                } catch (error) {
                    console.error("Failed to fetch secondary sha:", error);
                }
            }
        }
        
        const response = await fetch(zonesURL + "?t=" + Date.now());
        const json = await response.json();
        zones = json;
        zones[0].featured = true;
        
        await fetchPopularity();
        sortZones();
        
        const search = new URLSearchParams(window.location.search);
        const id = search.get('id');
        const embed = window.location.hash.includes("embed");
        
        if (id) {
            const zone = zones.find(zone => zone.id + '' == id + '');
            if (zone) {
                if (embed) {
                    if (zone.url.startsWith("http")) {
                        window.open(zone.url, "_blank");
                    } else {
                        const url = zone.url.replace("{COVER_URL}", coverURL).replace("{HTML_URL}", htmlURL);
                        fetch(url + "?t=" + Date.now()).then(response => response.text()).then(html => {
                            document.documentElement.innerHTML = html;
                            const popup = document.createElement("div");
                            popup.style.position = "fixed";
                            popup.style.bottom = "20px";
                            popup.style.right = "20px";
                            popup.style.backgroundColor = "#cce5ff";
                            popup.style.color = "#004085";
                            popup.style.padding = "10px";
                            popup.style.border = "1px solid #b8daff";
                            popup.style.borderRadius = "5px";
                            popup.style.boxShadow = "0px 0px 10px rgba(0,0,0,0.1)";
                            popup.style.fontFamily = "Arial, sans-serif";
                            
                            popup.innerHTML = `Play more games at <a href="https://gn-math.github.io" target="_blank" style="color:#004085; font-weight:bold;">https://gn-math.github.io</a>!`;
                            
                            const closeBtn = document.createElement("button");
                            closeBtn.innerText = "?";
                            closeBtn.style.marginLeft = "10px";
                            closeBtn.style.background = "none";
                            closeBtn.style.border = "none";
                            closeBtn.style.cursor = "pointer";
                            closeBtn.style.color = "#004085";
                            closeBtn.style.fontWeight = "bold";
                            
                            closeBtn.onclick = () => popup.remove();
                            popup.appendChild(closeBtn);
                            document.body.appendChild(popup);
                            
                            document.documentElement.querySelectorAll('script').forEach(oldScript => {
                                const newScript = document.createElement('script');
                                if (oldScript.src) {
                                    newScript.src = oldScript.src;
                                } else {
                                    newScript.textContent = oldScript.textContent;
                                }
                                document.body.appendChild(newScript);
                            });
                        }).catch(error => alert("Failed to load zone: " + error));
                    }
                } else {
                    openZone(zone);
                }
            }
        }

        let alltags = [];
        for (const obj of json) {
            if (Array.isArray(obj.special)) {
                alltags.push(...obj.special);
            }
        }

        alltags = [...new Set(alltags)];
        let filteroption = document.getElementById("filterOptions");
        if (filteroption && filteroption.children.length > 1) {
            while (filteroption.children.length > 1) {
                filteroption.removeChild(filteroption.lastElementChild);
            }
        }
        
        for (const tag of alltags) {
            const opt = document.createElement("option");
            opt.value = tag;
            opt.textContent = toTitleCase(tag);
            filteroption.appendChild(opt);
        }
    } catch (error) {
        console.error(error);
        container.innerHTML = `Error loading zones: ${error}`;
    }
}

async function fetchPopularity() {
    try {
        const response = await fetch("https://data.jsdelivr.com/v1/stats/packages/gh/gn-math/html@main/files?period=year");
        const data = await response.json();
        data.forEach(file => {
            const idMatch = file.name.match(/\/(\d+)\.html$/);
            if (idMatch) {
                const id = parseInt(idMatch[1]);
                popularityData[id] = file.hits.total;
            }
        });
    } catch (error) {
        console.error("Failed to fetch popularity:", error);
        popularityData[0] = 0;
    }
}

function sortZones() {
    const sortBy = sortOptions.value;
    
    if (sortBy === 'name') {
        zones.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'id') {
        zones.sort((a, b) => a.id - b.id);
    } else if (sortBy === 'popular') {
        zones.sort((a, b) => (popularityData[b.id] || 0) - (popularityData[a.id] || 0));
    }
    
    zones.sort((a, b) => (a.id === -1 ? -1 : b.id === -1 ? 1 : 0));
    
    if (featuredContainer.innerHTML === "") {
        const featured = zones.filter(z => z.featured);
        displayFeaturedZones(featured);
    }
    
    displayZones(zones);
}

function displayFeaturedZones(featuredZones) {
    featuredContainer.innerHTML = "";
    
    featuredZones.forEach((file, index) => {
        const zoneItem = document.createElement("div");
        zoneItem.className = "zone-item";
        
        const img = document.createElement("img");
        img.dataset.src = file.cover.replace("{COVER_URL}", coverURL).replace("{HTML_URL}", htmlURL);
        img.alt = file.name;
        img.loading = "lazy";
        img.className = "lazy-zone-img";
        zoneItem.appendChild(img);
        
        const button = document.createElement("button");
        button.textContent = file.name;
        button.onclick = (event) => {
            event.stopPropagation();
            openZone(file);
        };
        zoneItem.appendChild(button);
        
        zoneItem.onclick = () => openZone(file);
        featuredContainer.appendChild(zoneItem);
    });
    
    if (featuredContainer.innerHTML === "") {
        featuredContainer.innerHTML = "No featured zones found.";
    } else {
        document.getElementById("allZonesSummary").textContent = `Featured Zones (${featuredZones.length})`;
    }

    const lazyImages = document.querySelectorAll('#featuredZones img.lazy-zone-img');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove("lazy-zone-img");
                observer.unobserve(img);
            }
        });
    }, {
        rootMargin: "100px",
        threshold: 0.1
    });

    lazyImages.forEach(img => {
        imageObserver.observe(img);
    });
}

function displayZones(zones) {
    container.innerHTML = "";
    
    zones.forEach((file, index) => {
        const zoneItem = document.createElement("div");
        zoneItem.className = "zone-item";
        
        const imgContainer = document.createElement("div");
        imgContainer.className = "zone-img-container";
        
        const img = document.createElement("img");
        img.dataset.src = file.cover.replace("{COVER_URL}", coverURL).replace("{HTML_URL}", htmlURL);
        img.alt = file.name;
        img.loading = "lazy";
        img.className = "lazy-zone-img";
        
        img.onerror = function() {
            this.parentElement.classList.add('error');
            this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23f1f5f9"/><text x="50" y="50" font-family="Arial" font-size="12" text-anchor="middle" fill="%2394a3b8" dy=".3em">No Image</text></svg>';
        };
        
        img.onload = function() {
            this.classList.add('loaded');
        };
        
        imgContainer.appendChild(img);
        
        const imgOverlay = document.createElement("div");
        imgOverlay.className = "zone-img-overlay";
        imgOverlay.innerHTML = `
            <h3 class="zone-title-overlay">${file.name}</h3>
            ${file.author ? `<p class="zone-author-overlay">by ${file.author}</p>` : ''}
        `;
        imgContainer.appendChild(imgOverlay);
        
        zoneItem.appendChild(imgContainer);
        
        const zoneContent = document.createElement("div");
        zoneContent.className = "zone-content";
        
        const title = document.createElement("h3");
        title.className = "zone-content-title";
        title.textContent = file.name;
        zoneContent.appendChild(title);
        
        if (file.author) {
            const author = document.createElement("p");
            author.className = "zone-content-author";
            author.textContent = `by ${file.author}`;
            zoneContent.appendChild(author);
        }
        
        if (file.special && file.special.length > 0) {
            const tags = document.createElement("div");
            tags.className = "zone-tags";
            
            file.special.slice(0, 2).forEach(tag => {
                const tagElement = document.createElement("span");
                tagElement.className = "zone-tag";
                tagElement.textContent = tag;
                tags.appendChild(tagElement);
            });
            
            if (file.special.length > 2) {
                const moreTag = document.createElement("span");
                moreTag.className = "zone-tag";
                moreTag.textContent = `+${file.special.length - 2}`;
                tags.appendChild(moreTag);
            }
            
            zoneContent.appendChild(tags);
        }
        
        zoneItem.appendChild(zoneContent);
        
        const button = document.createElement("button");
        button.textContent = "Play";
        button.onclick = (event) => {
            event.stopPropagation();
            openZone(file);
        };
        zoneItem.appendChild(button);
        
        zoneItem.onclick = () => openZone(file);
        container.appendChild(zoneItem);
    });
    
    if (container.innerHTML === "") {
        container.innerHTML = "<p style='text-align: center; color: var(--text-muted); grid-column: 1 / -1;'>No zones found.</p>";
    } else {
        document.getElementById("allSummary").textContent = `All Zones (${zones.length})`;
    }
    
    const lazyImages = document.querySelectorAll('#container img.lazy-zone-img');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    delete img.dataset.src;
                }
                observer.unobserve(img);
            }
        });
    }, {
        rootMargin: "100px",
        threshold: 0.1
    });
    
    lazyImages.forEach(img => imageObserver.observe(img));
}

function filterZones2() {
    const query = filterOptions.value;
    if (query === "none") {
        displayZones(zones);
    } else {
        const filteredZones = zones.filter(zone => zone.special?.includes(query));
        if (query.length !== 0) {
            document.getElementById("featuredZonesWrapper").removeAttribute("open");
        }
        displayZones(filteredZones);
    }
}

function filterZones() {
    const query = searchBar.value.toLowerCase();
    const filteredZones = zones.filter(zone => zone.name.toLowerCase().includes(query));
    if (query.length !== 0) {
        document.getElementById("featuredZonesWrapper").removeAttribute("open");
    }
    displayZones(filteredZones);
}

function openZone(file) {
    if (file.url.startsWith("http")) {
        window.open(file.url, "_blank");
    } else {
        const url = file.url.replace("{COVER_URL}", coverURL).replace("{HTML_URL}", htmlURL);
        fetch(url + "?t=" + Date.now()).then(response => response.text()).then(html => {
            if (!zoneFrame || zoneFrame.contentDocument === null) {
                if (document.getElementById('zoneFrame')) {
                    zoneFrame = document.getElementById('zoneFrame');
                } else {
                    zoneFrame = document.createElement("iframe");
                    zoneFrame.id = "zoneFrame";
                    zoneViewer.appendChild(zoneFrame);
                }
            }
            
            zoneFrame.contentDocument.open();
            zoneFrame.contentDocument.write(html);
            zoneFrame.contentDocument.close();
            
            document.getElementById('zoneName').textContent = file.name;
            document.getElementById('zoneId').textContent = file.id;
            document.getElementById('zoneAuthor').textContent = "by " + file.author;
            
            if (file.authorLink) {
                document.getElementById('zoneAuthor').href = file.authorLink;
                document.getElementById('zoneAuthor').target = "_blank";
            } else {
                document.getElementById('zoneAuthor').removeAttribute('href');
                document.getElementById('zoneAuthor').style.cursor = "default";
            }
            
            zoneViewer.style.display = "flex";
            zoneViewer.classList.add("active");
            
            const urlParams = new URL(window.location);
            urlParams.searchParams.set('id', file.id);
            history.pushState(null, '', urlParams.toString());
            
            document.body.classList.add('no-scroll');
        }).catch(error => alert("Failed to load zone: " + error));
    }
}

function aboutBlank() {
    const zoneId = document.getElementById('zoneId').textContent;
    const zone = zones.find(z => z.id + '' === zoneId);
    
    if (zone) {
        const newWindow = window.open("about:blank", "_blank");
        const zoneUrl = zone.url.replace("{COVER_URL}", coverURL).replace("{HTML_URL}", htmlURL);
        
        fetch(zoneUrl + "?t=" + Date.now()).then(response => response.text()).then(html => {
            if (newWindow) {
                newWindow.document.open();
                newWindow.document.write(html);
                newWindow.document.close();
            }
        }).catch(error => alert("Failed to load zone: " + error));
    }
}

function closeZone() {
    zoneViewer.style.display = "none";
    zoneViewer.classList.remove("active");
    
    if (zoneFrame && zoneFrame.parentNode) {
        zoneFrame.parentNode.removeChild(zoneFrame);
        zoneFrame = null;
    }
    
    document.body.classList.remove('no-scroll');
    
    const url = new URL(window.location);
    url.searchParams.delete('id');
    history.pushState(null, '', url.toString());
}

function downloadZone() {
    const zoneId = document.getElementById('zoneId').textContent;
    const zone = zones.find(z => z.id + '' === zoneId);
    
    if (zone) {
        fetch(zone.url.replace("{HTML_URL}", htmlURL) + "?t=" + Date.now()).then(res => res.text()).then(text => {
            const blob = new Blob([text], {
                type: "text/plain;charset=utf-8"
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = zone.name + ".html";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }).catch(error => alert("Failed to download zone: " + error));
    }
}

function fullscreenZone() {
    if (zoneFrame) {
        if (zoneFrame.requestFullscreen) {
            zoneFrame.requestFullscreen();
        } else if (zoneFrame.mozRequestFullScreen) {
            zoneFrame.mozRequestFullScreen();
        } else if (zoneFrame.webkitRequestFullscreen) {
            zoneFrame.webkitRequestFullscreen();
        } else if (zoneFrame.msRequestFullscreen) {
            zoneFrame.msRequestFullscreen();
        }
    }
}

function sanitizeData(obj, maxStringLen = 1000, maxArrayLen = 10000) {
    if (typeof obj === 'string') {
        return obj.length > maxStringLen ? obj.slice(0, maxStringLen) + '...[truncated]' : obj;
    }
    
    if (obj instanceof Uint8Array) {
        if (obj.length > maxArrayLen) {
            return `[Uint8Array too large (${obj.length} bytes), truncated]`;
        }
        return obj;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeData(item, maxStringLen, maxArrayLen));
    }
    
    if (obj && typeof obj === 'object') {
        const newObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                newObj[key] = sanitizeData(obj[key], maxStringLen, maxArrayLen);
            }
        }
        return newObj;
    }
    
    return obj;
}

async function saveData() {
    alert("This might take a while, don't touch anything other than this OK button");
    
    const result = {};
    result.cookies = document.cookie;
    result.localStorage = {...localStorage};
    result.sessionStorage = {...sessionStorage};
    result.indexedDB = {};
    
    try {
        const dbs = await indexedDB.databases();
        for (const dbInfo of dbs) {
            if (!dbInfo.name) continue;
            result.indexedDB[dbInfo.name] = {};
            
            await new Promise((resolve, reject) => {
                const openRequest = indexedDB.open(dbInfo.name, dbInfo.version);
                openRequest.onerror = () => reject(openRequest.error);
                openRequest.onsuccess = () => {
                    const db = openRequest.result;
                    const storeNames = Array.from(db.objectStoreNames);
                    
                    if (storeNames.length === 0) {
                        resolve();
                        return;
                    }
                    
                    const transaction = db.transaction(storeNames, "readonly");
                    const storePromises = [];
                    
                    for (const storeName of storeNames) {
                        result.indexedDB[dbInfo.name][storeName] = [];
                        const store = transaction.objectStore(storeName);
                        const getAllRequest = store.getAll();
                        
                        const p = new Promise((res, rej) => {
                            getAllRequest.onsuccess = () => {
                                result.indexedDB[dbInfo.name][storeName] = sanitizeData(getAllRequest.result, 1000, 100);
                                res();
                            };
                            getAllRequest.onerror = () => rej(getAllRequest.error);
                        });
                        storePromises.push(p);
                    }
                    
                    Promise.all(storePromises).then(() => resolve());
                };
            });
        }
        
        result.caches = {};
        const cacheNames = await caches.keys();
        
        for (const cacheName of cacheNames) {
            const cache = await caches.open(cacheName);
            const requests = await cache.keys();
            result.caches[cacheName] = [];
            
            for (const req of requests) {
                const response = await cache.match(req);
                if (!response) continue;
                
                const cloned = response.clone();
                const contentType = cloned.headers.get('content-type') || '';
                let body;
                
                try {
                    if (contentType.includes('application/json')) {
                        body = await cloned.json();
                    } else if (contentType.includes('text') || contentType.includes('javascript')) {
                        body = await cloned.text();
                    } else {
                        const buffer = await cloned.arrayBuffer();
                        body = btoa(String.fromCharCode(...new Uint8Array(buffer)));
                    }
                } catch (e) {
                    body = '[Unable to read body]';
                }
                
                result.caches[cacheName].push({
                    url: req.url,
                    body,
                    contentType
                });
            }
        }
        
        alert("Done, wait for the download to come");
        
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], {
            type: "application/octet-stream"
        }));
        link.download = `${Date.now()}_backup.data`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
    } catch (error) {
        alert("Error saving data: " + error.message);
    }
}

async function loadData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    alert("This might take a while, don't touch anything other than this OK button");
    
    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (data.cookies) {
                data.cookies.split(';').forEach(cookie => {
                    document.cookie = cookie.trim();
                });
            }
            
            if (data.localStorage) {
                for (const key in data.localStorage) {
                    localStorage.setItem(key, data.localStorage[key]);
                }
            }
            
            if (data.sessionStorage) {
                for (const key in data.sessionStorage) {
                    sessionStorage.setItem(key, data.sessionStorage[key]);
                }
            }
            
            if (data.indexedDB) {
                for (const dbName in data.indexedDB) {
                    const stores = data.indexedDB[dbName];
                    
                    await new Promise((resolve, reject) => {
                        const request = indexedDB.open(dbName, 1);
                        
                        request.onupgradeneeded = e => {
                            const db = e.target.result;
                            for (const storeName in stores) {
                                if (!db.objectStoreNames.contains(storeName)) {
                                    db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
                                }
                            }
                        };
                        
                        request.onsuccess = e => {
                            const db = e.target.result;
                            const transaction = db.transaction(Object.keys(stores), 'readwrite');
                            
                            transaction.onerror = () => reject(transaction.error);
                            let pendingStores = Object.keys(stores).length;
                            
                            for (const storeName in stores) {
                                const objectStore = transaction.objectStore(storeName);
                                objectStore.clear().onsuccess = () => {
                                    for (const item of stores[storeName]) {
                                        objectStore.put(item);
                                    }
                                    pendingStores--;
                                    if (pendingStores === 0) resolve();
                                };
                            }
                        };
                        
                        request.onerror = () => reject(request.error);
                    });
                }
            }
            
            if (data.caches) {
                for (const cacheName in data.caches) {
                    const cache = await caches.open(cacheName);
                    
                    const keys = await cache.keys();
                    await Promise.all(keys.map(k => cache.delete(k)));
                    
                    for (const entry of data.caches[cacheName]) {
                        let responseBody;
                        
                        if (entry.contentType.includes('application/json')) {
                            responseBody = JSON.stringify(entry.body);
                        } else if (entry.contentType.includes('text') || entry.contentType.includes('javascript')) {
                            responseBody = entry.body;
                        } else {
                            const binaryStr = atob(entry.body);
                            const len = binaryStr.length;
                            const bytes = new Uint8Array(len);
                            for (let i = 0; i < len; i++) {
                                bytes[i] = binaryStr.charCodeAt(i);
                            }
                            responseBody = bytes.buffer;
                        }
                        
                        const headers = new Headers({ 'content-type': entry.contentType });
                        const response = new Response(responseBody, { headers });
                        await cache.put(entry.url, response);
                    }
                }
            }
            
            alert("Data loaded successfully!");
            location.reload();
            
        } catch (error) {
            alert("Error loading data: " + error.message);
        }
    };
    
    reader.readAsText(file);
}

function darkMode() {
    document.body.classList.toggle("dark-mode");
    localStorage.setItem('darkMode', document.body.classList.contains("dark-mode"));
}

function toggleStyle() {
    const currentStyle = document.getElementById('mainStyle');
    const button = document.querySelector('.settings-button[onclick="toggleStyle()"]');
    
    const currentHref = currentStyle.getAttribute('href');
    
    if (currentHref === 'style.css') {
        currentStyle.setAttribute('href', 'old-style.css');
        localStorage.setItem('siteStyle', 'old');
        if (button) button.textContent = "Switch to New Style";
    } else {
        currentStyle.setAttribute('href', 'style.css');
        localStorage.setItem('siteStyle', 'new');
        if (button) button.textContent = "Switch to Old Style";
    }
}

function loadStylePreference() {
    const savedStyle = localStorage.getItem('siteStyle');
    const button = document.querySelector('.settings-button[onclick="toggleStyle()"]');
    const styleElement = document.getElementById('mainStyle');
    
    if (savedStyle === 'old') {
        styleElement.setAttribute('href', 'old-style.css');
        if (button) button.textContent = "Switch to New Style";
    } else {
        styleElement.setAttribute('href', 'style.css');
        if (button) button.textContent = "Switch to Old Style";
    }
}

function loadStylePreference() {
    const savedStyle = localStorage.getItem('siteStyle');
    if (savedStyle === 'old') {
        document.getElementById('mainStyle').setAttribute('href', 'old-style.css');
    }
    
    const darkModePreference = localStorage.getItem('darkMode');
    if (darkModePreference === 'true') {
        document.body.classList.add("dark-mode");
    }
}

function cloakIcon(url) {
    const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
    link.rel = "icon";
    
    if ((url + "").trim().length === 0) {
        link.href = "favicon.png";
    } else {
        link.href = url;
    }
    
    document.head.appendChild(link);
    localStorage.setItem('cloakedIcon', url);
}

function cloakName(string) {
    if ((string + "").trim().length === 0) {
        document.title = "tg-math";
        localStorage.removeItem('cloakedTitle');
    } else {
        document.title = string;
        localStorage.setItem('cloakedTitle', string);
    }
}

function tabCloak() {
    closePopup();
    document.getElementById('popupTitle').textContent = "Tab Cloak";
    const popupBody = document.getElementById('popupBody');
    
    const savedTitle = localStorage.getItem('cloakedTitle') || '';
    const savedIcon = localStorage.getItem('cloakedIcon') || '';
    
    popupBody.innerHTML = `
        <label for="tab-cloak-title" style="font-weight: bold;">Set Tab Title:</label><br>
        <input type="text" id="tab-cloak-title" placeholder="Enter new tab name..." value="${savedTitle}" oninput="cloakName(this.value)">
        <br><br><br><br>
        <label for="tab-cloak-icon" style="font-weight: bold;">Set Tab Icon URL:</label><br>
        <input type="text" id="tab-cloak-icon" placeholder="Enter new tab icon URL..." value="${savedIcon}" oninput="cloakIcon(this.value)">
        <br><br>
        <button class="settings-button" onclick="resetCloak()">Reset to Default</button>
    `;
    
    popupBody.contentEditable = false;
    document.getElementById('popupOverlay').style.display = "flex";
}

function resetCloak() {
    cloakName('');
    cloakIcon('');
    document.getElementById('tab-cloak-title').value = '';
    document.getElementById('tab-cloak-icon').value = '';
}

function showSettings() {
    document.getElementById('popupTitle').textContent = "Settings";
    const popupBody = document.getElementById('popupBody');
    popupBody.innerHTML = `
        <button class="settings-button" onclick="darkMode()">Toggle Dark Mode</button>
        <br><br>
        <button class="settings-button" onclick="toggleStyle()">Switch to Old/New Style</button>
        <br><br>
        <button class="settings-button" onclick="tabCloak()">Tab Cloak</button>
    `;
    popupBody.contentEditable = false;
    document.getElementById('popupOverlay').style.display = "flex";
}

const settings = document.getElementById('settings');
if (settings) {
    settings.addEventListener('click', showSettings);
}

function showContact() {
    document.getElementById('popupTitle').textContent = "Contact";
    const popupBody = document.getElementById('popupBody');
    popupBody.innerHTML = `
        <p><strong>Discord:</strong> <a href="https://discord.gg/NAFw4ykZ7n" target="_blank">https://discord.gg/NAFw4ykZ7n</a></p>
        <p><strong>Email:</strong> <a href="mailto:gn.math.business@gmail.com">gn.math.business@gmail.com</a></p>
    `;
    popupBody.contentEditable = false;
    document.getElementById('popupOverlay').style.display = "flex";
}

function loadPrivacy() {
    document.getElementById('popupTitle').textContent = "Privacy Policy";
    const popupBody = document.getElementById('popupBody');
    popupBody.innerHTML = `
        <div style="max-height: 60vh; overflow-y: auto;">
            <h2>PRIVACY POLICY</h2>
            <p>Last updated April 17, 2025</p>
            <p>This Privacy Notice for gn-math ("we," "us," or "our"), describes how and why we might access, collect, store, use, and/or share ("process") your personal information when you use our services ("Services"), including when you:</p>
            <ul>
                <li>Visit our website at <a href="https://gn-math.github.io">https://gn-math.github.io</a>, or any website of ours that links to this Privacy Notice</li>
                <li>Engage with us in other related ways, including any sales, marketing, or events</li>
            </ul>
            <p>Questions or concerns? Reading this Privacy Notice will help you understand your privacy rights and choices. We are responsible for making decisions about how your personal information is processed. If you do not agree with our policies and practices, please do not use our Services. If you still have any questions or concerns, please contact us at <a href="https://discord.gg/NAFw4ykZ7n">https://discord.gg/NAFw4ykZ7n</a>.</p>
            
            <h3>SUMMARY OF KEY POINTS</h3>
            <p>This summary provides key points from our Privacy Notice, but you can find out more details about any of these topics by clicking the link following each key point or by using our table of contents below to find the section you are looking for.</p>
            
            <p><strong>What personal information do we process?</strong> When you visit, use, or navigate our Services, we may process personal information depending on how you interact with us and the Services, the choices you make, and the products and features you use. Learn more about personal information you disclose to us.</p>
            
            <p><strong>Do we process any sensitive personal information?</strong> Some of the information may be considered "special" or "sensitive" in certain jurisdictions, for example your racial or ethnic origins, sexual orientation, and religious beliefs. We do not process sensitive personal information.</p>
            
            <p><strong>Do we collect any information from third parties?</strong> We do not collect any information from third parties.</p>
            
            <p><strong>How do we process your information?</strong> We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent. We process your information only when we have a valid legal reason to do so. Learn more about how we process your information.</p>
            
            <p><strong>In what situations and with which parties do we share personal information?</strong> We may share information in specific situations and with specific third parties. Learn more about when and with whom we share your personal information.</p>
            
            <p><strong>How do we keep your information safe?</strong> We have adequate organizational and technical processes and procedures in place to protect your personal information. However, no electronic transmission over the internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information. Learn more about how we keep your information safe.</p>
            
            <p><strong>What are your rights?</strong> Depending on where you are located geographically, the applicable privacy law may mean you have certain rights regarding your personal information. Learn more about your privacy rights.</p>
            
            <p><strong>How do you exercise your rights?</strong> The easiest way to exercise your rights is by submitting a data subject access request, or by contacting us. We will consider and act upon any request in accordance with applicable data protection laws.</p>
        </div>
    `;
    popupBody.contentEditable = false;
    document.getElementById('popupOverlay').style.display = "flex";
}

function loadDMCA() {
    document.getElementById('popupTitle').textContent = "DMCA";
    const popupBody = document.getElementById('popupBody');
    popupBody.innerHTML = `
        <div class="dmca-content">
            <p>
                If you own or developed a game that is on <strong>gn-math</strong> 
                and would like it removed, please do one of the following:
            </p>
            <ol>
                <li>
                    <a href="https://discord.gg/D4c9VFYWyU" target="_blank" rel="noopener noreferrer">
                        Join the Discord
                    </a> and DM <strong>breadbb</strong> or ping me in a public channel 
                    <strong>[INSTANT RESPONSE]</strong>
                </li>
                <li>
                    Email me at 
                    <a href="mailto:gn.math.business@gmail.com">gn.math.business@gmail.com</a> 
                    with the subject starting with <code>!DMCA</code>.
                    <strong>[DELAYED RESPONSE]</strong>
                </li>
            </ol>
            <p>
                If you are going to do an email, please show proof you own the game before I have to ask.
            </p>
        </div>
    `;
    popupBody.contentEditable = false;
    document.getElementById('popupOverlay').style.display = "flex";
}

let _allStatsCache = null;

async function getAllStats() {
    if (_allStatsCache) {
        return _allStatsCache;
    }
    
    const BASE_URL = "https://data.jsdelivr.com/v1/stats/packages/gh/gn-math/html@main/files";
    const PERIOD = "year";
    const PAGE_BATCH = 5;
    
    let page = 1;
    let done = false;
    const combinedMap = Object.create(null);
    
    while (!done) {
        const pages = Array.from({ length: PAGE_BATCH }, (_, i) => page + i);
        
        const responses = await Promise.all(
            pages.map(p =>
                fetch(`${BASE_URL}?period=${PERIOD}&page=${p}&limit=100`)
                .then(r => (r.ok ? r.json() : []))
                .catch(() => [])
            )
        );
        
        for (const data of responses) {
            if (!Array.isArray(data) || data.length === 0) {
                done = true;
                break;
            }
            
            for (const item of data) {
                if (!item?.name) continue;
                
                const match = item.name.match(/^\/(\d+)([.-])/);
                if (!match) continue;
                
                const id = match[1];
                
                if (!combinedMap[id]) {
                    combinedMap[id] = {
                        hits: 0,
                        bandwidth: 0
                    };
                }
                
                combinedMap[id].hits += item.hits?.total ?? 0;
                combinedMap[id].bandwidth += item.bandwidth?.total ?? 0;
            }
        }
        
        page += PAGE_BATCH;
    }
    
    _allStatsCache = combinedMap;
    return combinedMap;
}

async function getStats(id) {
    id = String(id);
    const allStats = await getAllStats();
    return allStats[id]?.hits ?? 0;
}

function showZoneInfo() {
    let id = Number(document.getElementById('zoneId').textContent);
    document.getElementById('popupTitle').textContent = "Info";
    const popupBody = document.getElementById('popupBody');
    popupBody.innerHTML = `<p>Loading...</p>`;
    popupBody.contentEditable = false;
    document.getElementById('popupOverlay').style.display = "flex";
    
    fetch(`https://api.github.com/repos/gn-math/html/commits?path=${id}.html`)
        .then(res => res.json())
        .then(async json => {
            let stats = await getStats(id);
            const idjson = zones.filter(a => a.id === id)[0];
            
            document.getElementById('popupTitle').textContent = `${idjson.name} Info`;
            const date = new Date(json.at(-1).commit.author.date);
            
            let formatteddate = new Intl.DateTimeFormat("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true
            }).format(date);
            
            popupBody.innerHTML = `
                <p>
                    <b>Id</b>: ${id}<br>
                    <b>Name</b>: ${idjson.name}<br>
                    ${idjson.author ? `<b>Game Author</b>: ${idjson.author}<br>` : ""}
                    ${idjson.authorLink ? `<b>Game Author Link</b>: <a href="${idjson.authorLink}" target="_blank">${idjson.authorLink}</a><br>` : ""}
                    ${idjson.special ? `<b>Tags</b>: ${idjson.special.join(', ')}<br>` : ""}
                    <b>Gn-Math Adder</b>: ${json.at(-1).commit.author.name}<br>
                    <b>Date Added</b>: ${formatteddate}<br>
                    <b>Times Played (Globally)</b>: ${Number(stats).toLocaleString("en-US")}
                </p>
            `;
        })
        .catch(error => {
            popupBody.innerHTML = `<p>Error loading zone info: ${error.message}</p>`;
        });
}

function closePopup() {
    document.getElementById('popupOverlay').style.display = "none";
}

const schoolList = ["deledao", "goguardian", "lightspeed", "linewize", "securly", ".edu/"];

function isBlockedDomain(url) {
    try {
        const domain = new URL(url, location.origin).hostname + "/";
        return schoolList.some(school => domain.includes(school));
    } catch (e) {
        return false;
    }
}

const originalFetch = window.fetch;
window.fetch = function (url, options) {
    if (isBlockedDomain(url)) {
        console.warn(`Blocked fetch request to: ${url}`);
        return Promise.reject(new Error("Blocked by school filter"));
    }
    return originalFetch.apply(this, arguments);
};

const originalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method, url) {
    if (isBlockedDomain(url)) {
        console.warn(`Blocked XMLHttpRequest to: ${url}`);
        return;
    }
    return originalOpen.apply(this, arguments);
};

HTMLCanvasElement.prototype.toDataURL = function (...args) {
    console.warn("Canvas toDataURL blocked");
    return "";
};

window.addEventListener('DOMContentLoaded', () => {
    const savedTitle = localStorage.getItem('cloakedTitle');
    const savedIcon = localStorage.getItem('cloakedIcon');
    
    if (savedTitle) {
        document.title = savedTitle;
    }
    
    if (savedIcon) {
        cloakIcon(savedIcon);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    listZones();
    loadStylePreference();
});

document.getElementById('popupOverlay').addEventListener('click', function(e) {
    if (e.target === this) {
        closePopup();
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        if (document.getElementById('popupOverlay').style.display === 'flex') {
            closePopup();
        }
        if (zoneViewer.classList.contains('active')) {
            closeZone();
        }
    }
});

function optimizeGridLayout() {
    const container = document.getElementById('container');
    const featuredContainer = document.getElementById('featuredZones');
    const viewportWidth = window.innerWidth;
    
    let columns;
    if (viewportWidth < 480) {
        columns = 2;
    } else if (viewportWidth < 768) {
        columns = 3;
    } else if (viewportWidth < 1024) {
        columns = 4;
    } else if (viewportWidth < 1400) {
        columns = 5;
    } else {
        columns = 6;
    }
    
    const gridTemplate = `repeat(auto-fill, minmax(calc(100%/${columns} - 1rem), 1fr))`;
    
    if (container) {
        container.style.gridTemplateColumns = gridTemplate;
    }
    
    if (featuredContainer) {
        featuredContainer.style.gridTemplateColumns = gridTemplate;
    }
}

function fillEmptyGridSpaces() {
    const containers = ['container', 'featuredZones'];
    
    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const items = container.querySelectorAll('.zone-item');
        if (items.length === 0) return;
        
        const containerStyle = window.getComputedStyle(container);
        const gap = parseFloat(containerStyle.gap) || 1.5;
        const columnWidth = items[0]?.offsetWidth || 200;
        
        const containerWidth = container.offsetWidth;
        const itemsPerRow = Math.floor((containerWidth + gap) / (columnWidth + gap));
        const totalItems = items.length;
        const itemsInLastRow = totalItems % itemsPerRow;
        
        if (itemsInLastRow > 0 && itemsInLastRow < itemsPerRow) {
            const placeholdersNeeded = itemsPerRow - itemsInLastRow;
            
            const oldPlaceholders = container.querySelectorAll('.grid-placeholder');
            oldPlaceholders.forEach(p => p.remove());
            
            for (let i = 0; i < placeholdersNeeded; i++) {
                const placeholder = document.createElement('div');
                placeholder.className = 'zone-item grid-placeholder';
                placeholder.style.visibility = 'hidden';
                placeholder.style.pointerEvents = 'none';
                container.appendChild(placeholder);
            }
        }
    });
}

window.addEventListener('load', () => {
    optimizeGridLayout();
    fillEmptyGridSpaces();
    
    listZones();
    loadStylePreference();
});

window.addEventListener('resize', () => {
    optimizeGridLayout();
    setTimeout(fillEmptyGridSpaces, 100);
});

const originalDisplayZones = window.displayZones;
window.displayZones = function(zones) {
    const result = originalDisplayZones.apply(this, arguments);
    setTimeout(fillEmptyGridSpaces, 100);
    return result;
};

const originalDisplayFeaturedZones = window.displayFeaturedZones;
window.displayFeaturedZones = function(zones) {
    const result = originalDisplayFeaturedZones.apply(this, arguments);
    setTimeout(fillEmptyGridSpaces, 100);
    return result;
};

const originalFilterZones = window.filterZones;
window.filterZones = function() {
    const result = originalFilterZones.apply(this, arguments);
    setTimeout(fillEmptyGridSpaces, 100);
    return result;
};

const originalFilterZones2 = window.filterZones2;
window.filterZones2 = function() {
    const result = originalFilterZones2.apply(this, arguments);
    setTimeout(fillEmptyGridSpaces, 100);
    return result;
};

const originalSortZones = window.sortZones;
window.sortZones = function() {
    const result = originalSortZones.apply(this, arguments);
    setTimeout(fillEmptyGridSpaces, 100);
    return result;
};
