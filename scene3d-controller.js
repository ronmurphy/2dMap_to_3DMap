/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
// // Import Three.js and required components
// import * as THREE from 'three';
// import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
// import { CSG } from './three-csg.js';  // Local import for CSG

class Token {
    constructor(x, y, size, image, type = "monster") {
      this.x = x;
      this.y = y;
      this.size = size || 1;
      this.image = image;
      this.type = type;
      this.height = 2; // Height above ground
    }
  }

class Scene3DController {
    constructor(mapEditor) {
        this.mapEditor = mapEditor;
        this.wallTexture = null;
        this.roomTexture = null;
        this.boxWidth = 0;
        this.boxDepth = 0;
        this.boxHeight = 4; // Default wall height
        this.tokens = new Map();  // Store token meshes by ID
        this.tokenHeight = 2;     // Default height for tokens
                this.clear();
    }

    clear() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.animationFrameId = null;
        this.isActive = false;
        this.keyHandlers = {
            keydown: null,
            keyup: null
        };
        this.keys = {};
        this.moveState = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            speed: 0.025,
            sprint: false,
            mouseRightDown: false,
            shiftHeld: false
        };
    }

    initialize(container, width, height) {

        window.Vector3 = THREE.Vector3;
window.Vector2 = THREE.Vector2;
window.Face3 = THREE.Face3;
window.Geometry = THREE.Geometry;
window.Mesh = THREE.Mesh;

        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x222222);

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.camera.position.set(0, 1.7, 0);  // Eye level

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
        container.appendChild(this.renderer.domElement);

            // Initialize textures if mapEditor is available
    if (this.mapEditor && this.mapEditor.baseImage) {
        this.initializeTextures();
    }

        // Controls
        this.setupControls(container);
        
        // Lighting
        this.setupLighting();

        this.isActive = true;
        this.startRenderLoop();
    }

    createTextureFromRoom(textureRoom) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = textureRoom.bounds.width;
        canvas.height = textureRoom.bounds.height;
    
        // Draw the portion of the map that contains the texture
        ctx.drawImage(
            this.mapEditor.baseImage,
            textureRoom.bounds.x,
            textureRoom.bounds.y,
            textureRoom.bounds.width,
            textureRoom.bounds.height,
            0, 0,
            canvas.width,
            canvas.height
        );
    
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
    
        // Calculate repeats based on grid cell size
        const horizontalRepeats = Math.round(textureRoom.bounds.width / this.mapEditor.cellSize);
        const verticalRepeats = Math.round(textureRoom.bounds.height / this.mapEditor.cellSize);
    
        texture.repeat.set(horizontalRepeats, verticalRepeats);
        texture.needsUpdate = true;
    
        return texture;
    }

    // Add texture repeat handling in material creation
