class StudyHub {
  constructor() {
    this.STORAGE_KEY = 'studyHubSites';
    this.THEME_KEY = 'studyHubTheme';
    this.ACCENT_KEY = 'studyHubAccent';
    this.STREAK_KEY = 'studyHubStreaks';
    this.POMODORO_KEY = 'studyHubPomodoro';
    this.ACTIVE_VIEW_KEY = 'studyHubActiveView'; // New key for active view
    this.sites = this.loadSites();
    this.filteredSites = [...this.sites];
    this.currentEditSiteId = null; // Track which site is being edited
    this.tempTags = []; // For managing tags in the modal form
    // Streak properties
    this.streaks = this.loadStreaks();
    // Pomodoro properties
    this.pomodoro = {
      workDuration: 25 * 60, // 25 minutes in seconds
      shortBreakDuration: 5 * 60, // 5 minutes
      longBreakDuration: 15 * 60, // 15 minutes
      currentPhase: 'work', // 'work', 'short-break', 'long-break'
      remainingTime: 25 * 60,
      intervalId: null,
      sessionsCompleted: 0, // Number of work sessions completed
      isRunning: false,
      lastTickTime: Date.now(), // To account for time spent away from tab
      studyTimeToday: 0, // Total study time in minutes for today
      lastStudyDay: null // Date object for the last day study time was recorded
    };
    this.loadPomodoroState(); // Load saved state
    this.init();
  }

  // --- Initialization ---
  init() {
    this.applySavedTheme();
    this.applySavedAccent();
    this.checkStreak(); // Check and update streak on app load
    this.checkStudyTimeToday(); // Check and reset study time if new day
    this.renderSites();
    this.updateStats();
    this.updatePomodoroDisplay(); // Initial display of pomodoro timer and settings inputs
    this.bindEvents();
    this.applySavedView(); // Apply the last saved view
    // If timer was running, resume it
    if (this.pomodoro.isRunning) {
      const timeElapsedSinceLastTick = (Date.now() - this.pomodoro.lastTickTime) / 1000;
      this.pomodoro.remainingTime = Math.max(0, this.pomodoro.remainingTime - Math.floor(timeElapsedSinceLastTick));
      this.startPomodoroTimer();
    }
  }

  // --- Data Management (localStorage) ---
  loadSites() {
    try {
      const storedSites = localStorage.getItem(this.STORAGE_KEY);
      if (storedSites) {
        // Parse dates correctly when loading from storage
        return JSON.parse(storedSites).map(site => ({
          ...site,
          dateAdded: new Date(site.dateAdded)
        }));
      }
    } catch (error) {
      console.error("Error loading sites from localStorage:", error);
    }
    // Initial dummy data if no sites are found or loading fails
    return [
      {
        id: 1,
        name: "Notion",
        url: "https://notion.so",
        description: "All-in-one workspace for notes, tasks, and project management. Perfect for organizing your study materials.",
        logo: this.generateLogo("https://notion.so"),
        tags: ["productivity", "notes", "planning"],
        visits: 0,
        dateAdded: new Date(Date.now() - 86400000) // Yesterday
      },
      {
        id: 2,
        name: "Edexcel Portal",
        url: "https://qualifications.pearson.com",
        description: "Official Edexcel qualifications portal for past papers, specifications, and exam resources.",
        logo: this.generateLogo("https://qualifications.pearson.com"),
        tags: ["exams", "edexcel", "past-papers"],
        visits: 0,
        dateAdded: new Date()
      }
    ];
  }

