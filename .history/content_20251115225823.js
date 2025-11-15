// Content script to inject witch into web pages
console.log('Little Witch Alcove: Content script loaded!');

let witchElement = null;
let witchBodyImg = null;
let witchHeadImg = null;
let witchEnabled = false;
let selectedHat = 1;
let selectedRobe = 1;
let currentState = 'Idle'; // 'Idle', 'Flying', 'Walk 1', 'Walk 2'
let currentDirection = 'Right'; // 'Left' or 'Right'
let walkFrame = 1; // For alternating walk frames

// Load saved state and create witch if enabled
function initWitch() {
  // Skip iframes
  if (window.self !== window.top) {
    console.log('Little Witch Alcove: Skipping iframe');
    return;
  }
  
  console.log('Little Witch Alcove: Checking storage for witchEnabled...');
  chrome.storage.local.get(['witchEnabled'], function(result) {
    witchEnabled = result.witchEnabled || false;
    console.log('Little Witch Alcove: Initializing, witchEnabled =', witchEnabled);
    console.log('Little Witch Alcove: Storage result:', result);
    if (witchEnabled) {
      // Wait a bit for page to be ready
      setTimeout(() => {
        console.log('Little Witch Alcove: Creating witch...');
        createWitch();
      }, 100);
    } else {
      console.log('Little Witch Alcove: Witch is disabled, not creating');
    }
  });
}

// Productivity warning banner
let warningBanner = null;