createMaterial(isWall, room) {
    if (isWall) {
        const material = new THREE.MeshStandardMaterial({
            color: this.wallTexture ? 0xffffff : 0x505050,
            map: this.wallTexture,
            roughness: 0.8,
            metalness: 0.1,
            transparent: false,
            opacity: 1.0,
            side: THREE.DoubleSide,
            depthWrite: true,
            clipIntersection: true,
            clipShadows: true
        });

        if (this.wallTexture) {
            // Calculate proper texture repeats
            const heightRatio = 1.0;
            const scaleU = room.bounds.width / this.mapEditor.cellSize;
            const scaleV = heightRatio * (this.boxHeight / this.mapEditor.cellSize);
            material.map.repeat.set(scaleU, scaleV);
        }

        return material;
    } else {
        const material = new THREE.MeshStandardMaterial({
            color: this.roomTexture ? 0xffffff : 0x808080,
            map: this.roomTexture,
            roughness: 0.7,
            transparent: false,
            opacity: 1.0,
            side: THREE.DoubleSide
        });

        if (this.roomTexture) {
            // Set room texture repeats
            const scaleU = room.bounds.width / this.mapEditor.cellSize;
            const scaleV = room.bounds.height / this.mapEditor.cellSize;
            material.map.repeat.set(scaleU, scaleV);
        }

        return material;
    }
}
    
    initializeTextures() {
        // Find texture rooms
        const wallTextureRoom = this.mapEditor.rooms.find(room => room.name === "WallTexture");
        const roomTextureRoom = this.mapEditor.rooms.find(room => room.name === "RoomTexture");
    
        if (wallTextureRoom) {
            this.wallTexture = this.createTextureFromRoom(wallTextureRoom);
            console.log("Wall texture created with repeats:", this.wallTexture.repeat);
        }
    
        if (roomTextureRoom) {
            this.roomTexture = this.createTextureFromRoom(roomTextureRoom);
            console.log("Room texture created with repeats:", this.roomTexture.repeat);
        }
    }

    setTextures(wallTextureRoom, roomTextureRoom) {
        if (wallTextureRoom) {
            const wallCanvas = document.createElement('canvas');
            wallCanvas.width = wallTextureRoom.bounds.width;
            wallCanvas.height = wallTextureRoom.bounds.height;
            const wallCtx = wallCanvas.getContext('2d');
            wallCtx.drawImage(
                this.mapEditor.baseImage,
                wallTextureRoom.bounds.x,
                wallTextureRoom.bounds.y,
                wallTextureRoom.bounds.width,
                wallTextureRoom.bounds.height,
                0, 0,
                wallCanvas.width,
                wallCanvas.height
            );
            this.wallTexture = new THREE.CanvasTexture(wallCanvas);
            this.wallTexture.wrapS = THREE.RepeatWrapping;
            this.wallTexture.wrapT = THREE.RepeatWrapping;
        }

        if (roomTextureRoom) {
            const roomCanvas = document.createElement('canvas');
            roomCanvas.width = roomTextureRoom.bounds.width;
            roomCanvas.height = roomTextureRoom.bounds.height;
            const roomCtx = roomCanvas.getContext('2d');
            roomCtx.drawImage(
                this.mapEditor.baseImage,
                roomTextureRoom.bounds.x,
                roomTextureRoom.bounds.y,
                roomTextureRoom.bounds.width,
                roomTextureRoom.bounds.height,
                0, 0,
                roomCanvas.width,
                roomCanvas.height
            );
            this.roomTexture = new THREE.CanvasTexture(roomCanvas);
            this.roomTexture.wrapS = THREE.RepeatWrapping;
            this.roomTexture.wrapT = THREE.RepeatWrapping;
        }
    }


    setupControls(container) {
        this.controls = new THREE.PointerLockControls(this.camera, container);

        // Mouse handlers
        container.addEventListener("contextmenu", (e) => e.preventDefault());
        
        container.addEventListener("mousedown", (e) => {
            if (e.button === 2) {
                this.moveState.mouseRightDown = true;
                this.moveState.sprint = true;
                this.moveState.speed = 0.05;
            }
        });

        container.addEventListener("mouseup", (e) => {
            if (e.button === 2) {
                this.moveState.mouseRightDown = false;
                if (!this.moveState.shiftHeld) {
                    this.moveState.sprint = false;
                    this.moveState.speed = 0.025;
                }
            }
        });

        // Key handlers
        this.keyHandlers.keydown = this.handleKeyDown.bind(this);
        this.keyHandlers.keyup = this.handleKeyUp.bind(this);
        
        document.addEventListener("keydown", this.keyHandlers.keydown);
        document.addEventListener("keyup", this.keyHandlers.keyup);

        // Lock/unlock controls
        container.addEventListener("click", () => this.controls.lock());
        
        this.controls.addEventListener("lock", () => {
            container.style.cursor = "none";
        });

        this.controls.addEventListener("unlock", () => {
            container.style.cursor = "auto";
        });
    }

    handleKeyDown(event) {
        switch (event.code) {
            case "ArrowUp":
            case "KeyW":
                this.moveState.forward = true;
                break;
            case "ArrowDown":
            case "KeyS":
                this.moveState.backward = true;
                break;
            case "ArrowLeft":
            case "KeyA":
                this.moveState.left = true;
                break;
            case "ArrowRight":
            case "KeyD":
                this.moveState.right = true;
                break;
            case "ShiftLeft":
                this.moveState.shiftHeld = true;
                this.moveState.sprint = true;
                this.moveState.speed = 0.05;
                break;
        }
    }

    handleKeyUp(event) {
        switch (event.code) {
            case "ArrowUp":
            case "KeyW":
                this.moveState.forward = false;
                break;
            case "ArrowDown":
            case "KeyS":
                this.moveState.backward = false;
                break;
            case "ArrowLeft":
            case "KeyA":
                this.moveState.left = false;
                break;
            case "ArrowRight":
            case "KeyD":
                this.moveState.right = false;
                break;
            case "ShiftLeft":
                this.moveState.shiftHeld = false;
                if (!this.moveState.mouseRightDown) {
                    this.moveState.sprint = false;
                    this.moveState.speed = 0.025;
                }
                break;
        }
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
    }

    startRenderLoop() {
        const animate = () => {
            if (!this.isActive) return;

            this.animationFrameId = requestAnimationFrame(animate);
            this.update();
            this.renderer.render(this.scene, this.camera);
        };

        animate();
    }

    update() {
        if (this.moveState.forward) this.controls.moveForward(this.moveState.speed);
        if (this.moveState.backward) this.controls.moveForward(-this.moveState.speed);
        if (this.moveState.left) this.controls.moveRight(-this.moveState.speed);
        if (this.moveState.right) this.controls.moveRight(this.moveState.speed);

        // Keep player at eye level
        this.camera.position.y = 1.7;
    }

    cleanup() {
        this.isActive = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement?.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }
        if (this.controls) {
            this.controls.dispose();
        }
        if (this.keyHandlers.keydown) {
            document.removeEventListener("keydown", this.keyHandlers.keydown);
        }
        if (this.keyHandlers.keyup) {
            document.removeEventListener("keyup", this.keyHandlers.keyup);
        }
        this.clear();
    }

    // Add these methods to Scene3DController
    createRoomGeometry(room) {
        let positions = [];
        let normals = [];
        let uvs = [];
        let indices = [];
    
        const isWall = room.type === "wall";
        
        // Box dimensions
        const x1 = room.bounds.x / 50 - this.boxWidth / 2;
        const x2 = x1 + room.bounds.width / 50;
        const z1 = room.bounds.y / 50 - this.boxDepth / 2;
        const z2 = z1 + room.bounds.height / 50;
    
        // Create geometry based on shape
        switch(room.shape) {
            case "circle": {
                // Pass null for material initially
                this.createCircleGeometry(room, positions, normals, uvs, indices, null);
                break;
            }
            case "polygon": {
                // Pass null for material initially
                this.createPolygonGeometry(room, positions, normals, uvs, indices, null);
                break;
            }
            default: {
                // Pass null for material initially
                this.createBoxGeometry(room, x1, x2, z1, z2, this.boxHeight, positions, normals, uvs, indices, null);
            }
        }
    
        // Create final geometry
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
    
        // Create material after geometry is created
        const material = this.createMaterial(isWall, room);
    
        const mesh = new THREE.Mesh(geometry, material);
    
        // Handle doors if this is a wall
        if (isWall) {
            const doors = this.mapEditor.markers.filter(marker => 
                marker.type === 'door' && 
                marker.data.parentWall && 
                marker.data.parentWall.id === room.id
            );
    
            if (doors.length > 0) {
                return this.addDoorsToWall(mesh, doors);
            }
        }
    
        return mesh;
    }

