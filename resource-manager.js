window.ResourceManager = class {
    constructor() {
        this.resources = {
            textures: {
                walls: new Map(),
                doors: new Map(),
                floors: new Map(),
                props: new Map()  // For things like torches, furniture, etc.
            },
            sounds: {
                ambient: new Map(),
                effects: new Map()
            },
            splashArt: new Map(),
            effects: {
                particles: new Map(),
                lighting: new Map()
            }
        };
        
        this.loadedPacks = new Map();  // Store multiple resource packs
        this.activePackId = null;
        this.mapResourceLinks = new Map();  // Track which maps use which resources
        this.activeResourcePack = null;
        this.thumbnailSize = 100;  // Default thumbnail size
    }

    // Resource pack methods
    async loadResourcePack(jsonFile) {
        try {
            const response = await fetch(jsonFile);
            const packData = await response.json();
            this.activeResourcePack = packData;

            // Load all resources from pack
            await this.loadTextures(packData.textures);
            await this.loadSounds(packData.sounds);
            await this.loadSplashArt(packData.splashArt);

            return true;
        } catch (error) {
            console.error('Error loading resource pack:', error);
            return false;
        }
    }

    async saveResourcePack(filename = 'resource-pack.json') {
        const packData = {
            name: this.activeResourcePack?.name || 'New Resource Pack',
            version: '1.0',
            textures: this.serializeTextures(),
            sounds: this.serializeSounds(),
            splashArt: this.serializeSplashArt()
        };

        const blob = new Blob([JSON.stringify(packData, null, 2)], 
            { type: 'application/json' });
        
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    }

    // Method to link resources to a map
linkMapToResources(mapName, resourceIds) {
    this.mapResourceLinks.set(mapName, {
        packId: this.activePackId,
        resources: resourceIds
    });
}

// Load additional resource pack without replacing current one
async loadAdditionalPack(jsonFile) {
    try {
        const response = await fetch(jsonFile);
        const packData = await response.json();
        this.loadedPacks.set(packData.id, packData);
        
        // Optional: Switch to this pack
        // this.switchResourcePack(packData.id);
        
        return packData.id;
    } catch (error) {
        console.error('Error loading resource pack:', error);
        return null;
    }
}

// Switch between loaded resource packs
switchResourcePack(packId) {
    if (this.loadedPacks.has(packId)) {
        this.activePackId = packId;
        // Update UI to reflect active pack
        this.updateResourceUI();
        return true;
    }
    return false;
}

// Get resource from any loaded pack
getResourceFromPack(resourceId, packId = null) {
    const pack = packId ? 
        this.loadedPacks.get(packId) : 
        this.loadedPacks.get(this.activePackId);
    
    return pack?.resources[resourceId] || null;
}

    // Texture handling
    async addTexture(file, category, subcategory) {
        if (!file || !category) return null;

        try {
            // Create thumbnail and base64 data
            const imageData = await this.createImageData(file);
            const thumbnail = await this.createThumbnail(file);

            const textureData = {
                id: `${category}_${Date.now()}`,
                name: file.name,
                category,
                subcategory,
                data: imageData,
                thumbnail,
                dateAdded: new Date().toISOString()
            };

            // Store in appropriate category
            if (!this.resources.textures[category]) {
                this.resources.textures[category] = new Map();
            }
            this.resources.textures[category].set(textureData.id, textureData);

            return textureData.id;
        } catch (error) {
            console.error('Error adding texture:', error);
            return null;
        }
    }

    async createImageData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async createThumbnail(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate thumbnail dimensions maintaining aspect ratio
                const ratio = img.width / img.height;
                let width = this.thumbnailSize;
                let height = this.thumbnailSize;
                
                if (ratio > 1) {
                    height = width / ratio;
                } else {
                    width = height * ratio;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/webp', 0.8));
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    getTexture(id, category) {
        return this.resources.textures[category]?.get(id) || null;
    }

    // Gallery UI methods can be added here
    createGalleryUI(container) {
        container.innerHTML = '';
        
        // Create category tabs
        const tabs = document.createElement('div');
        tabs.className = 'resource-tabs';
        
        Object.keys(this.resources.textures).forEach(category => {
            const tab = document.createElement('div');
            tab.className = 'resource-tab';
            tab.textContent = category.charAt(0).toUpperCase() + category.slice(1);
            tab.onclick = () => this.showCategory(category, container);
            tabs.appendChild(tab);
        });

        container.appendChild(tabs);
        
        // Create gallery content area
        const content = document.createElement('div');
        content.className = 'resource-content';
        container.appendChild(content);

        // Show first category by default
        const firstCategory = Object.keys(this.resources.textures)[0];
        if (firstCategory) {
            this.showCategory(firstCategory, container);
        }
    }

    updateGallery(drawer, category, view = 'grid') {
        const container = drawer.querySelector('#textureGallery');
        if (!container) return;
    
        // Update container class based on view
        container.className = view === 'grid' ? 'gallery-grid' : 'gallery-list';
    
        // Clear existing content
        container.innerHTML = '';
    
        // Get resources for the selected category
        const resources = this.resources.textures[category];
        if (!resources || resources.size === 0) {
            container.innerHTML = `
                <sl-card class="empty-gallery">
                    <div style="text-align: center; padding: 2rem;">
                        <span class="material-icons" style="font-size: 3rem; opacity: 0.5;">image_not_supported</span>
                        <p>No ${category} added yet</p>
                    </div>
                </sl-card>
            `;
            return;
        }
    
        // Create preview tooltip element for list view
        let previewTooltip = document.querySelector('.resource-preview-tooltip');
        if (!previewTooltip) {
            previewTooltip = document.createElement('div');
            previewTooltip.className = 'resource-preview-tooltip';
            document.body.appendChild(previewTooltip);
        }
    
        // Create cards for each resource
        resources.forEach((resource, id) => {
            const card = document.createElement('sl-card');
            card.className = 'resource-item';
    
            // Create content based on view type
            const content = view === 'grid' ? `
                <img 
                    src="${resource.thumbnail}" 
                    alt="${resource.name}"
                    class="resource-thumbnail"
                />
                <div class="resource-info">
                    <div class="resource-name">${resource.name}</div>
                    <div class="resource-meta">${this.formatDate(resource.dateAdded)}</div>
                </div>
            ` : `
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <img 
                        src="${resource.thumbnail}" 
                        alt="${resource.name}"
                        class="resource-thumbnail"
                        style="width: 50px; height: 50px;"
                    />
                    <div class="resource-info">
                        <div class="resource-name">${resource.name}</div>
                        <div class="resource-meta">${this.formatDate(resource.dateAdded)}</div>
                    </div>
                </div>
            `;
    
            card.innerHTML = `
                ${content}
                <div slot="footer" class="resource-actions">
                    <sl-button-group>
                        <sl-button size="small" class="preview-btn">
                            <span class="material-icons">visibility</span>
                        </sl-button>
                        <sl-button size="small" class="delete-btn" variant="danger">
                            <span class="material-icons">delete</span>
                        </sl-button>
                    </sl-button-group>
                </div>
            `;
    
            // Add hover preview for list view
            if (view === 'list') {
                card.addEventListener('mouseenter', (e) => {
                    previewTooltip.innerHTML = `<img src="${resource.data}" alt="${resource.name}"/>`;
                    previewTooltip.style.display = 'block';
                    previewTooltip.style.left = `${e.pageX + 20}px`;
                    previewTooltip.style.top = `${e.pageY + 20}px`;
                });
    
                card.addEventListener('mousemove', (e) => {
                    previewTooltip.style.left = `${e.pageX + 20}px`;
                    previewTooltip.style.top = `${e.pageY + 20}px`;
                });
    
                card.addEventListener('mouseleave', () => {
                    previewTooltip.style.display = 'none';
                });
            }
    
            // Add existing event listeners
            card.querySelector('.preview-btn').addEventListener('click', () => {
                this.showResourcePreview(resource);
            });
    
            card.querySelector('.delete-btn').addEventListener('click', () => {
                this.deleteResource(category, id);
                this.updateGallery(drawer, category, view);
            });
    
            // Add drag and drop functionality
            card.draggable = true;
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    type: 'resource',
                    category,
                    id
                }));
            });
    
            container.appendChild(card);
        });
    }
    
    // Helper method for formatting dates
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }
    
    // Preview method
    showResourcePreview(resource) {
        const dialog = document.createElement('sl-dialog');
        dialog.label = resource.name;
        dialog.innerHTML = `
            <div style="text-align: center;">
                <img 
                    src="${resource.data}" 
                    alt="${resource.name}"
                    style="max-width: 100%; max-height: 70vh;"
                />
            </div>
        `;
        document.body.appendChild(dialog);
        dialog.show();
        
        dialog.addEventListener('sl-after-hide', () => dialog.remove());
    }
    
    // Delete method
    deleteResource(category, id) {
        const resources = this.resources.textures[category];
        if (resources) {
            resources.delete(id);
        }
    }

    createResourceManagerUI() {
        // Create the drawer
        const drawer = document.createElement('sl-drawer');
        drawer.label = "Resource Manager";
        drawer.placement = "end";
        drawer.classList.add("resource-manager-drawer");
        
        // Add embedded styles
        const styles = document.createElement('style');
        styles.textContent = `
            .resource-manager-drawer::part(panel) {
                width: 50vw;
                max-width: 800px;
            }
    
            .resource-categories {
                margin-bottom: 1rem;
            }
    
            .gallery-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 1rem;
                padding: 1rem;
            }
    
            .resource-item {
                border: 1px solid var(--sl-color-neutral-200);
                border-radius: var(--sl-border-radius-medium);
                padding: 0.5rem;
                transition: all 0.2s ease;
            }
    
            .resource-item:hover {
                border-color: var(--sl-color-primary-500);
                transform: translateY(-2px);
            }
    
            .resource-thumbnail {
                width: 100%;
                aspect-ratio: 1;
                object-fit: cover;
                border-radius: var(--sl-border-radius-small);
                margin-bottom: 0.5rem;
            }
    
            .resource-info {
                font-size: var(--sl-font-size-small);
            }

                .view-controls {
        margin: 1rem 0;
        display: flex;
        justify-content: flex-end;
    }

    .gallery-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 1rem;
        padding: 1rem;
    }

    .gallery-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 1rem;
    }

    .gallery-list .resource-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.5rem;
    }

    .gallery-list .resource-thumbnail {
        width: 50px;
        height: 50px;
    }

    .resource-preview-tooltip {
        position: fixed;
        z-index: 10000;
        background: white;
        padding: 4px;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        pointer-events: none;
        display: none;
    }

    .resource-preview-tooltip img {
        max-width: 200px;
        max-height: 200px;
        object-fit: contain;
    }
        `;
    
        drawer.innerHTML = `
        ${styles.outerHTML}
        <div class="resource-manager-content">
            <!-- Tab group for categories -->
            <sl-tab-group>
                <sl-tab slot="nav" panel="textures">
                    <span class="material-icons">image</span>
                    Textures
                </sl-tab>
                <sl-tab slot="nav" panel="sounds">
                    <span class="material-icons">volume_up</span>
                    Sounds
                </sl-tab>
                <sl-tab slot="nav" panel="splashArt">
                    <span class="material-icons">photo_library</span>
                    Splash Art
                </sl-tab>
    
                <!-- Texture Panel -->
                <sl-tab-panel name="textures">
                    <sl-button-group class="texture-categories">
                        <sl-button size="small" data-category="walls">Walls</sl-button>
                        <sl-button size="small" data-category="doors">Doors</sl-button>
                        <sl-button size="small" data-category="floors">Floors</sl-button>
                        <sl-button size="small" data-category="props">Props</sl-button>
                    </sl-button-group>
                    
                    <!-- Upload Area -->
                    <sl-card class="upload-area">
                        <sl-button variant="primary">
                            <span class="material-icons" slot="prefix">upload</span>
                            Add Textures
                        </sl-button>
                        <input type="file" hidden accept="image/*" multiple>
                    </sl-card>
    
    <div class="view-controls">
        <sl-button-group>
            <sl-button size="small" class="view-toggle" data-view="grid">
                <span class="material-icons">grid_view</span>
            </sl-button>
            <sl-button size="small" class="view-toggle" data-view="list">
                <span class="material-icons">view_list</span>
            </sl-button>
        </sl-button-group>
    </div>

                    <!-- Gallery Grid -->
                    <div class="gallery-grid" id="textureGallery"></div>
                </sl-tab-panel>
    
                <!-- Sounds Panel -->
                <sl-tab-panel name="sounds">
                    <sl-button-group class="sound-categories">
                        <sl-button size="small" data-category="ambient">Ambient</sl-button>
                        <sl-button size="small" data-category="effects">Effects</sl-button>
                    </sl-button-group>
                    <div class="gallery-grid" id="soundGallery"></div>
                </sl-tab-panel>
    
                <!-- Splash Art Panel -->
                <sl-tab-panel name="splashArt">
                    <div class="gallery-grid" id="splashArtGallery"></div>
                </sl-tab-panel>
            </sl-tab-group>
        </div>
    
        <!-- Footer Actions -->
        <div slot="footer">
            <sl-button-group>
                <sl-button variant="primary" id="saveResourcePack">
                    <span class="material-icons" slot="prefix">save</span>
                    Save Resource Pack
                </sl-button>
                <sl-button variant="default" id="loadResourcePack">
                    <span class="material-icons" slot="prefix">folder_open</span>
                    Load Resource Pack
                </sl-button>
            </sl-button-group>
        </div>
    `;

            // Add pack selector to drawer header
    const packSelector = document.createElement('sl-select');
    packSelector.label = 'Resource Pack';
    
    this.loadedPacks.forEach((pack, id) => {
        const option = document.createElement('sl-option');
        option.value = id;
        option.textContent = pack.name;
        packSelector.appendChild(option);
    });

    packSelector.value = this.activePackId;
    packSelector.addEventListener('sl-change', (e) => {
        this.switchResourcePack(e.target.value);
    });

    // Add "Import Pack" button
    const importBtn = document.createElement('sl-button');
    importBtn.innerHTML = `
        <sl-icon slot="prefix" name="plus-circle"></sl-icon>
        Import Pack
    `;
    importBtn.addEventListener('click', () => {
        // Show pack import dialog
        this.showPackImportDialog();
    });
    
        // Add event handlers
        this.setupEventHandlers(drawer);
    
        document.body.appendChild(drawer);
        return drawer;
    }

    setupEventHandlers(drawer) {
        // Handle texture upload
        const uploadBtn = drawer.querySelector('.upload-area sl-button');
        const fileInput = drawer.querySelector('.upload-area input[type="file"]');
        
        uploadBtn.addEventListener('click', () => {
            fileInput.click();
        });
    
        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            const category = drawer.querySelector('.texture-categories sl-button[variant="primary"]')
                ?.dataset.category || 'walls';
    
            for (const file of files) {
                await this.addTexture(file, category);
            }
            
            // Refresh gallery
            this.updateGallery(drawer, category);
        });
    
        // Handle category selection
        const categoryBtns = drawer.querySelectorAll('.texture-categories sl-button');
        categoryBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Update button states
                categoryBtns.forEach(b => b.setAttribute('variant', 'default'));
                btn.setAttribute('variant', 'primary');
                
                // Update gallery
                this.updateGallery(drawer, btn.dataset.category);
            });
        });
    
        // Handle save/load resource pack
        drawer.querySelector('#saveResourcePack').addEventListener('click', () => {
            this.saveResourcePack();
        });
    
        drawer.querySelector('#loadResourcePack').addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.loadResourcePack(file);
                }
            };
            input.click();
        });
    
        // Add close handler
        drawer.addEventListener('sl-after-hide', () => {
            // Optional: Clean up any resources if needed
        });
    }






}