function createWarningBanner(reason) {
  // Wait for body to be available
  if (!document.body) {
    setTimeout(() => createWarningBanner(reason), 100);
    return;
  }

  // Remove existing banner if present
  if (warningBanner) {
    warningBanner.remove();
  }

  warningBanner = document.createElement('div');
  warningBanner.id = 'lwa-productivity-warning';
  warningBanner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
    color: white;
    padding: 12px 20px;
    text-align: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 999999;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    animation: slideDown 0.3s ease-out;
  `;

  const warningIcon = document.createElement('span');
  warningIcon.textContent = '⚠️';
  warningIcon.style.fontSize = '18px';

  const warningText = document.createElement('span');
  warningText.textContent = `Unproductive tab detected: ${reason}`;
  warningText.style.flex = '1';

  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.style.cssText = `
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    font-size: 20px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  `;
  closeButton.onmouseover = () => closeButton.style.background = 'rgba(255, 255, 255, 0.3)';
  closeButton.onmouseout = () => closeButton.style.background = 'rgba(255, 255, 255, 0.2)';
  closeButton.onclick = () => {
    if (warningBanner) {
      warningBanner.style.animation = 'slideUp 0.3s ease-out';
      setTimeout(() => {
        if (warningBanner) {
          warningBanner.remove();
          warningBanner = null;
        }
      }, 300);
    }
  };

  warningBanner.appendChild(warningIcon);
  warningBanner.appendChild(warningText);
  warningBanner.appendChild(closeButton);

  // Add animation styles
  if (!document.getElementById('lwa-warning-styles')) {
    const style = document.createElement('style');
    style.id = 'lwa-warning-styles';
    style.textContent = `
      @keyframes slideDown {
        from {
          transform: translateY(-100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      @keyframes slideUp {
        from {
          transform: translateY(0);
          opacity: 1;
        }
        to {
          transform: translateY(-100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(warningBanner);
}

function hideWarningBanner() {
  if (warningBanner) {
    warningBanner.style.animation = 'slideUp 0.3s ease-out';
    setTimeout(() => {
      if (warningBanner) {
        warningBanner.remove();
        warningBanner = null;
      }
    }, 300);
  }
}

// Listen for messages from popup and background
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Little Witch Alcove: Received message:', request);
  if (request.action === 'showWitch') {
    witchEnabled = true;
    console.log('Little Witch Alcove: Show witch requested');
    if (!witchElement) {
      console.log('Little Witch Alcove: Creating new witch element');
      createWitch();
    } else {
      console.log('Little Witch Alcove: Showing existing witch element');
      witchElement.style.display = 'block';
    }
    sendResponse({ success: true });
  } else if (request.action === 'hideWitch') {
    witchEnabled = false;
    console.log('Little Witch Alcove: Hide witch requested');
    if (witchElement) {
      witchElement.style.display = 'none';
    }
    sendResponse({ success: true });
  } else if (request.action === 'showProductivityWarning') {
    createWarningBanner(request.reason || 'This tab may not be productive for focused work');
    sendResponse({ success: true });
  } else if (request.action === 'hideProductivityWarning') {
    hideWarningBanner();
    sendResponse({ success: true });
  } else if (request.action === 'updateCustomization') {
    // Update witch appearance with new customization
    if (witchElement) {
      updateWitchAppearance(request.hat || 1, request.robe || 1);
    }
    sendResponse({ success: true });
  }
  return true; // Keep message channel open for async response
});

// Helper function to safely get extension URL
function getExtensionURL(path) {
  try {
    if (chrome && chrome.runtime && chrome.runtime.getURL) {
      return chrome.runtime.getURL(path);
    }
  } catch (e) {
    console.error('Little Witch Alcove: Extension context invalidated');
  }
  return null;
}

// Get SVG path based on state, direction, and customization
function getWitchSVGPath(state, direction, type, number) {
  // type: 'Body' or 'Head'
  // number: 1-5 (from hat/robe selection)
  const folder = state === 'Flying' ? 'Flying' : state;
  const dir = direction === 'Left' ? 'Left' : '';
  const fileName = `${state} ${type} ${number}.svg`;
  return `Assets/Witch/${folder}/${fileName}`;
}

// Update witch appearance with new customization
function updateWitchAppearance(hat, robe) {
  selectedHat = hat;
  selectedRobe = robe;
  updateWitchImages();
}

// Update witch images based on current state, direction, and customization
function updateWitchImages() {
  if (!witchBodyImg || !witchHeadImg) return;
  
  const bodyPath = getWitchSVGPath(currentState, currentDirection, 'Body', selectedRobe);
  const headPath = getWitchSVGPath(currentState, currentDirection, 'Head', selectedHat);
  
  const bodyUrl = getExtensionURL(bodyPath);
  const headUrl = getExtensionURL(headPath);
  
  if (bodyUrl) witchBodyImg.src = bodyUrl;
  if (headUrl) witchHeadImg.src = headUrl;
}

function createWitch() {
  // Wait for body to be available
  if (!document.body) {
    setTimeout(createWitch, 100);
    return;
  }

  // Load customization from storage
  chrome.storage.local.get(['selectedHat', 'selectedRobe'], function(result) {
    selectedHat = result.selectedHat || 1;
    selectedRobe = result.selectedRobe || 1;
    
    // Remove existing witch if any
    if (witchElement && witchElement.parentNode) {
      witchElement.remove();
    }

    // Create witch container
    witchElement = document.createElement('div');
    witchElement.id = 'little-witch-alcove-witch';
    
    // Calculate initial position (center, above floor so she falls)
    const initialX = (window.innerWidth / 2) - 35; // 35 is half of 70px width
    const initialY = 100; // Start higher up so she falls
    
    witchElement.style.cssText = `
      position: fixed;
      left: ${initialX}px;
      top: ${initialY}px;
      z-index: 999999;
      cursor: grab;
      user-select: none;
      width: 70px;
      height: auto;
    `;
    
    // Create body image (bottom layer)
    witchBodyImg = document.createElement('img');
    witchBodyImg.id = 'witch-body';
    witchBodyImg.style.cssText = `
      width: 70px;
      height: auto;
      display: block;
      pointer-events: none;
      position: relative;
    `;
    witchBodyImg.alt = 'Witch Body';
    
    // Create head image (top layer, overlays body)
    witchHeadImg = document.createElement('img');
    witchHeadImg.id = 'witch-head';
    witchHeadImg.style.cssText = `
      width: 70px;
      height: auto;
      display: block;
      pointer-events: none;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1;
    `;
    witchHeadImg.alt = 'Witch Head';
    
    // Create inner container for proper layering
    const witchContainer = document.createElement('div');
    witchContainer.style.cssText = `
      position: relative;
      width: 70px;
      height: auto;
    `;
    
    witchContainer.appendChild(witchBodyImg);
    witchContainer.appendChild(witchHeadImg);
    witchElement.appendChild(witchContainer);
    
    // Set initial images
    updateWitchImages();
    
    // Handle image load errors
    witchBodyImg.onerror = function() {
      console.error('Little Witch Alcove: Failed to load body image from:', witchBodyImg.src);
      witchBodyImg.onerror = null;
    };
    
    witchHeadImg.onerror = function() {
      console.error('Little Witch Alcove: Failed to load head image from:', witchHeadImg.src);
      witchHeadImg.onerror = null;
    };
    
    document.body.appendChild(witchElement);
    console.log('Little Witch Alcove: Witch element created and added to page');
    
    // Physics variables
    let velocityY = 0;
    let velocityX = 0;
    const gravity = 0.5;
    // Floor position - will be updated when image loads to use actual height
    let floorY = window.innerHeight - 70; // Initial estimate
    const bounceDamping = 0.3; // Bounce reduction factor (lower = less bouncy)
    let isOnFloor = false;
    
    // Random walking variables
    let randomWalkTimer = null;
    let isWalking = false;
    const walkSpeed = 0.8; // Gentle walking speed
    const walkDuration = 1500; // Walk for 1.5 seconds
    const walkCooldown = 5000; // Wait 5 seconds between walk attempts
    
    // Drag functionality variables
    let isDragging = false;
    let currentX = initialX;
    let currentY = initialY;
    let dragInitialX = 0;
    let dragInitialY = 0;
    let dragPreviousX = 0; // Track drag position for direction
    let previousX = currentX;
    
    // Function to update state and direction, then update images
    function updateWitchStateAndDirection() {
      if (isDragging) {
        currentState = 'Flying';
        // Direction determined by drag movement
        const dragDirection = dragPreviousX - (dragInitialX + currentX);
        currentDirection = dragDirection > 0 ? 'Right' : 'Left';
      } else if (isWalking) {
        // Alternate between Walk 1 and Walk 2 for animation
        currentState = walkFrame === 1 ? 'Walk 1' : 'Walk 2';
        // Toggle walk frame every 300ms for animation
        setTimeout(() => {
          walkFrame = walkFrame === 1 ? 2 : 1;
        }, 300);
        // Direction based on velocity
        currentDirection = velocityX > 0 ? 'Right' : 'Left';
      } else {
        currentState = 'Idle';
        // Direction based on last movement or default to Right
        if (Math.abs(velocityX) > 0.1) {
          currentDirection = velocityX > 0 ? 'Right' : 'Left';
        }
      }
      updateWitchImages();
    }
    
    // Function to start random walking
    function startRandomWalk() {
      if (isDragging || !isOnFloor || isWalking) {
        return;
      }
      
      // Randomly decide to walk (40% chance)
      if (Math.random() > 0.4) {
        return;
      }
      
      isWalking = true;
      walkFrame = 1; // Reset walk frame
      // Random direction: left or right
      const direction = Math.random() > 0.5 ? 1 : -1;
      velocityX = walkSpeed * direction;
      
      // Stop walking after duration
      setTimeout(() => {
        isWalking = false;
        velocityX = 0;
        updateWitchStateAndDirection();
      }, walkDuration);
    }
    
    // Start random walk timer
    function initRandomWalking() {
      if (randomWalkTimer) {
        clearInterval(randomWalkTimer);
      }
      randomWalkTimer = setInterval(() => {
        if (!isDragging && isOnFloor && !isWalking) {
          startRandomWalk();
        }
      }, walkCooldown);
    }
    
    initRandomWalking();
    
    // Update floor position based on actual image height
    function updateFloorPosition() {
      if (witchBodyImg && witchBodyImg.complete) {
        const imageHeight = witchBodyImg.naturalHeight || 70;
        const imageWidth = witchBodyImg.naturalWidth || 70;
        // Calculate actual displayed height (maintaining aspect ratio)
        const displayedHeight = (imageHeight / imageWidth) * 70;
        floorY = window.innerHeight - displayedHeight;
      }
    }
    
    // Update floor when body image loads
    witchBodyImg.onload = function() {
      console.log('Little Witch Alcove: Witch body loaded successfully');
      updateFloorPosition();
      updateWitchStateAndDirection();
    };
    
    witchHeadImg.onload = function() {
      console.log('Little Witch Alcove: Witch head loaded successfully');
    };
    
    window.addEventListener('resize', updateFloorPosition);

    function dragStart(e) {
      if (e.type === "touchstart") {
        dragInitialX = e.touches[0].clientX - currentX;
        dragInitialY = e.touches[0].clientY - currentY;
        dragPreviousX = e.touches[0].clientX;
      } else {
        dragInitialX = e.clientX - currentX;
        dragInitialY = e.clientY - currentY;
        dragPreviousX = e.clientX;
      }

      if (e.target === witchElement || witchElement.contains(e.target)) {
        isDragging = true;
        witchElement.style.cursor = 'grabbing';
        updateWitchStateAndDirection();
      }
    }

    function drag(e) {
      if (isDragging) {
        e.preventDefault();
        
        let currentDragX = 0;
        if (e.type === "touchmove") {
          currentX = e.touches[0].clientX - dragInitialX;
          currentY = e.touches[0].clientY - dragInitialY;
          currentDragX = e.touches[0].clientX;
        } else {
          currentX = e.clientX - dragInitialX;
          currentY = e.clientY - dragInitialY;
          currentDragX = e.clientX;
        }

        // Reset velocity when dragging
        velocityY = 0;
        velocityX = 0;
        isOnFloor = false;
        isWalking = false; // Stop random walking when dragging
        
        // Update drag direction
        const dragDirection = currentDragX - dragPreviousX;
        dragPreviousX = currentDragX;
        
        // Update state and direction while dragging
        if (Math.abs(dragDirection) > 0.1) {
          updateWitchStateAndDirection();
        }
        
        setTranslate(currentX, currentY, witchElement);
      }
    }

    function dragEnd(e) {
      isDragging = false;
      witchElement.style.cursor = 'grab';
      // Give a small upward velocity when released
      velocityY = -2;
      isOnFloor = false;
      // Update state after release
      updateWitchStateAndDirection();
    }

  function setTranslate(xPos, yPos, el) {
    el.style.left = `${xPos}px`;
    el.style.top = `${yPos}px`;
    el.style.transform = 'none';
  }

  // Mouse events
  witchElement.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

  // Touch events
  witchElement.addEventListener('touchstart', dragStart);
  document.addEventListener('touchmove', drag);
  document.addEventListener('touchend', dragEnd);

  // Physics loop - gravity and floor collision
  function updatePhysics() {
    if (!witchElement || witchElement.style.display === 'none' || !witchElement.parentNode || isDragging) {
      return;
    }

    // Apply gravity
    velocityY += gravity;
    
    // Update position
    currentY += velocityY;
    currentX += velocityX;
    
    // Floor collision
    if (currentY >= floorY) {
      currentY = floorY;
      if (velocityY > 0) {
        // Bounce when hitting floor
        velocityY = -velocityY * bounceDamping;
        if (Math.abs(velocityY) < 0.5) {
          // Stop bouncing if velocity is too small
          velocityY = 0;
          isOnFloor = true;
        }
      }
    }
    
    // Side boundaries (optional - keep witch on screen)
    if (currentX < 0) {
      currentX = 0;
      velocityX = 0;
    } else if (currentX > window.innerWidth - 70) {
      currentX = window.innerWidth - 70;
      velocityX = 0;
    }
    
    // Apply friction when on floor (unless walking)
    if (isOnFloor && !isWalking) {
      velocityX *= 0.95;
    }
    
    // Update image based on movement direction
    updateWitchImage();
    
    setTranslate(currentX, currentY, witchElement);
  }
  
  // Run physics loop
  setInterval(updatePhysics, 16); // ~60fps
}

// Initialize when page is ready
console.log('Little Witch Alcove: Document ready state:', document.readyState);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    console.log('Little Witch Alcove: DOMContentLoaded fired');
    initWitch();
  });
} else {
  console.log('Little Witch Alcove: Document already ready, initializing immediately');
  initWitch();
}

// Also try after a delay as backup
setTimeout(function() {
  console.log('Little Witch Alcove: Backup initialization check');
  if (witchEnabled && !witchElement) {
    console.log('Little Witch Alcove: Witch enabled but not created, creating now');
    createWitch();
  }
}, 1000);