createBoxGeometry(room, x1, x2, z1, z2, height, positions, normals, uvs, indices, material) {
    const textureRepeatsU = material?.map?.repeat.x || 1;
    const textureRepeatsV = material?.map?.repeat.y || 1;

    // Add vertices
    positions.push(
        // Bottom face
        x1, 0, z1,  x2, 0, z1,  x2, 0, z2,  x1, 0, z2,
        // Top face
        x1, height, z1,  x2, height, z1,  x2, height, z2,  x1, height, z2,
        // Front face
        x1, 0, z1,  x2, 0, z1,  x2, height, z1,  x1, height, z1,
        // Back face
        x1, 0, z2,  x2, 0, z2,  x2, height, z2,  x1, height, z2,
        // Left face
        x1, 0, z1,  x1, 0, z2,  x1, height, z2,  x1, height, z1,
        // Right face
        x2, 0, z1,  x2, 0, z2,  x2, height, z2,  x2, height, z1
    );

    // Add normals
    for (let i = 0; i < 4; i++) normals.push(0, -1, 0);  // Bottom
    for (let i = 0; i < 4; i++) normals.push(0, 1, 0);   // Top
    for (let i = 0; i < 4; i++) normals.push(0, 0, -1);  // Front
    for (let i = 0; i < 4; i++) normals.push(0, 0, 1);   // Back
    for (let i = 0; i < 4; i++) normals.push(-1, 0, 0);  // Left
    for (let i = 0; i < 4; i++) normals.push(1, 0, 0);   // Right

    // Add UVs with proper texture repeats
    for (let face = 0; face < 6; face++) {
        if (face < 2) { // Top and bottom faces
            uvs.push(
                0, 0,
                textureRepeatsU, 0,
                textureRepeatsU, textureRepeatsU,
                0, textureRepeatsU
            );
        } else { // Side faces
            uvs.push(
                0, 0,
                textureRepeatsU, 0,
                textureRepeatsU, textureRepeatsV,
                0, textureRepeatsV
            );
        }
    }

    // Add indices
    for (let face = 0; face < 6; face++) {
        const base = face * 4;
        indices.push(
            base, base + 1, base + 2,
            base, base + 2, base + 3
        );
    }
}

