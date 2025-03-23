class ProvinceGame {
    constructor() {
        this.provinces = [];
        this.currentProvince = null;
        this.attempts = 3;
        this.startTime = null;
        this.timer = null;
        this.solvedProvinces = 0;
        this.totalProvinces = 0;
        this.mapContainer = document.getElementById('map-container');
        this.provinceNameElement = document.getElementById('province-name');
        this.attemptsCountElement = document.getElementById('attempts-count');
        this.timeElement = document.getElementById('time');
        this.gameOverElement = document.getElementById('game-over');
        this.accuracyElement = document.getElementById('accuracy');
        this.totalTimeElement = document.getElementById('total-time');
        this.restartButton = document.getElementById('restart-button');
        this.feedbackMessage = document.getElementById('feedback-message');
        this.feedbackTimeout = null;
        this.applyRegionsButton = document.getElementById('apply-regions');
        this.selectAllButton = document.getElementById('select-all');
        this.deselectAllButton = document.getElementById('deselect-all');
        this.startGameButton = document.getElementById('start-game');
        this.regionSelector = document.querySelector('.region-selector');
        this.header = document.querySelector('header');
        this.pauseButton = document.getElementById('pause-button');
        this.pauseMenu = document.getElementById('pause-menu');
        this.resumeButton = document.getElementById('resume-button');
        this.exitButton = document.getElementById('exit-button');
        this.gameInterface = document.getElementById('game-interface');
        this.selectedRegions = new Set();
        this.zoomLevel = 1;
        this.panOffset = { x: 0, y: 0 };
        this.isDragging = false;
        this.lastPos = { x: 0, y: 0 };
        this.isPaused = false;
        this.pauseStartTime = null;
        this.score = 0;
        this.maxScore = 0;
        this.scoreElement = document.createElement('div');
        this.scoreElement.className = 'score-display';
        this.header.appendChild(this.scoreElement);

        // Nascondi l'intera interfaccia di gioco all'inizio
        if (this.gameInterface) {
            this.gameInterface.style.display = 'none';
        } else {
            console.warn('Elemento gameInterface non trovato');
        }

        this.init();
    }

    async init() {
        try {
            // Carica i dati delle province
            await this.loadProvinces();
            // Inizializza la mappa SVG
            await this.loadMap();
            // Aggiungi event listeners
            this.addEventListeners();
            // Seleziona tutte le regioni di default
            this.selectAllRegions();
            // Non avviare il gioco automaticamente
            // this.startGame();
        } catch (error) {
            console.error('Errore durante l\'inizializzazione del gioco:', error);
            alert('Si è verificato un errore durante il caricamento del gioco. Ricarica la pagina.');
        }
    }

    async loadProvinces() {
        try {
            const response = await fetch('provinces.json');
            const data = await response.json();
            this.provinces = data.provinces;
            this.totalProvinces = this.provinces.length;
        } catch (error) {
            console.error('Errore nel caricamento delle province:', error);
            throw error;
        }
    }

    async loadMap() {
        try {
            const response = await fetch('map.svg');
            const svgText = await response.text();
            this.mapContainer.innerHTML = svgText;

            // Rimuovi il prefisso "IT" dagli ID delle province nella mappa
            const provinces = this.mapContainer.querySelectorAll('path, polygon');
            console.log('Province trovate:', provinces.length);
            provinces.forEach(province => {
                if (province.id && province.id.startsWith('IT')) {
                    const newId = province.id.substring(2);
                    province.id = newId;
                }
                // Aggiungi la classe province a tutti gli elementi path e polygon
                province.classList.add('province');
            });

            // Imposta lo zoom iniziale
            this.setInitialZoom();
        } catch (error) {
            console.error('Errore nel caricamento della mappa:', error);
            throw error;
        }
    }

    setInitialZoom() {
        const svg = this.mapContainer.querySelector('svg');
        if (!svg) return;

        // Ottieni le dimensioni originali della mappa
        const viewBox = svg.getAttribute('viewBox');
        if (!viewBox) return;

        const [vx, vy, width, height] = viewBox.split(' ').map(Number);
        
        // Calcola le dimensioni del contenitore
        const containerWidth = this.mapContainer.clientWidth - 20;
        const containerHeight = this.mapContainer.clientHeight - 20;

        // Calcola lo zoom necessario
        const scaleX = containerWidth / width;
        const scaleY = containerHeight / height;
        
        // Imposta uno zoom iniziale ottimale (ridotto per evitare zoom eccessivo)
        this.zoomLevel = Math.min(scaleX, scaleY) * 1.2; // Ridotto a 1.2 per una mappa più bilanciata

        // Migliora il posizionamento per evitare lo zoom in basso
        this.panOffset = {
            x: (containerWidth - width * this.zoomLevel) / 2,
            y: (containerHeight - height * this.zoomLevel) / 2 - (height * 0.1 * this.zoomLevel)
        };

        // Applica la trasformazione
        this.updateMapTransform();
        
        console.log("Zoom iniziale applicato:", this.zoomLevel, "Container:", containerWidth, containerHeight, "Offset:", this.panOffset);
    }

    addEventListeners() {
        this.restartButton.addEventListener('click', () => {
            // Nascondi la schermata di game over
            this.gameOverElement.classList.add('hidden');
            // Reset del gioco
            this.resetGame();
            // Mostra il selettore delle regioni
            this.regionSelector.classList.remove('hidden');
            this.header.classList.remove('hidden');
            // Assicurati che l'intera interfaccia di gioco rimanga nascosta
            if (this.gameInterface) {
                this.gameInterface.style.display = 'none';
            }
        });
        this.mapContainer.addEventListener('click', (e) => this.handleMapClick(e));
        this.applyRegionsButton.addEventListener('click', () => this.applyRegionSelection());
        this.selectAllButton.addEventListener('click', () => this.selectAllRegions());
        this.deselectAllButton.addEventListener('click', () => this.deselectAllRegions());
        this.startGameButton.addEventListener('click', () => this.startGame());
        this.pauseButton.addEventListener('click', () => this.togglePause());
        this.resumeButton.addEventListener('click', () => this.resumeGame());
        this.exitButton.addEventListener('click', () => this.exitGame());
        
        // Eventi per lo zoom
        this.mapContainer.addEventListener('wheel', (e) => this.handleZoom(e));
        
        // Eventi per il pan
        this.mapContainer.addEventListener('mousedown', (e) => this.startDragging(e));
        this.mapContainer.addEventListener('mousemove', (e) => this.drag(e));
        this.mapContainer.addEventListener('mouseup', () => this.stopDragging());
        this.mapContainer.addEventListener('mouseleave', () => this.stopDragging());
        
        // Eventi touch
        this.mapContainer.addEventListener('touchstart', (e) => this.startDragging(e.touches[0]));
        this.mapContainer.addEventListener('touchmove', (e) => this.drag(e.touches[0]));
        this.mapContainer.addEventListener('touchend', () => this.stopDragging());
        
        // Aggiungi un event listener per il ridimensionamento della finestra
        window.addEventListener('resize', () => {
            if (this.gameInterface && this.gameInterface.style.display !== 'none') {
                // Se il gioco è visibile, ricalcola lo zoom
                clearTimeout(this.resizeTimeout);
                this.resizeTimeout = setTimeout(() => {
                    console.log("Ridimensionamento rilevato");
                    this.improveZoom();
                }, 300);
            }
        });
    }

    startGame() {
        // Verifica che ci siano regioni selezionate
        if (this.selectedRegions.size === 0) {
            this.showFeedback('Seleziona almeno una regione per iniziare il gioco', false);
            return;
        }
        
        // Ferma il timer esistente se è attivo
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        // Reset del conteggio del tempo
        this.startTime = Date.now();
        this.timeElement.textContent = '00:00';
        
        // Calcola il punteggio massimo possibile
        const totalProvinces = this.provinces.filter(p => {
            const region = this.getProvinceRegion(p.id);
            return this.selectedRegions.has(region);
        }).length;
        this.maxScore = totalProvinces * 3; // 3 punti per ogni provincia (primo tentativo)
        
        // Reset del punteggio
        this.score = 0;
        
        // Reset delle province: ripulisci tutte le province dalla colorazione precedente
        document.querySelectorAll('.province').forEach(province => {
            province.classList.remove('correct', 'incorrect', 'failed', 'attempt-1', 'attempt-2', 'attempt-3');
            province.removeAttribute('data-points');
            province.style.fill = '';
            province.style.stroke = '';
            province.style.strokeWidth = '';
            province.style.pointerEvents = 'auto';
            province.style.opacity = '1';
        });
        
        // Reset dello stato delle province
        this.provinces.forEach(province => {
            province.solved = false;
        });
        
        // Nascondi il selettore delle regioni e il titolo
        this.regionSelector.classList.add('hidden');
        this.header.classList.add('hidden');
        
        // Mostra il pulsante di pausa
        this.pauseButton.style.display = 'flex';
        this.pauseButton.querySelector('.pause-icon').textContent = '⏸';
        
        // Mostra l'intera interfaccia di gioco
        if (this.gameInterface) {
            this.gameInterface.style.display = 'flex';
        }
        
        this.resetGame();
        this.startTimer();
        this.selectNextProvince();
        
        // Assicuriamoci che la mappa sia visibile e ottimizzata
        setTimeout(() => {
            // Usa improveZoom per un miglior adattamento della mappa
            this.improveZoom();
        }, 300);
    }

    resetGame() {
        this.attempts = 3;
        this.solvedProvinces = 0;
        
        // Non modifichiamo qui lo startTime perché è già gestito in startGame
        
        this.gameOverElement.classList.add('hidden');
        
        // Il reset delle province è già gestito in startGame
        // quindi commentiamo questa parte
        /*
        // Reset dei colori delle province
        document.querySelectorAll('.province').forEach(province => {
            province.classList.remove('attempt-1', 'attempt-2', 'attempt-3', 'failed', 'incorrect');
            province.style.pointerEvents = 'auto';
        });
        
        // Reset dello stato delle province
        this.provinces.forEach(province => {
            province.solved = false;
        });
        */
        
        this.updateUI();
    }

    startTimer() {
        // Assicurati che non ci siano timer attivi
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        // Imposta il tempo iniziale
        this.startTime = Date.now();
        
        this.timer = setInterval(() => {
            if (this.isPaused) return;
            
            const elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(elapsedTime / 60);
            const seconds = elapsedTime % 60;
            
            this.timeElement.textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    selectAllRegions() {
        const checkboxes = document.querySelectorAll('.region-checkboxes input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            this.selectedRegions.add(checkbox.value);
        });
        this.applyRegionSelection();
    }

    deselectAllRegions() {
        const checkboxes = document.querySelectorAll('.region-checkboxes input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        this.selectedRegions.clear();
        this.applyRegionSelection();
    }

    getVisibleProvinces() {
        return Array.from(document.querySelectorAll('.province')).filter(province => 
            !province.classList.contains('hidden')
        );
    }

    autoZoom() {
        const visibleProvinces = this.getVisibleProvinces();
        if (visibleProvinces.length === 0) return;

        const svg = this.mapContainer.querySelector('svg');
        if (!svg) return;

        // Ottieni le dimensioni originali della mappa
        const viewBox = svg.getAttribute('viewBox');
        if (!viewBox) return;

        const [, , width, height] = viewBox.split(' ').map(Number);
        
        // Calcola le dimensioni del contenitore
        const containerWidth = this.mapContainer.clientWidth - 20;
        const containerHeight = this.mapContainer.clientHeight - 20;

        // Usa un fattore di scala maggiore per ottenere una mappa più grande
        this.zoomLevel = Math.min(containerWidth / width, containerHeight / height) * 1.5;
            
        // Centra la mappa
        this.panOffset = {
            x: (containerWidth - width * this.zoomLevel) / 2,
            y: (containerHeight - height * this.zoomLevel) / 2
        };
        
        // Applica la trasformazione
        this.updateMapTransform();
        
        console.log("Auto zoom applicato:", this.zoomLevel, "Container:", containerWidth, containerHeight);
    }

    updateMapTransform() {
        const svg = this.mapContainer.querySelector('svg');
        if (svg) {
            svg.style.transform = `translate(${this.panOffset.x}px, ${this.panOffset.y}px) scale(${this.zoomLevel})`;
            svg.style.transformOrigin = 'center center';
        }
    }

    applyRegionSelection() {
        const checkboxes = document.querySelectorAll('.region-checkboxes input[type="checkbox"]');
        this.selectedRegions.clear();
        
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                this.selectedRegions.add(checkbox.value);
            }
        });

        console.log("Regioni selezionate:", Array.from(this.selectedRegions));

        // Nascondi/mostra le province in base alle regioni selezionate
        document.querySelectorAll('.province').forEach(province => {
            const region = this.getProvinceRegion(province.id);
            if (this.selectedRegions.has(region)) {
                province.classList.remove('hidden');
            } else {
                province.classList.add('hidden');
            }
        });

        // Reset del gioco con le nuove regioni selezionate
        this.resetGame();
        
        // Aspetta che il DOM sia aggiornato prima di fare l'auto-zoom
        setTimeout(() => {
            this.improveZoom();
            console.log("Zoom migliorato applicato dopo la selezione delle regioni");
        }, 300);
    }

    selectNextProvince() {
        const visibleProvinces = this.getVisibleProvinces();
        if (visibleProvinces.length === 0) {
            this.endGame();
            return;
        }

        const unsolvedProvinces = this.provinces.filter(p => {
            const region = this.getProvinceRegion(p.id);
            return !p.solved && this.selectedRegions.has(region);
        });

        if (unsolvedProvinces.length === 0) {
            this.endGame();
            return;
        }

        this.currentProvince = unsolvedProvinces[Math.floor(Math.random() * unsolvedProvinces.length)];
        this.attempts = 3;
        this.updateUI();
    }

    handleMapClick(event) {
        if (!this.currentProvince) return;

        const target = event.target;
        console.log('Elemento cliccato:', target);
        console.log('Classi dell\'elemento:', target.classList);
        
        if (!target.classList.contains('province')) {
            console.log('L\'elemento cliccato non è una provincia');
            return;
        }

        const clickedProvinceId = target.id;
        console.log('ID provincia cliccata:', clickedProvinceId);
        console.log('Provincia corrente:', this.currentProvince.id);
        
        const isCorrect = clickedProvinceId === this.currentProvince.id;

        if (isCorrect) {
            this.handleCorrectGuess(target);
        } else {
            this.handleIncorrectGuess(target);
        }
    }

    showFeedback(message, isCorrect = false) {
        // Pulisci eventuali timeout precedenti
        if (this.feedbackTimeout) {
            clearTimeout(this.feedbackTimeout);
        }

        // Rimuovi le classi precedenti
        this.feedbackMessage.classList.remove('show', 'correct', 'incorrect');
        
        // Imposta il messaggio e le classi appropriate
        this.feedbackMessage.textContent = message;
        this.feedbackMessage.classList.add('show');
        this.feedbackMessage.classList.add(isCorrect ? 'correct' : 'incorrect');

        // Nascondi il messaggio dopo 2 secondi
        this.feedbackTimeout = setTimeout(() => {
            this.feedbackMessage.classList.remove('show');
        }, 2000);
    }

    handleCorrectGuess(provinceElement) {
        // Calcola i punti in base ai tentativi rimanenti (fuori dal blocco if)
        let points;
        if (this.attempts === 3) {
            points = 3; // Primo tentativo - Verde
        } else if (this.attempts === 2) {
            points = 2; // Secondo tentativo - Giallo
        } else {
            points = 1; // Terzo tentativo - Arancione
        }
        
        // Verifica che la provincia appartenga a una regione selezionata
        const region = this.getProvinceRegion(this.currentProvince.id);
        if (this.selectedRegions.has(region)) {
            this.currentProvince.solved = true;
            this.solvedProvinces++;
            
            this.score += points;
            
            // Mostra l'animazione dei punti
            this.showPointsAnimation(points, provinceElement);
            
            // Log per debug
            console.log(`Provincia indovinata: ${this.currentProvince.name}, Punti ottenuti: ${points}, Punteggio totale: ${this.score}`);
        }
        
        // Rimuovi tutte le classi incorrect da tutte le province
        document.querySelectorAll('.province.incorrect').forEach(p => {
            p.classList.remove('incorrect');
            p.style.fill = '';
            p.style.stroke = '';
        });
        
        // Rimuovi tutte le classi precedenti dalla provincia corretta
        provinceElement.classList.remove('incorrect', 'failed', 'correct');
        // Rimuovi tutti gli attributi data-points precedenti
        provinceElement.removeAttribute('data-points');
        
        // Aggiungi la classe correct e l'attributo data-points
        provinceElement.classList.add('correct');
        provinceElement.setAttribute('data-points', points);
        provinceElement.style.pointerEvents = 'none';
        
        // Forza l'aggiornamento dello stile
        provinceElement.style.fill = '';
        provinceElement.style.stroke = '';
        provinceElement.style.strokeWidth = '';
        provinceElement.style.opacity = '1';
        
        // Forza un reflow per assicurarsi che gli stili vengano applicati
        void provinceElement.offsetWidth;
        
        // Applica direttamente gli stili in base ai punti
        console.log("Applicando colore per punti:", points);
        if (points === 3) {
            provinceElement.style.fill = '#4CAF50'; // Verde
            provinceElement.style.stroke = '#388E3C';
        } else if (points === 2) {
            provinceElement.style.fill = '#FFF9C4'; // Giallo pastello
            provinceElement.style.stroke = '#FBC02D';
        } else {
            provinceElement.style.fill = '#FF9800'; // Arancione
            provinceElement.style.stroke = '#F57C00';
        }
        
        this.selectNextProvince();
    }

    showPointsAnimation(points, element) {
        const pointsElement = document.createElement('div');
        pointsElement.className = 'points-animation';
        pointsElement.textContent = `+${points}`;
        
        // Posiziona l'animazione sopra la provincia
        const rect = element.getBoundingClientRect();
        pointsElement.style.left = `${rect.left + rect.width / 2}px`;
        pointsElement.style.top = `${rect.top}px`;
        
        document.body.appendChild(pointsElement);
        
        // Rimuovi l'animazione dopo che è completata
        setTimeout(() => {
            pointsElement.remove();
        }, 1000);
    }

    handleIncorrectGuess(provinceElement) {
        this.attempts--;
        
        // Rimuovi la classe incorrect precedente
        document.querySelectorAll('.province').forEach(p => {
            p.classList.remove('incorrect');
        });
        
        if (this.attempts <= 0) {
            // Verifica che la provincia appartenga a una regione selezionata
            const region = this.getProvinceRegion(this.currentProvince.id);
            if (this.selectedRegions.has(region)) {
                this.currentProvince.solved = true;
                this.solvedProvinces++;
                // Assegna 0 punti per il fallimento
                this.score += 0;
                
                // Log per debug
                console.log(`Provincia fallita: ${this.currentProvince.name}, Punti ottenuti: 0, Punteggio totale: ${this.score}`);
            }
            
            const correctProvince = document.getElementById(this.currentProvince.id);
            if (correctProvince) {
                // Rimuovi tutte le classi precedenti
                correctProvince.classList.remove('correct', 'incorrect', 'failed');
                correctProvince.removeAttribute('data-points');
                // Aggiungi la classe failed
                correctProvince.classList.add('failed');
                correctProvince.style.pointerEvents = 'none';
                // Forza l'aggiornamento dello stile
                correctProvince.style.fill = '';
                correctProvince.style.stroke = '';
                this.showFeedback(`La provincia corretta era ${this.currentProvince.name}`);
            }
            this.selectNextProvince();
        } else {
            // Rimuovi tutte le classi precedenti
            provinceElement.classList.remove('correct', 'failed', 'incorrect');
            provinceElement.removeAttribute('data-points');
            // Aggiungi la classe incorrect
            provinceElement.classList.add('incorrect');
            // Forza l'aggiornamento dello stile
            provinceElement.style.fill = '';
            provinceElement.style.stroke = '';
            
            const clickedProvince = this.provinces.find(p => p.id === provinceElement.id);
            if (clickedProvince) {
                this.showFeedback(`Questa è la provincia di ${clickedProvince.name}`);
            }
            this.updateUI();
        }
    }

    showCorrectProvinceIndicator(provinceElement) {
        // Crea l'indicatore
        const indicator = document.createElement('div');
        indicator.className = 'correct-province-indicator';
        
        // Ottieni il centro della provincia
        const rect = provinceElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Posiziona l'indicatore al centro della provincia
        indicator.style.left = `${centerX}px`;
        indicator.style.top = `${centerY}px`;
        
        document.body.appendChild(indicator);
        
        // Rimuovi l'indicatore dopo 2 secondi
        setTimeout(() => {
            indicator.remove();
        }, 2000);
    }

    updateUI() {
        this.provinceNameElement.textContent = this.currentProvince ? this.currentProvince.name : '';
        this.attemptsCountElement.textContent = this.attempts;
    }

    endGame() {
        clearInterval(this.timer);
        const totalTime = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(totalTime / 60);
        const seconds = totalTime % 60;
        
        // Ottieni tutte le province delle regioni selezionate
        const totalProvinces = this.provinces.filter(p => {
            const region = this.getProvinceRegion(p.id);
            return this.selectedRegions.has(region);
        }).length;
        
        // Se non ci sono province da risolvere, precisione = 0
        if (totalProvinces === 0) {
            this.accuracyElement.textContent = '0';
            this.totalTimeElement.textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            this.gameOverElement.classList.remove('hidden');
            this.pauseButton.style.display = 'none';
            this.regionSelector.classList.remove('hidden');
            this.header.classList.remove('hidden');
            
            // Nascondi l'intera interfaccia di gioco quando il gioco finisce
            if (this.gameInterface) {
                this.gameInterface.style.display = 'none';
            }
            
            return;
        }
        
        // Calcola il punteggio massimo possibile (3 punti per ogni provincia)
        this.maxScore = totalProvinces * 3;
        
        // Calcola la precisione basata sul punteggio
        const accuracy = Math.round((this.score / this.maxScore) * 100);
        
        // Log per debug
        console.log('Punteggio ottenuto:', this.score);
        console.log('Punteggio massimo possibile:', this.maxScore);
        console.log('Numero totale province:', totalProvinces);
        console.log('Precisione calcolata:', accuracy);
        
        this.accuracyElement.textContent = accuracy;
        this.totalTimeElement.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        this.gameOverElement.classList.remove('hidden');
        this.pauseButton.style.display = 'none';
        this.regionSelector.classList.remove('hidden');
        this.header.classList.remove('hidden');
        
        // Nascondi l'intera interfaccia di gioco quando il gioco finisce
        if (this.gameInterface) {
            this.gameInterface.style.display = 'none';
        }

        // Reset delle province risolte
        this.provinces.forEach(province => {
            province.solved = false;
        });
    }

    handleZoom(event) {
        event.preventDefault();
        const delta = event.deltaY > 0 ? 0.9 : 1.1;
        this.zoomLevel = Math.max(0.5, Math.min(3, this.zoomLevel * delta));
        this.updateMapTransform();
    }

    startDragging(event) {
        this.isDragging = true;
        this.lastPos = {
            x: event.clientX || event.touches[0].clientX,
            y: event.clientY || event.touches[0].clientY
        };
    }

    drag(event) {
        if (!this.isDragging) return;
        
        const currentPos = {
            x: event.clientX || event.touches[0].clientX,
            y: event.clientY || event.touches[0].clientY
        };
        
        const dx = currentPos.x - this.lastPos.x;
        const dy = currentPos.y - this.lastPos.y;
        
        this.panOffset.x += dx;
        this.panOffset.y += dy;
        
        this.lastPos = currentPos;
        this.updateMapTransform();
    }

    stopDragging() {
        this.isDragging = false;
    }

    getProvinceRegion(provinceId) {
        // Mappa delle province alle loro regioni
        const regionMap = {
            'TO': 'Piemonte', 'VC': 'Piemonte', 'NO': 'Piemonte', 'CN': 'Piemonte', 'AL': 'Piemonte', 'AT': 'Piemonte', 'BI': 'Piemonte', 'VB': 'Piemonte',
            'AO': 'Valle d\'Aosta',
            'MI': 'Lombardia', 'LO': 'Lombardia', 'MB': 'Lombardia', 'BG': 'Lombardia', 'BS': 'Lombardia', 'PV': 'Lombardia', 'CO': 'Lombardia', 'SO': 'Lombardia', 'VA': 'Lombardia', 'CR': 'Lombardia', 'MN': 'Lombardia', 'LC': 'Lombardia',
            'TN': 'Trentino-Alto Adige', 'BZ': 'Trentino-Alto Adige',
            'VE': 'Veneto', 'PD': 'Veneto', 'VI': 'Veneto', 'VR': 'Veneto', 'TV': 'Veneto', 'BL': 'Veneto', 'RO': 'Veneto',
            'UD': 'Friuli Venezia Giulia', 'PN': 'Friuli Venezia Giulia', 'GO': 'Friuli Venezia Giulia', 'TS': 'Friuli Venezia Giulia',
            'GE': 'Liguria', 'SP': 'Liguria', 'SV': 'Liguria', 'IM': 'Liguria', 'LA': 'Liguria',
            'BO': 'Emilia-Romagna', 'MO': 'Emilia-Romagna', 'RE': 'Emilia-Romagna', 'RA': 'Emilia-Romagna', 'FC': 'Emilia-Romagna', 'RN': 'Emilia-Romagna', 'PC': 'Emilia-Romagna', 'PR': 'Emilia-Romagna', 'FE': 'Emilia-Romagna',
            'FI': 'Toscana', 'PO': 'Toscana', 'AR': 'Toscana', 'SI': 'Toscana', 'MS': 'Toscana', 'LU': 'Toscana', 'PT': 'Toscana', 'GR': 'Toscana', 'LI': 'Toscana', 'PI': 'Toscana',
            'PG': 'Umbria', 'TR': 'Umbria',
            'AN': 'Marche', 'PU': 'Marche', 'MC': 'Marche', 'AP': 'Marche', 'FM': 'Marche',
            'RM': 'Lazio', 'VT': 'Lazio', 'RI': 'Lazio', 'LT': 'Lazio', 'FR': 'Lazio',
            'AQ': 'Abruzzo', 'TE': 'Abruzzo', 'PE': 'Abruzzo', 'CH': 'Abruzzo',
            'CB': 'Molise', 'IS': 'Molise',
            'NA': 'Campania', 'CE': 'Campania', 'BN': 'Campania', 'SA': 'Campania', 'AV': 'Campania',
            'BA': 'Puglia', 'TA': 'Puglia', 'BR': 'Puglia', 'LE': 'Puglia', 'FG': 'Puglia', 'BT': 'Puglia',
            'PZ': 'Basilicata', 'MT': 'Basilicata',
            'CS': 'Calabria', 'CZ': 'Calabria', 'RC': 'Calabria', 'KR': 'Calabria', 'VV': 'Calabria',
            'PA': 'Sicilia', 'ME': 'Sicilia', 'AG': 'Sicilia', 'CL': 'Sicilia', 'EN': 'Sicilia', 'CT': 'Sicilia', 'RG': 'Sicilia', 'SR': 'Sicilia', 'TP': 'Sicilia',
            'SS': 'Sardegna', 'NU': 'Sardegna', 'CA': 'Sardegna', 'OR': 'Sardegna', 'SU': 'Sardegna'
        };
        
        return regionMap[provinceId] || null;
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        
        if (this.isPaused) {
            this.pauseStartTime = Date.now();
            clearInterval(this.timer);
            this.pauseButton.querySelector('.pause-icon').textContent = '▶';
            this.pauseMenu.classList.add('visible');
        } else {
            // Aggiusta il tempo di inizio per compensare la pausa
            const pauseDuration = Date.now() - this.pauseStartTime;
            this.startTime += pauseDuration;
            this.startTimer();
            this.pauseButton.querySelector('.pause-icon').textContent = '⏸';
            this.pauseMenu.classList.remove('visible');
        }
    }

    resumeGame() {
        if (!this.isPaused) return;
        
        this.isPaused = false;
        const pauseDuration = Date.now() - this.pauseStartTime;
        this.startTime += pauseDuration;
        this.startTimer();
        this.pauseMenu.classList.remove('visible');
        this.pauseButton.querySelector('.pause-icon').textContent = '⏸';
    }

    exitGame() {
        this.pauseMenu.classList.remove('visible');
        this.pauseButton.style.display = 'none';
        this.regionSelector.classList.remove('hidden');
        this.header.classList.remove('hidden');
        
        // Nascondi l'intera interfaccia di gioco quando si esce dal gioco
        if (this.gameInterface) {
            this.gameInterface.style.display = 'none';
        }
        
        this.resetGame();
    }

    setupProvinceEvents() {
        document.querySelectorAll('.province').forEach(province => {
            province.addEventListener('click', (e) => {
                if (this.isPaused) return;
                
                const clickedProvince = this.provinces.find(p => p.id === province.id);
                if (!clickedProvince) return;
                
                if (clickedProvince.id === this.currentProvince.id) {
                    this.handleCorrectGuess(province);
                } else {
                    this.handleIncorrectGuess(province);
                }
            });
        });
    }

    improveZoom() {
        const svg = this.mapContainer.querySelector('svg');
        if (!svg) return;

        // Ottieni le dimensioni originali della mappa
        const viewBox = svg.getAttribute('viewBox');
        if (!viewBox) return;

        const [vx, vy, width, height] = viewBox.split(' ').map(Number);
        
        // Calcola le dimensioni del contenitore
        const containerWidth = this.mapContainer.clientWidth;
        const containerHeight = this.mapContainer.clientHeight;

        console.log("Dimensioni container effettive:", containerWidth, containerHeight);
        
        // Usa un fattore di scala più bilanciato
        this.zoomLevel = Math.min(containerWidth / width, containerHeight / height) * 2.0;
            
        // Spostamento a destra e un po' in basso (meno di prima)
        this.panOffset = {
            x: (containerWidth - width * this.zoomLevel) / 2 + (width * 0.10 * this.zoomLevel),
            y: (containerHeight - height * this.zoomLevel) / 2 + (height * 0.275 * this.zoomLevel)
        };
        
        // Applica la trasformazione
        this.updateMapTransform();
        
        console.log("Zoom migliorato applicato:", this.zoomLevel, "Offset:", this.panOffset);
    }
}

// Inizializza il gioco quando la pagina è caricata
document.addEventListener('DOMContentLoaded', () => {
    new ProvinceGame();
}); 