  saveSites() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.sites));
    } catch (error) {
      console.error("Error saving sites to localStorage:", error);
    }
  }

  loadStreaks() {
    try {
      const storedStreaks = localStorage.getItem(this.STREAK_KEY);
      if (storedStreaks) {
        const parsed = JSON.parse(storedStreaks);
        return {
          current: parsed.current || 0,
          longest: parsed.longest || 0,
          lastDate: parsed.lastDate ? new Date(parsed.lastDate) : null
        };
      }
    } catch (error) {
      console.error("Error loading streaks from localStorage:", error);
    }
    return { current: 0, longest: 0, lastDate: null };
  }

  saveStreaks() {
    try {
      localStorage.setItem(this.STREAK_KEY, JSON.stringify(this.streaks));
    } catch (error) {
      console.error("Error saving streaks to localStorage:", error);
    }
  }

  loadPomodoroState() {
    try {
      const storedPomodoro = localStorage.getItem(this.POMODORO_KEY);
      if (storedPomodoro) {
        const parsed = JSON.parse(storedPomodoro);
        // Merge with default to ensure all properties exist for new features
        this.pomodoro = {
          ...this.pomodoro,
          ...parsed,
          lastStudyDay: parsed.lastStudyDay ? new Date(parsed.lastStudyDay) : null
        };
      }
    } catch (error) {
      console.error("Error loading pomodoro state from localStorage:", error);
    }
  }

  savePomodoroState() {
    try {
      localStorage.setItem(this.POMODORO_KEY, JSON.stringify({
        workDuration: this.pomodoro.workDuration,
        shortBreakDuration: this.pomodoro.shortBreakDuration,
        longBreakDuration: this.pomodoro.longBreakDuration,
        currentPhase: this.pomodoro.currentPhase,
        remainingTime: this.pomodoro.remainingTime,
        sessionsCompleted: this.pomodoro.sessionsCompleted,
        isRunning: this.pomodoro.isRunning,
        lastTickTime: Date.now(), // Save current time to account for tab closure
        studyTimeToday: this.pomodoro.studyTimeToday,
        lastStudyDay: this.pomodoro.lastStudyDay
      }));
    } catch (error) {
      console.error("Error saving pomodoro state to localStorage:", error);
    }
  }

  // --- Streak Logic ---
  checkStreak() {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    const lastDate = this.streaks.lastDate;
    let lastDateNormalized = null;
    if (lastDate) {
      lastDateNormalized = new Date(lastDate);
      lastDateNormalized.setHours(0, 0, 0, 0);
    }
    const oneDay = 24 * 60 * 60 * 1000;
    const diffTime = lastDateNormalized ? (today.getTime() - lastDateNormalized.getTime()) : null;
    const diffDays = diffTime !== null ? Math.round(diffTime / oneDay) : null;
    if (lastDateNormalized === null || diffDays > 1) {
      // First visit ever or streak broken (more than 1 day difference)
      this.streaks.current = 1;
    } else if (diffDays === 1) {
      // Consecutive day, streak continues
      this.streaks.current++;
    }
    // If diffDays is 0, it's the same day, streak doesn't change
    this.streaks.lastDate = today; // Update last visit date
    if (this.streaks.current > this.streaks.longest) {
      this.streaks.longest = this.streaks.current;
    }
    this.saveStreaks();
  }

  // --- Study Time Today Logic ---
  checkStudyTimeToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastStudyDay = this.pomodoro.lastStudyDay;
    let lastStudyDayNormalized = null;
    if (lastStudyDay) {
      lastStudyDayNormalized = new Date(lastStudyDay);
      lastStudyDayNormalized.setHours(0, 0, 0, 0);
    }
    if (lastStudyDayNormalized === null || today.getTime() !== lastStudyDayNormalized.getTime()) {
      // It's a new day, reset study time
      this.pomodoro.studyTimeToday = 0;
      this.pomodoro.lastStudyDay = today;
      this.savePomodoroState();
    }
  }

  // --- Theme & Accent Management ---
  applySavedTheme() {
    const savedTheme = localStorage.getItem(this.THEME_KEY);
    const themeToggle = document.getElementById('theme-toggle');
    if (savedTheme === 'light') {
      document.body.classList.add('light-mode');
      if (themeToggle) themeToggle.checked = true;
    } else {
      document.body.classList.remove('light-mode');
      if (themeToggle) themeToggle.checked = false;
    }
  }

  toggleTheme() {
    document.body.classList.toggle('light-mode');
    const currentTheme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
    localStorage.setItem(this.THEME_KEY, currentTheme);
  }

  applySavedAccent() {
    const savedAccent = localStorage.getItem(this.ACCENT_KEY);
    if (savedAccent) {
      document.body.dataset.accent = savedAccent;
      this.updateSelectedSwatch(savedAccent);
      this.updateBackgroundGradientColors(savedAccent, document.body.classList.contains('light-mode'));
    } else {
      // Default to indigo if no accent saved
      document.body.dataset.accent = 'indigo';
      this.updateSelectedSwatch('indigo');
      this.updateBackgroundGradientColors('indigo', document.body.classList.contains('light-mode'));
    }
  }

  changeAccent(colorName) {
    document.body.dataset.accent = colorName;
    localStorage.setItem(this.ACCENT_KEY, colorName);
    this.updateSelectedSwatch(colorName);
    this.updateBackgroundGradientColors(colorName, document.body.classList.contains('light-mode'));
  }

  updateSelectedSwatch(colorName) {
    const swatches = document.querySelectorAll('.color-swatch');
    swatches.forEach(swatch => {
      swatch.classList.remove('selected');
      if (swatch.dataset.color === colorName) {
        swatch.classList.add('selected');
      }
    });
  }

  updateBackgroundGradientColors(accentColor, isLightMode) {
    let color1, color2;
    const opacity = isLightMode ? '0.02' : '0.1';
    switch (accentColor) {
      case 'indigo':
        color1 = `rgba(99, 102, 241, ${opacity})`;
        color2 = `rgba(139, 92, 246, ${opacity})`;
        break;
      case 'blue':
        color1 = `rgba(59, 130, 246, ${opacity})`;
        color2 = `rgba(37, 99, 235, ${opacity})`;
        break;
      case 'green':
        color1 = `rgba(16, 185, 129, ${opacity})`;
        color2 = `rgba(5, 150, 105, ${opacity})`;
        break;
      case 'orange':
        color1 = `rgba(249, 115, 22, ${opacity})`;
        color2 = `rgba(234, 88, 12, ${opacity})`;
        break;
      case 'purple':
        color1 = `rgba(168, 85, 247, ${opacity})`;
        color2 = `rgba(147, 51, 234, ${opacity})`;
        break;
      default: // Fallback to indigo
        color1 = `rgba(99, 102, 241, ${opacity})`;
        color2 = `rgba(139, 92, 246, ${opacity})`;
    }
    document.documentElement.style.setProperty('--bg-gradient-color1', color1);
    document.documentElement.style.setProperty('--bg-gradient-color2', color2);
  }

  // --- View Switching Logic ---
  showView(viewName) {
    const linksSection = document.getElementById('links-section');
    const toolsSection = document.getElementById('tools-section');
    const showLinksBtn = document.getElementById('show-links-btn');
    const showToolsBtn = document.getElementById('show-tools-btn');
    const addBtn = document.getElementById('add-btn'); // The floating add button
    // Deactivate all sections and buttons
    linksSection.classList.remove('active');
    toolsSection.classList.remove('active');
    showLinksBtn.classList.remove('active');
    showToolsBtn.classList.remove('active');
    // Activate the requested section and button
    if (viewName === 'links') {
      linksSection.classList.add('active');
      showLinksBtn.classList.add('active');
      addBtn.style.display = 'flex'; // Show add button for links section
    } else if (viewName === 'tools') {
      toolsSection.classList.add('active');
      showToolsBtn.classList.add('active');
      addBtn.style.display = 'none'; // Hide add button for tools section
    }
    localStorage.setItem(this.ACTIVE_VIEW_KEY, viewName); // Save active view
  }

  applySavedView() {
    const savedView = localStorage.getItem(this.ACTIVE_VIEW_KEY);
    // Default to 'links' if no view saved or invalid view
    this.showView(savedView === 'tools' ? 'tools' : 'links');
  }

  // --- Event Binding ---
  bindEvents() {
    const addBtn = document.getElementById('add-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const form = document.getElementById('add-edit-site-form');
    const modal = document.getElementById('modal');
    const searchInput = document.getElementById('search-input');
    const tagInput = document.getElementById('tag-input');
    const siteUrlInput = document.getElementById('site-url');
    const burgerMenuToggle = document.getElementById('burger-menu-toggle');
    const sideMenu = document.getElementById('side-menu');
    const themeToggle = document.getElementById('theme-toggle');
    const colorSwatchesContainer = document.getElementById('color-swatches');
    // Main Navigation Buttons
    const showLinksBtn = document.getElementById('show-links-btn');
    const showToolsBtn = document.getElementById('show-tools-btn');
    // Pomodoro Timer Buttons
    const startTimerBtn = document.getElementById('start-timer-btn');
    const pauseTimerBtn = document.getElementById('pause-timer-btn');
    const resetTimerBtn = document.getElementById('reset-timer-btn');
    const pomodoroSettingsToggle = document.getElementById('pomodoro-settings-toggle');
    const pomodoroSettingsPanel = document.getElementById('pomodoro-settings-panel');
    // Pomodoro Settings Inputs
    const workDurationInput = document.getElementById('work-duration-input');
    const shortBreakDurationInput = document.getElementById('short-break-duration-input');
    const longBreakDurationInput = document.getElementById('long-break-duration-input');
    addBtn.addEventListener('click', () => this.openModal('add'));
    cancelBtn.addEventListener('click', () => this.closeModal());
    form.addEventListener('submit', (e) => this.handleAddEditSite(e));
    searchInput.addEventListener('input', (e) => this.handleSearch(e));
    // Close modal on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeModal();
      }
    });
    // Handle tag input (add on Enter)
    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && tagInput.value.trim() !== '') {
        e.preventDefault(); // Prevent form submission
        this.addTag(tagInput.value.trim());
        tagInput.value = ''; // Clear input after adding
      }
    });
    // Auto-generate description on URL input blur
    siteUrlInput.addEventListener('blur', async () => {
      const url = siteUrlInput.value.trim();
      const name = document.getElementById('site-name').value.trim();
      const descriptionInput = document.getElementById('site-description');
      // Only generate if URL is valid and description is empty
      if (url && name && !descriptionInput.value.trim()) {
        await this.generateDescriptionFromLLM(name, url);
      }
    });
    // Burger menu toggle
    burgerMenuToggle.addEventListener('click', () => {
      burgerMenuToggle.classList.toggle('open');
      sideMenu.classList.toggle('open');
    });
    // Close side menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!sideMenu.contains(e.target) && !burgerMenuToggle.contains(e.target) && sideMenu.classList.contains('open')) {
        burgerMenuToggle.classList.remove('open');
        sideMenu.classList.remove('open');
      }
    });
    // Theme toggle
    themeToggle.addEventListener('change', () => this.toggleTheme());
    // Accent color changer
    colorSwatchesContainer.addEventListener('click', (e) => {
      const swatch = e.target.closest('.color-swatch');
      if (swatch) {
        this.changeAccent(swatch.dataset.color);
      }
    });
    // Main Navigation Event Listeners
    showLinksBtn.addEventListener('click', () => this.showView('links'));
    showToolsBtn.addEventListener('click', () => this.showView('tools'));
    // Pomodoro Timer Event Listeners
    startTimerBtn.addEventListener('click', () => this.startPomodoroTimer());
    pauseTimerBtn.addEventListener('click', () => this.pausePomodoroTimer());
    resetTimerBtn.addEventListener('click', () => this.resetPomodoroTimer());
    // Pomodoro Settings Toggle
    pomodoroSettingsToggle.addEventListener('click', () => {
      pomodoroSettingsPanel.classList.toggle('open');
      pomodoroSettingsToggle.classList.toggle('open');
    });
    // Pomodoro Settings Input Listeners
    workDurationInput.addEventListener('change', (e) => this.updatePomodoroSettings('work', e.target.value));
    shortBreakDurationInput.addEventListener('change', (e) => this.updatePomodoroSettings('shortBreak', e.target.value));
    longBreakDurationInput.addEventListener('change', (e) => this.updatePomodoroSettings('longBreak', e.target.value));
  }

  // --- Custom Message Box (instead of alert/confirm) ---
  showMessageBox(title, message, buttons) {
    return new Promise(resolve => {
      const overlay = document.getElementById('message-box-overlay');
      const titleEl = document.getElementById('message-box-title');
      const textEl = document.getElementById('message-box-text');
      const actionsEl = document.getElementById('message-box-actions');
      titleEl.textContent = title;
      textEl.textContent = message;
      actionsEl.innerHTML = ''; // Clear previous buttons
      buttons.forEach(btnConfig => {
        const button = document.createElement('button');
        button.className = `btn ${btnConfig.className || 'btn-secondary'}`;
        button.textContent = btnConfig.text;
        button.addEventListener('click', () => {
          overlay.classList.remove('show');
          setTimeout(() => { overlay.style.display = 'none'; }, 300); // Match CSS transition
          resolve(btnConfig.value);
        });
        actionsEl.appendChild(button);
      });
      overlay.style.display = 'flex';
      setTimeout(() => overlay.classList.add('show'), 10);
    });
  }

  // --- Modal Operations ---
  openModal(mode, site = null) {
    const modal = document.getElementById('modal');
    const formTitle = document.getElementById('modal-title');
    const saveButton = document.getElementById('save-resource-btn');
    const siteNameInput = document.getElementById('site-name');
    const siteUrlInput = document.getElementById('site-url');
    const siteDescriptionTextarea = document.getElementById('site-description');
    const siteIdInput = document.getElementById('site-id');
    const tagInputContainer = document.getElementById('tag-input-container');
    const tagInput = document.getElementById('tag-input');
    // Clear previous tags and add input back
    tagInputContainer.innerHTML = '';
    tagInputContainer.appendChild(tagInput);
    this.tempTags = [];
    if (mode === 'add') {
      formTitle.textContent = 'Add New Study Resource';
      saveButton.textContent = 'Add Resource';
      document.getElementById('add-edit-site-form').reset();
      this.currentEditSiteId = null;
    } else if (mode === 'edit' && site) {
      formTitle.textContent = 'Edit Study Resource';
      saveButton.textContent = 'Save Changes';
      siteNameInput.value = site.name;
      siteUrlInput.value = site.url;
      siteDescriptionTextarea.value = site.description;
      siteIdInput.value = site.id;
      this.currentEditSiteId = site.id;
      this.tempTags = [...site.tags]; // Populate tempTags with existing tags
      this.renderTempTags(); // Render existing tags in the modal
    }
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10); // Trigger CSS transition
    siteNameInput.focus();
  }

  closeModal() {
    const modal = document.getElementById('modal');
    modal.classList.remove('show');
    setTimeout(() => {
      modal.style.display = 'none';
      document.getElementById('add-edit-site-form').reset();
      this.currentEditSiteId = null;
      this.tempTags = []; // Clear temporary tags
      const tagInputContainer = document.getElementById('tag-input-container');
      const tagInput = document.getElementById('tag-input');
      tagInputContainer.innerHTML = ''; // Clear existing tags in the modal
      tagInputContainer.appendChild(tagInput); // Re-add the input field
    }, 300); // Match CSS transition duration
  }

  // --- Tag Management in Modal ---
  addTag(tagText) {
    const normalizedTag = tagText.toLowerCase().replace(/[^a-z0-9-]/g, ''); // Basic normalization
    if (normalizedTag && !this.tempTags.includes(normalizedTag)) {
      this.tempTags.push(normalizedTag);
      this.renderTempTags();
    }
  }

  removeTag(tagText) {
    this.tempTags = this.tempTags.filter(tag => tag !== tagText);
    this.renderTempTags();
  }

  renderTempTags() {
    const tagInputContainer = document.getElementById('tag-input-container');
    const tagInput = document.getElementById('tag-input');
    // Remove all current tags, but keep the input field
    const existingTags = tagInputContainer.querySelectorAll('.modal-tag');
    existingTags.forEach(tag => tag.remove());
    // Add new tags before the input field
    this.tempTags.forEach(tag => {
      const tagSpan = document.createElement('span');
      tagSpan.classList.add('modal-tag');
      tagSpan.textContent = tag;
      const removeBtn = document.createElement('button');
      removeBtn.classList.add('remove-tag-btn');
      removeBtn.innerHTML = '&times;'; // 'x' icon
      removeBtn.setAttribute('aria-label', `Remove tag: ${tag}`);
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault(); // Prevent form submission
        this.removeTag(tag);
      });
      tagSpan.appendChild(removeBtn);
      tagInputContainer.insertBefore(tagSpan, tagInput);
    });
    tagInput.focus(); // Keep focus on the input after adding/removing
  }

  // --- AI Description Generation ---
  async generateDescriptionFromLLM(name, url) {
    const descriptionInput = document.getElementById('site-description');
    const spinner = document.getElementById('url-spinner');
    spinner.classList.add('active'); // Show spinner
    try {
      const prompt = `Generate a brief, helpful description for a study resource.
        Site Name: ${name}
        URL: ${url}
        Focus on its utility for learning, research, or productivity. Max 30 words.`;
      let chatHistory = [];
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });
      const payload = { contents: chatHistory };
      const apiKey = ""; // Canvas will provide this at runtime
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (
        result.candidates &&
        result.candidates.length > 0 &&
        result.candidates[0].content &&
        result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0
      ) {
        const text = result.candidates[0].content.parts[0].text;
        descriptionInput.value = text; // Populate the description field
      } else {
        console.warn("LLM response did not contain expected content structure.");
        this.showMessageBox(
          'Generation Failed',
          'Could not generate a description. Please try again or enter manually.',
          [{ text: 'OK', className: 'btn-primary', value: true }]
        );
      }
    } catch (error) {
      console.error("Error generating description:", error);
      this.showMessageBox(
        'Generation Error',
        `Failed to generate description: ${error.message}. Please try again or enter manually.`,
        [{ text: 'OK', className: 'btn-primary', value: true }]
      );
    } finally {
      spinner.classList.remove('active'); // Hide spinner
    }
  }

  // --- CRUD Operations ---
  handleAddEditSite(e) {
    e.preventDefault();
    const name = document.getElementById('site-name').value.trim();
    const url = document.getElementById('site-url').value.trim();
    const description = document.getElementById('site-description').value.trim();
    const siteId = document.getElementById('site-id').value;
    if (!name || !url) {
      this.showMessageBox(
        'Missing Information',
        'Please fill in both site name and URL fields.',
        [{ text: 'OK', className: 'btn-primary', value: true }]
      );
      return;
    }
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      finalUrl = 'https://' + url;
    }
    if (this.currentEditSiteId) {
      // Edit existing site
      const siteIndex = this.sites.findIndex(s => s.id === parseInt(siteId));
      if (siteIndex > -1) {
        this.sites[siteIndex] = {
          ...this.sites[siteIndex],
          name,
          url: finalUrl,
          description: description || `Access ${name} for your studies`,
          logo: this.generateLogo(finalUrl), // Re-generate logo on URL change
          tags: [...this.tempTags] // Use the tags from modal
        };
        this.showMessageBox(
          'Site Updated',
          `${name} has been updated successfully!`,
          [{ text: 'OK', className: 'btn-primary', value: true }]
        );
      }
    } else {
      // Add new site
      const newSite = {
        id: Date.now(), // Unique ID
        name,
        url: finalUrl,
        description: description || `Access ${name} for your studies`,
        logo: this.generateLogo(finalUrl),
        tags: [...this.tempTags], // Use the tags from modal
        visits: 0,
        dateAdded: new Date()
      };
      this.sites.push(newSite);
      this.showMessageBox(
        'Site Added',
        `${name} has been added to your Study Hub!`,
        [{ text: 'OK', className: 'btn-primary', value: true }]
      );
    }
    this.saveSites();
    this.filterSites(); // Re-filter after add/edit
    this.renderSites();
    this.updateStats();
    this.closeModal();
  }

  async deleteSite(id) {
    const confirmation = await this.showMessageBox(
      'Confirm Deletion',
      'Are you sure you want to delete this study resource? This action cannot be undone.',
      [
        { text: 'Cancel', className: 'btn-secondary', value: false },
        { text: 'Delete', className: 'btn-primary', value: true }
      ]
    );
    if (confirmation) {
      this.sites = this.sites.filter(site => site.id !== id);
      this.saveSites();
      this.filterSites(); // Re-filter after delete
      this.renderSites();
      this.updateStats();
      this.showMessageBox(
        'Resource Deleted',
        'The study resource has been successfully deleted.',
        [{ text: 'OK', className: 'btn-primary', value: true }]
      );
    }
  }

  // --- Search Filtering ---
  handleSearch(e) {
    this.filterSites(e.target.value);
  }

  filterSites(query = '') {
    const lowerCaseQuery = query.toLowerCase();
    this.filteredSites = this.sites.filter(site =>
      site.name.toLowerCase().includes(lowerCaseQuery) ||
      site.description.toLowerCase().includes(lowerCaseQuery) ||
      site.tags.some(tag => tag.toLowerCase().includes(lowerCaseQuery))
    );
    this.renderSites();
  }

  // --- Logo Generation ---
  generateLogo(url) {
    try {
      const domain = new URL(url).hostname;
      // Prefer Google's favicon service for higher quality favicons
      return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
    } catch (e) {
      console.warn("Could not parse URL for favicon, falling back:", url, e);
      // Fallback to a simple icon if URL is invalid or favicon service fails
      return this.createFallbackIcon(url);
    }
  }

  createFallbackIcon(text) {
    // Create a simple SVG icon with the first letter or a generic 'S'
    const letter = text.charAt(0).toUpperCase() || 'S';
    const colors = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
    const color = colors[text.length % colors.length];
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" rx="12" fill="${color}"/>
        <text x="32" y="40" font-family="Inter, sans-serif" font-size="24" font-weight="600" fill="white" text-anchor="middle" dominant-baseline="middle">${letter}</text>
      </svg>
    `)}`;
  }

  // --- Site Interaction ---
  openSite(siteId) {
    const site = this.sites.find(s => s.id === siteId);
    if (site) {
      site.visits = (site.visits || 0) + 1; // Increment visits
      this.saveSites();
      this.updateStats();
      window.open(site.url, '_blank');
    }
  }

  // --- Rendering ---
  renderSites() {
    const grid = document.getElementById('site-grid');
    if (this.filteredSites.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>No resources found</h3>
          <p>Try adjusting your search or add a new resource</p>
        </div>
      `;
      return;
    }
    grid.innerHTML = this.filteredSites.map(site => {
      const fallbackIcon = this.createFallbackIcon(site.name);
      let siteDomain = '';
      try {
        siteDomain = new URL(site.url).hostname;
      } catch (e) {
        siteDomain = 'Invalid URL';
      }
      return `
        <div class="site-card" data-site-id="${site.id}" tabindex="0" role="link" aria-label="Open ${site.name}">
          <div class="site-header">
            <img src="${site.logo}" alt="${site.name} logo" class="site-logo" loading="lazy" onerror="this.src='${fallbackIcon}'">
            <div class="site-info">
              <h3>${site.name}</h3>
              <div class="site-url">${siteDomain}</div>
            </div>
          </div>
          <p class="site-description">${site.description}</p>
          <div class="site-tags">
            ${site.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
          </div>
          <div class="site-actions">
            <button class="btn edit-btn" data-id="${site.id}" aria-label="Edit ${site.name}">Edit</button>
            <button class="btn delete-btn" data-id="${site.id}" aria-label="Delete ${site.name}">Delete</button>
          </div>
        </div>
      `;
    }).join('');
    // Add click handlers for site cards (to open URL)
    grid.querySelectorAll('.site-card').forEach(card => {
      // Use event delegation for the card click to open site, but exclude button clicks
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.site-actions button')) {
          const siteId = parseInt(card.dataset.siteId);
          this.openSite(siteId);
        }
      });
      // Allow opening with Enter key for accessibility
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.target.closest('.site-actions button')) {
          const siteId = parseInt(card.dataset.siteId);
          this.openSite(siteId);
        }
      });
    });
    // Add click handlers for edit buttons
    grid.querySelectorAll('.edit-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card click from firing
        const siteId = parseInt(e.target.dataset.id);
        const siteToEdit = this.sites.find(s => s.id === siteId);
        if (siteToEdit) {
          this.openModal('edit', siteToEdit);
        }
      });
    });
    // Add click handlers for delete buttons
    grid.querySelectorAll('.delete-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card click from firing
        const siteId = parseInt(e.target.dataset.id);
        this.deleteSite(siteId);
      });
    });
  }

  // --- Stats Update ---
  updateStats() {
    const totalSites = this.sites.length;
    const visitsToday = this.sites.reduce((sum, site) => sum + (site.visits || 0), 0);
    document.getElementById('total-sites').textContent = totalSites;
    document.getElementById('visits-today').textContent = visitsToday;
    document.getElementById('current-streak').textContent = this.streaks.current;
    document.getElementById('longest-streak').textContent = this.streaks.longest;
    document.getElementById('study-time-today').textContent = `${this.pomodoro.studyTimeToday}m`;
  }

  // --- Pomodoro Timer Logic ---
  startPomodoroTimer() {
    if (this.pomodoro.isRunning) return;
    this.pomodoro.isRunning = true;
    this.pomodoro.lastTickTime = Date.now(); // Record start time or resume time
    this.savePomodoroState(); // Save state immediately
    document.getElementById('start-timer-btn').disabled = true;
    document.getElementById('pause-timer-btn').disabled = false;
    document.getElementById('reset-timer-btn').disabled = false;
    this.pomodoro.intervalId = setInterval(() => {
      this.pomodoro.remainingTime--;
      this.savePomodoroState(); // Save state on each tick
      this.updatePomodoroDisplay();
      if (this.pomodoro.remainingTime <= 0) {
        this.playCompletionSound();
        this.nextPomodoroPhase();
      }
    }, 1000);
  }

  pausePomodoroTimer() {
    if (!this.pomodoro.isRunning) return;
    clearInterval(this.pomodoro.intervalId);
    this.pomodoro.isRunning = false;
    this.savePomodoroState(); // Save state on pause
    document.getElementById('start-timer-btn').disabled = false;
    document.getElementById('pause-timer-btn').disabled = true;
  }

  resetPomodoroTimer() {
    this.pausePomodoroTimer(); // Stop any running timer
    this.pomodoro.currentPhase = 'work';
    this.pomodoro.remainingTime = this.pomodoro.workDuration;
    this.pomodoro.sessionsCompleted = 0;
    this.pomodoro.isRunning = false;
    this.savePomodoroState(); // Save reset state
    this.updatePomodoroDisplay(); // Update display with new work duration
    document.getElementById('start-timer-btn').disabled = false;
    document.getElementById('pause-timer-btn').disabled = true;
    document.getElementById('reset-timer-btn').disabled = false;
  }

  nextPomodoroPhase() {
    clearInterval(this.pomodoro.intervalId);
    this.pomodoro.isRunning = false;
    if (this.pomodoro.currentPhase === 'work') {
      this.pomodoro.sessionsCompleted++;
      this.pomodoro.studyTimeToday += (this.pomodoro.workDuration / 60); // Add completed work minutes
      this.pomodoro.lastStudyDay = new Date(); // Update last study day
      this.pomodoro.lastStudyDay.setHours(0, 0, 0, 0); // Normalize
      this.updateStats(); // Update study time display
      if (this.pomodoro.sessionsCompleted % 4 === 0) {
        this.pomodoro.currentPhase = 'long-break';
        this.pomodoro.remainingTime = this.pomodoro.longBreakDuration;
      } else {
        this.pomodoro.currentPhase = 'short-break';
        this.pomodoro.remainingTime = this.pomodoro.shortBreakDuration;
      }
    } else {
      this.pomodoro.currentPhase = 'work';
      this.pomodoro.remainingTime = this.pomodoro.workDuration;
    }
    this.savePomodoroState(); // Save state after phase change
    this.updatePomodoroDisplay();
    this.startPomodoroTimer(); // Automatically start next phase
  }

  updatePomodoroDisplay() {
    const minutes = Math.floor(this.pomodoro.remainingTime / 60);
    const seconds = this.pomodoro.remainingTime % 60;
    const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('timer-display').textContent = display;
    let statusText = '';
    switch (this.pomodoro.currentPhase) {
      case 'work':
        statusText = 'Work Time!';
        break;
      case 'short-break':
        statusText = 'Short Break!';
        break;
      case 'long-break':
        statusText = 'Long Break!';
        break;
    }
    document.getElementById('pomodoro-status').textContent = statusText;
    // Update document title for easy tracking in browser tab
    document.title = `(${display}) Study Hub - ${statusText}`;
    // Update input fields to reflect current settings (useful on load)
    document.getElementById('work-duration-input').value = this.pomodoro.workDuration / 60;
    document.getElementById('short-break-duration-input').value = this.pomodoro.shortBreakDuration / 60;
    document.getElementById('long-break-duration-input').value = this.pomodoro.longBreakDuration / 60;
  }

  updatePomodoroSettings(type, value) {
    const minutes = parseInt(value);
    if (isNaN(minutes) || minutes < 1) {
      this.showMessageBox(
        'Invalid Input',
        'Please enter a valid number (1 or greater) for the duration.',
        [{ text: 'OK', className: 'btn-primary', value: true }]
      );
      // Revert to previous valid value
      this.updatePomodoroDisplay();
      return;
    }
    switch (type) {
      case 'work':
        this.pomodoro.workDuration = minutes * 60;
        break;
      case 'shortBreak':
        this.pomodoro.shortBreakDuration = minutes * 60;
        break;
      case 'longBreak':
        this.pomodoro.longBreakDuration = minutes * 60;
        break;
    }
    // When settings change, reset the timer to the new work duration
    this.resetPomodoroTimer();
    this.savePomodoroState();
  }

  playCompletionSound() {
    // A simple beep sound using AudioContext for better compatibility
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sine'; // Sine wave for a clean beep
    oscillator.frequency.value = 440; // A4 note
    gainNode.gain.value = 0.5; // Volume
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.5); // Play for 0.5 seconds
  }
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  const studyHub = new StudyHub();
});