createCircleGeometry(room, positions, normals, uvs, indices, material) {
    const segments = 32;
    const radius = Math.max(room.bounds.width, room.bounds.height) / 100;
    // Safe access to texture repeats with nullish coalescing
    const textureRepeatsU = material?.map?.repeat?.x ?? 1;
    const textureRepeatsV = material?.map?.repeat?.y ?? 1;
    
    // Calculate grid-aligned position
    const gridX = room.bounds.x / 50 - this.boxWidth / 2;
    const gridZ = room.bounds.y / 50 - this.boxDepth / 2;

    // Create cylinder vertices
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const x = Math.cos(theta);
        const z = Math.sin(theta);

        // Bottom vertices
        positions.push(
            gridX + radius * x,
            0,
            gridZ + radius * z
        );
        normals.push(x, 0, z);
        uvs.push(i / segments * textureRepeatsU, 0);

        // Top vertices
        positions.push(
            gridX + radius * x,
            this.boxHeight,
            gridZ + radius * z
        );
        normals.push(x, 0, z);
        uvs.push(i / segments * textureRepeatsU, textureRepeatsV);
    }

    // Create faces
    for (let i = 0; i < segments; i++) {
        const base = i * 2;
        indices.push(
            base, base + 1, base + 2,
            base + 1, base + 3, base + 2
        );
    }

    // Add caps if this is a wall
    if (room.type === "wall") {
        const centerBottom = positions.length / 3;
        const centerTop = centerBottom + 1;

        // Center points
        positions.push(gridX, 0, gridZ);      // Bottom center
        positions.push(gridX, this.boxHeight, gridZ);  // Top center
        normals.push(0, -1, 0, 0, 1, 0);      // Center normals
        uvs.push(0.5 * textureRepeatsU, 0.5 * textureRepeatsV, 
                0.5 * textureRepeatsU, 0.5 * textureRepeatsV);

        // Create cap triangles
        for (let i = 0; i < segments; i++) {
            const current = i * 2;
            const next = ((i + 1) % segments) * 2;
            
            // Bottom cap
            indices.push(centerBottom, current, next);
            // Top cap
            indices.push(centerTop, next + 1, current + 1);
        }
    }
}

createPolygonGeometry(room, positions, normals, uvs, indices, material) {
    if (!room.points || room.points.length < 3) return;

    const baseX = room.bounds.x / 50 - this.boxWidth / 2;
    const baseZ = room.bounds.y / 50 - this.boxDepth / 2;
    // Safe access to texture repeats with nullish coalescing
    const textureRepeatsU = material?.map?.repeat?.x ?? 1;
    const textureRepeatsV = material?.map?.repeat?.y ?? 1;

    // Create vertices for walls
    room.points.forEach((point, i) => {
        const nextPoint = room.points[(i + 1) % room.points.length];
        
        const x1 = point.x / 50 + baseX;
        const x2 = nextPoint.x / 50 + baseX;
        const z1 = point.y / 50 + baseZ;
        const z2 = nextPoint.y / 50 + baseZ;

        // Calculate segment length for UV scaling
        const dx = x2 - x1;
        const dz = z2 - z1;
        const segmentLength = Math.sqrt(dx * dx + dz * dz);
        const segmentUV = segmentLength / (room.bounds.width / 50) * textureRepeatsU;

        // Add vertices for this wall segment
        positions.push(
            x1, 0, z1,           // bottom left
            x2, 0, z2,           // bottom right
            x2, this.boxHeight, z2,  // top right
            x1, this.boxHeight, z1   // top left
        );

        // Calculate normal
        const nx = dz / segmentLength;
        const nz = -dx / segmentLength;
        for (let j = 0; j < 4; j++) {
            normals.push(nx, 0, nz);
        }

        // Add UVs
        uvs.push(
            0, 0,
            segmentUV, 0,
            segmentUV, textureRepeatsV,
            0, textureRepeatsV
        );

        // Add indices
        const base = positions.length / 3 - 4;
        indices.push(
            base, base + 1, base + 2,
            base, base + 2, base + 3
        );
    });

    // Add caps for walls
    if (room.type === "wall") {
        const points2D = room.points.map(p => new THREE.Vector2(p.x / 50, p.y / 50));
        const shape = new THREE.Shape(points2D);
        const geometry = new THREE.ShapeGeometry(shape);
        
        const capPositions = Array.from(geometry.attributes.position.array);
        const capIndices = Array.from(geometry.index.array);

        // Add bottom cap
        const bottomStart = positions.length / 3;
        for (let i = 0; i < capPositions.length; i += 2) {
            positions.push(
                capPositions[i] + baseX,
                0,
                capPositions[i + 1] + baseZ
            );
            normals.push(0, -1, 0);
            uvs.push(
                capPositions[i] / room.bounds.width * textureRepeatsU,
                capPositions[i + 1] / room.bounds.height * textureRepeatsV
            );
        }

        // Add top cap
        const topStart = positions.length / 3;
        for (let i = 0; i < capPositions.length; i += 2) {
            positions.push(
                capPositions[i] + baseX,
                this.boxHeight,
                capPositions[i + 1] + baseZ
            );
            normals.push(0, 1, 0);
            uvs.push(
                capPositions[i] / room.bounds.width * textureRepeatsU,
                capPositions[i + 1] / room.bounds.height * textureRepeatsV
            );
        }

        // Add cap indices
        for (let i = 0; i < capIndices.length; i += 3) {
            indices.push(
                bottomStart + capIndices[i + 2],
                bottomStart + capIndices[i + 1],
                bottomStart + capIndices[i]
            );
            indices.push(
                topStart + capIndices[i],
                topStart + capIndices[i + 1],
                topStart + capIndices[i + 2]
            );
        }
    }
}

addDoorsToWall(wallMesh, doors) {
    try {
        // Ensure wall geometry is ready for CSG
        wallMesh.updateMatrix();
        wallMesh.geometry.computeVertexNormals();
        wallMesh.geometry.computeBoundingSphere();

        // Process each door
        doors.forEach(doorMarker => {
            const doorWidth = this.mapEditor.cellSize / 50;
            const doorHeight = 2.1;  // Slightly taller than door frame
            const wallDepth = 0.3;   // Match wall thickness

            // Create door hole geometry
            const doorHoleGeometry = new THREE.BoxGeometry(
                doorWidth + 0.1,  // Slightly wider for clean cut
                doorHeight,
                wallDepth + 0.1   // Slightly deeper for clean cut
            );

            // Create and position door hole mesh
            const doorHole = new THREE.Mesh(doorHoleGeometry);
            doorHole.position.set(
                (doorMarker.data.door.position.x / 50) - (wallMesh.position.x || 0),
                doorHeight / 2,
                (doorMarker.data.door.position.y / 50) - (wallMesh.position.z || 0)
            );
            doorHole.updateMatrix();

            // Perform CSG subtraction
            const wallCSG = CSG.fromMesh(wallMesh);
            const holeCSG = CSG.fromMesh(doorHole);
            const resultCSG = wallCSG.subtract(holeCSG);

            // Convert back to mesh
            wallMesh = CSG.toMesh(resultCSG, wallMesh.matrix, wallMesh.material);

            // Add door frame
            const frame = this.createDoorFrame(doorMarker.data.door);
            wallMesh.add(frame);
        });

        return wallMesh;
    } catch (error) {
        console.error("Error in door creation:", error);
        return wallMesh;  // Return original wall if operation fails
    }
}

createDoorFrame(door) {
    const doorWidth = this.mapEditor.cellSize / 50;
    const doorHeight = 2.0;
    const frameThickness = 0.04;
    const frameDepth = 0.28;

    const frameGroup = new THREE.Group();
    const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a4a4a,
        metalness: 0.3,
        roughness: 0.7,
        side: THREE.DoubleSide,
        depthWrite: true
    });

    // Create frame pieces
    const pieces = [
        // Top
        { 
            size: [doorWidth + frameThickness*2, frameThickness, frameDepth],
            pos: [0, doorHeight, 0]
        },
        // Bottom
        {
            size: [doorWidth + frameThickness*2, frameThickness, frameDepth],
            pos: [0, 0, 0]
        },
        // Left
        {
            size: [frameThickness, doorHeight, frameDepth],
            pos: [-doorWidth/2 - frameThickness/2, doorHeight/2, 0]
        },
        // Right
        {
            size: [frameThickness, doorHeight, frameDepth],
            pos: [doorWidth/2 + frameThickness/2, doorHeight/2, 0]
        }
    ];

    pieces.forEach(piece => {
        const geometry = new THREE.BoxGeometry(...piece.size);
        const mesh = new THREE.Mesh(geometry, frameMaterial);
        mesh.position.set(...piece.pos);
        frameGroup.add(mesh);
    });

    // Position frame
    frameGroup.position.set(
        door.position.x / 50 - this.boxWidth/2,
        0,
        door.position.y / 50 - this.boxDepth/2
    );

    return frameGroup;
}

initializeMap(mapEditor) {
    // Set dimensions based on map
    this.boxWidth = mapEditor.baseImage.width / 50;
    this.boxDepth = mapEditor.baseImage.height / 50;

    // Find texture rooms
    const wallTextureRoom = mapEditor.rooms.find(r => r.name === "WallTexture");
    const roomTextureRoom = mapEditor.rooms.find(r => r.name === "RoomTexture");

    // Set up textures
    this.setTextures(wallTextureRoom, roomTextureRoom);

    // Create floor
    this.createFloor(mapEditor.baseImage);

    // Create rooms and walls
    mapEditor.rooms.forEach(room => {
        if (room.name !== "WallTexture" && room.name !== "RoomTexture") {
            const mesh = this.createRoomGeometry(room);
            if (mesh) {
                this.scene.add(mesh);
            }
        }
    });
}

createFloor(baseImage) {
    const floorGeometry = new THREE.PlaneGeometry(this.boxWidth, this.boxDepth);
    const floorTexture = new THREE.CanvasTexture(baseImage);
    const floorMaterial = new THREE.MeshStandardMaterial({
        map: floorTexture,
        side: THREE.DoubleSide
    });

    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;  // Slightly above ground to prevent z-fighting
    this.scene.add(floor);
}

getMonsterSizeInSquares(size) {
    // Add debug logging
    console.log("Getting monster size for:", size);

    // Handle undefined/null size
    if (!size) {
      console.log("Size undefined, defaulting to medium");
      return 1; // Default to medium size
    }

    const sizeMap = {
      tiny: 0.5, // 2.5ft
      small: 1, // 5ft
      medium: 1, // 5ft
      large: 2, // 10ft (2x2)
      huge: 3, // 15ft (3x3)
      gargantuan: 4, // 20ft (4x4)
    };

    const calculatedSize = sizeMap[size.toLowerCase()] || 1;
    console.log("Calculated size:", calculatedSize);
    return calculatedSize;
  }

getMonsterTokenData(marker) {
    console.log("Processing marker:", marker);

    if (!marker || !marker.data || !marker.data.monster) {
      console.log("Invalid marker data");
      return null;
    }

    // Get correct token image source
    const tokenSource =
      marker.data.monster.token.data || marker.data.monster.token.url;
    console.log("Token image source:", tokenSource);

    const monsterSize = this.getMonsterSizeInSquares(
      marker.data.monster.basic.size || "medium"
    );

    const tokenData = {
      x: marker.x,
      y: marker.y,
      size: monsterSize,
      image: tokenSource,
      type: "monster",
      name: marker.data.monster.name || "Unknown Monster",
      height: 2 * monsterSize,
    };

    console.log("Created token data:", tokenData);
    return tokenData;
  }


createToken(tokenData) {
    const { x, y, size, image, type } = tokenData;
    
    // Create sprite material from token image
    const spriteMaterial = new THREE.SpriteMaterial({
        map: this.loadTokenTexture(image),
        transparent: true,
        depthWrite: false,
        sizeAttenuation: true
    });

    const sprite = new THREE.Sprite(spriteMaterial);
    
    // Scale based on token size
    const scale = size * (this.mapEditor.cellSize / 25);
    const aspectRatio = spriteMaterial.map.image.width / spriteMaterial.map.image.height;
    sprite.scale.set(scale * aspectRatio, scale, 1);

    // Position token
    const x3D = x / 50 - this.boxWidth / 2;
    const z3D = y / 50 - this.boxDepth / 2;
    const y3D = type === 'monster' ? this.tokenHeight * size : this.tokenHeight;
    sprite.position.set(x3D, y3D, z3D);

    // Add collision box for monsters
    if (type === 'monster') {
        const boxGeometry = new THREE.BoxGeometry(
            size * (this.mapEditor.cellSize / 25),
            0.1,
            size * (this.mapEditor.cellSize / 25)
        );
        const boxMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.2,
            visible: false  // Hide by default
        });
        const collisionBox = new THREE.Mesh(boxGeometry, boxMaterial);
        collisionBox.position.set(x3D, 0.05, z3D);
        this.scene.add(collisionBox);
    }

    this.scene.add(sprite);
    this.tokens.set(tokenData.id, sprite);
    
    return sprite;
}

loadTokenTexture(imageUrl) {
    return new Promise((resolve, reject) => {
        const loader = new THREE.TextureLoader();
        loader.load(
            imageUrl,
            texture => resolve(texture),
            undefined,
            error => {
                console.error('Error loading token texture:', error);
                reject(error);
            }
        );
    });
}

updateTokenPosition(tokenId, x, y) {
    const token = this.tokens.get(tokenId);
    if (token) {
        token.position.x = x / 50 - this.boxWidth / 2;
        token.position.z = y / 50 - this.boxDepth / 2;
    }
}

removeToken(tokenId) {
    const token = this.tokens.get(tokenId);
    if (token) {
        this.scene.remove(token);
        this.tokens.delete(tokenId);
    }
}

setPlayerStartPosition(x, y) {
    this.camera.position.set(
        x / 50 - this.boxWidth / 2,
        1.7,  // Eye level
        y / 50 - this.boxDepth / 2
    );
}

// View/camera adjustments
setCameraPosition(x, y, z) {
    this.camera.position.set(x, y, z);
}

lookAt(x, y, z) {
    this.camera.lookAt(x, y, z);
}

resetView() {
    this.camera.position.set(0, 1.7, 5);
    this.camera.lookAt(0, 1.7, 0);
}

// Special effects
setFog(color = 0x000000, near = 1, far = 1000) {
    this.scene.fog = new THREE.Fog(color, near, far);
}

toggleWireframe(enabled) {
    this.scene.traverse(object => {
        if (object.isMesh) {
            object.material.wireframe = enabled;
        }
    });
}

// For the player version
loadFromJSON(jsonData) {
    // Clear existing scene
    this.cleanup();
    
    // Initialize new scene
    this.initialize(this.renderer.domElement.parentElement, 
                   this.renderer.domElement.width,
                   this.renderer.domElement.height);

    // Parse and load map data
    const mapData = JSON.parse(jsonData);
    
    // Set dimensions
    this.boxWidth = mapData.gridSettings.width;
    this.boxDepth = mapData.gridSettings.height;
    
    // Create rooms and walls
    mapData.rooms.forEach(roomData => {
        if (roomData.name !== "WallTexture" && roomData.name !== "RoomTexture") {
            const mesh = this.createRoomGeometry(roomData);
            if (mesh) this.scene.add(mesh);
        }
    });

    // Create floor from saved image
    if (mapData.mapImage) {
        const image = new Image();
        image.src = mapData.mapImage;
        image.onload = () => this.createFloor(image);
    }

    // Set player start position if available
    if (mapData.playerStart) {
        this.setPlayerStartPosition(mapData.playerStart.x, mapData.playerStart.y);
    }

    // Load markers/tokens
    if (mapData.markers) {
        mapData.markers.forEach(markerData => {
            if (markerData.type === 'encounter' && markerData.data.monster) {
                this.createToken(markerData.data.monster);
            }
        });
    }
}

setupDrawer() {
    const drawer = document.createElement("sl-drawer");
    drawer.label = "3D View";
    drawer.placement = "end";
    drawer.classList.add("drawer-3d-view");
    // Use CSS custom property for width
    drawer.style.setProperty("--size", "85vw");

    // Container for Three.js
    const container = document.createElement("div");
    container.style.width = "100%";
    container.style.height = "100%";
    drawer.appendChild(container);

    // Progress indicator
    const progress = document.createElement("sl-progress-bar");
    progress.style.display = "none";
    drawer.appendChild(progress);

    document.body.appendChild(drawer);
    return { drawer, container, progress };
  }

}
