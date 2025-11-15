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
let resumeBanner = null;

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

// Cache extension URLs to avoid repeated calls that might fail
let extensionBaseUrl = null;
let extensionId = null;
let contextInvalidated = false;

// Initialize extension URL cache early - but don't throw errors
function initializeExtensionURL() {
  if (contextInvalidated || extensionBaseUrl) return; // Already initialized or invalidated
  
  try {
    if (chrome && chrome.runtime && chrome.runtime.id) {
      extensionId = chrome.runtime.id;
      extensionBaseUrl = `chrome-extension://${extensionId}/`;
    } else if (chrome && chrome.runtime && chrome.runtime.getURL) {
      // Fallback: try to get URL and extract base
      try {
        const testUrl = chrome.runtime.getURL('Assets/Witch/Idle/Idle Head 1.svg');
        if (testUrl) {
          const pathIndex = testUrl.indexOf('Assets/Witch/Idle/Idle Head 1.svg');
          if (pathIndex > 0) {
            extensionBaseUrl = testUrl.substring(0, pathIndex);
          }
        }
      } catch (e) {
        // Context invalidated
        contextInvalidated = true;
      }
    }
  } catch (e) {
    // Context invalidated - mark it so we don't keep trying
    contextInvalidated = true;
    if (!window.lwaContextErrorLogged) {
      console.warn('Little Witch Alcove: Extension context invalidated. Please reload the page.');
      window.lwaContextErrorLogged = true;
    }
  }
}

// Initialize once
initializeExtensionURL();

// Helper function to safely get extension URL
function getExtensionURL(path) {
  // If context is invalidated and we don't have a cached URL, return null immediately
  if (contextInvalidated && !extensionBaseUrl) {
    return null;
  }
  
  // Use cached URL if available (works even if context is invalidated)
  if (extensionBaseUrl) {
    return extensionBaseUrl + path;
  }
  
  // Try to initialize if we haven't yet
  if (!contextInvalidated) {
    initializeExtensionURL();
    if (extensionBaseUrl) {
      return extensionBaseUrl + path;
    }
  }
  
  // Last resort: try direct call (but only if context is valid)
  try {
    if (chrome && chrome.runtime && chrome.runtime.getURL && !contextInvalidated) {
      const fullUrl = chrome.runtime.getURL(path);
      // Extract base URL from first call
      if (fullUrl) {
        const pathIndex = fullUrl.indexOf(path);
        if (pathIndex > 0) {
          extensionBaseUrl = fullUrl.substring(0, pathIndex);
        }
        return fullUrl;
      }
    }
  } catch (e) {
    // Context invalidated - mark it and stop trying
    contextInvalidated = true;
    if (!window.lwaContextErrorLogged) {
      console.warn('Little Witch Alcove: Extension context invalidated. Please reload the page.');
      window.lwaContextErrorLogged = true;
    }
  }
  
  return null;
}

// Get SVG path based on state, direction, and customization
function getWitchSVGPath(state, direction, type, number) {
  // type: 'Body' or 'Head'
  // number: 1-5 (from hat/robe selection)
  // state: 'Idle', 'Flying', 'Walk 1', 'Walk 2'
  // direction: 'Left' or 'Right' (not used in filename, but kept for future use)
  const folder = state; // Folder name matches state exactly
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
  
  // Only update if we have valid URLs - prevents glitching when context is invalidated
  if (bodyUrl && bodyUrl !== witchBodyImg.src) {
    witchBodyImg.src = bodyUrl;
  }
  if (headUrl && headUrl !== witchHeadImg.src) {
    witchHeadImg.src = headUrl;
  }
  
  // If URLs are null and context is invalidated, don't keep trying
  if (!bodyUrl || !headUrl) {
    if (contextInvalidated) {
      // Context is invalidated - stop trying to update images
      return;
    }
  }
  
  // For flying state, body should be over head (reverse z-index)
  if (currentState === 'Flying') {
    witchBodyImg.style.zIndex = '2';
    witchHeadImg.style.zIndex = '1';
  } else {
    // Normal: head over body
    witchBodyImg.style.zIndex = '1';
    witchHeadImg.style.zIndex = '2';
  }
  
  // Update body positioning and size
  const headWidth = 50;
  let bodyWidth = 35;
  
  // Make body smaller for idle state
  if (currentState === 'Idle') {
    bodyWidth = 28; // Smaller body for idle
  }
  
  if (witchBodyImg && witchHeadImg) {
    witchBodyImg.style.width = `${bodyWidth}px`;
    witchBodyImg.style.left = `${(headWidth - bodyWidth) / 2}px`;
    // Position body so top edge overlaps with bottom of head circle
    // Assuming head is roughly circular, position body at ~70% of head height
    if (witchHeadImg.complete && witchHeadImg.naturalHeight) {
      const headHeight = (witchHeadImg.naturalHeight / witchHeadImg.naturalWidth) * headWidth;
      const bodyTop = headHeight * 0.7; // Position body at 70% of head height
      witchBodyImg.style.top = `${bodyTop}px`;
    } else {
      // Fallback if head not loaded yet
      witchBodyImg.style.top = `${headWidth * 0.7}px`;
    }
    
    // Flip horizontally when facing right (since we only have left-facing SVGs)
    if (currentDirection === 'Right') {
      witchBodyImg.style.transform = 'scaleX(-1)';
      witchHeadImg.style.transform = 'scaleX(-1)';
    } else {
      witchBodyImg.style.transform = 'scaleX(1)';
      witchHeadImg.style.transform = 'scaleX(1)';
    }
  }
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
    const headWidth = 50; // Head size
    const bodyWidth = 35; // Body is smaller than head
    const initialX = (window.innerWidth / 2) - (headWidth / 2);
    const initialY = 100; // Start higher up so she falls
    
    witchElement.style.cssText = `
      position: fixed;
      left: ${initialX}px;
      top: ${initialY}px;
      z-index: 999999;
      cursor: grab;
      user-select: none;
      width: ${headWidth}px;
      height: auto;
      pointer-events: auto;
      touch-action: none;
    `;
    
    // Create head image (top layer)
    witchHeadImg = document.createElement('img');
    witchHeadImg.id = 'witch-head';
    witchHeadImg.style.cssText = `
      width: ${headWidth}px;
      height: auto;
      display: block;
      pointer-events: auto;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 2;
    `;
    witchHeadImg.alt = 'Witch Head';
    
    // Create body image (bottom layer, smaller, positioned to overlap slightly)
    witchBodyImg = document.createElement('img');
    witchBodyImg.id = 'witch-body';
    witchBodyImg.style.cssText = `
      width: ${bodyWidth}px;
      height: auto;
      display: block;
      pointer-events: auto;
      position: absolute;
      top: ${headWidth * 0.7}px;
      left: ${(headWidth - bodyWidth) / 2}px;
      z-index: 1;
    `;
    witchBodyImg.alt = 'Witch Body';
    
    // Create inner container for proper layering
    const witchContainer = document.createElement('div');
    witchContainer.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      pointer-events: auto;
      touch-action: none;
    `;
    
    witchContainer.appendChild(witchHeadImg);
    witchContainer.appendChild(witchBodyImg);
    witchElement.appendChild(witchContainer);
    
    // Set initial images
    updateWitchImages();
    
    // Handle image load errors (but don't let it break drag functionality)
    witchBodyImg.onerror = function() {
      // Only log once to avoid spam
      if (!window.lwaImageErrorLogged) {
        console.warn('Little Witch Alcove: Failed to load body image. Drag should still work. Please reload the page if images don\'t appear.');
        window.lwaImageErrorLogged = true;
      }
      witchBodyImg.onerror = null;
    };
    
    witchHeadImg.onerror = function() {
      // Only log once to avoid spam  
      if (!window.lwaImageErrorLogged) {
        console.warn('Little Witch Alcove: Failed to load head image. Drag should still work. Please reload the page if images don\'t appear.');
        window.lwaImageErrorLogged = true;
      }
      witchHeadImg.onerror = null;
    };
    
    document.body.appendChild(witchElement);
    console.log('Little Witch Alcove: Witch element created and added to page');
    
    // Physics variables
    let velocityY = 0;
    let velocityX = 0;
    const gravity = 0.5;
    // Floor position - will be updated when image loads to use actual height
    let floorY = window.innerHeight - 80; // Initial estimate
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
    
    // Track last state to avoid unnecessary updates
    let lastState = '';
    let lastDirection = '';
    let walkAnimationTimer = null;
    
    // Function to update state and direction, then update images
    function updateWitchStateAndDirection() {
      let newState = '';
      let newDirection = currentDirection;
      
      if (isDragging) {
        newState = 'Flying';
        // Direction determined by drag movement
        const dragDirection = dragPreviousX - (dragInitialX + currentX);
        newDirection = dragDirection > 0 ? 'Right' : 'Left';
      } else if (isWalking) {
        // Alternate between Walk 1 and Walk 2 for animation
        newState = walkFrame === 1 ? 'Walk 1' : 'Walk 2';
        // Direction based on velocity
        newDirection = velocityX > 0 ? 'Right' : 'Left';
      } else {
        newState = 'Idle';
        // Direction based on last movement or default to Right
        if (Math.abs(velocityX) > 0.1) {
          newDirection = velocityX > 0 ? 'Right' : 'Left';
        }
      }
      
      // Only update if state or direction changed (reduces choppiness)
      if (newState !== lastState || newDirection !== lastDirection) {
        currentState = newState;
        currentDirection = newDirection;
        lastState = newState;
        lastDirection = newDirection;
        updateWitchImages();
      }
    }
    
    // Walk animation loop (smoother than setTimeout)
    function startWalkAnimation() {
      if (walkAnimationTimer) {
        clearInterval(walkAnimationTimer);
      }
      walkAnimationTimer = setInterval(() => {
        if (isWalking && !isDragging) {
          walkFrame = walkFrame === 1 ? 2 : 1;
          updateWitchStateAndDirection();
        } else if (!isWalking) {
          clearInterval(walkAnimationTimer);
          walkAnimationTimer = null;
        }
      }, 400); // 400ms per frame for smoother animation
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
      startWalkAnimation(); // Start animation loop
      // Random direction: left or right
      const direction = Math.random() > 0.5 ? 1 : -1;
      velocityX = walkSpeed * direction;
      
      // Stop walking after duration
      setTimeout(() => {
        isWalking = false;
        velocityX = 0;
        if (walkAnimationTimer) {
          clearInterval(walkAnimationTimer);
          walkAnimationTimer = null;
        }
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
      if (witchHeadImg && witchHeadImg.complete && witchBodyImg && witchBodyImg.complete) {
        const headWidth = 50;
        // Use current body width based on state (idle is smaller)
        const bodyWidth = currentState === 'Idle' ? 28 : 35;
        const headHeight = (witchHeadImg.naturalHeight / witchHeadImg.naturalWidth) * headWidth;
        const bodyHeight = (witchBodyImg.naturalHeight / witchBodyImg.naturalWidth) * bodyWidth;
        // Calculate total height: head height + body height (minus overlap)
        const headBottom = headHeight * 0.7; // Where body starts
        const totalHeight = headBottom + bodyHeight;
        floorY = window.innerHeight - totalHeight;
      } else {
        // Fallback estimate
        floorY = window.innerHeight - 80;
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
      updateFloorPosition();
    };
    
    window.addEventListener('resize', updateFloorPosition);
    
    // Also update floor when state changes (since body size changes)
    const originalUpdateWitchStateAndDirection = updateWitchStateAndDirection;
    updateWitchStateAndDirection = function() {
      originalUpdateWitchStateAndDirection();
      updateFloorPosition(); // Recalculate floor when state changes
    };

    function dragStart(e) {
      // Check if click is on the witch element or anywhere inside it
      const target = e.target;
      console.log('Little Witch Alcove: dragStart called, target:', target, 'witchElement:', witchElement);
      
      // Check if click is within witch bounds (more reliable than checking target)
      if (!witchElement) {
        console.log('Little Witch Alcove: No witch element');
        return;
      }
      
      const rect = witchElement.getBoundingClientRect();
      const clickX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
      const clickY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
      
      const isWithinBounds = clickX >= rect.left && clickX <= rect.right &&
                            clickY >= rect.top && clickY <= rect.bottom;
      
      // Also check if target is witch or child
      const isWitchElement = target === witchElement;
      const isWitchChild = witchElement.contains(target);
      
      if (!isWithinBounds && !isWitchElement && !isWitchChild) {
        console.log('Little Witch Alcove: Click not on witch, ignoring');
        return;
      }
      
      console.log('Little Witch Alcove: Starting drag');
      
      // Stop all physics immediately
      isDragging = true;
      velocityY = 0;
      velocityX = 0;
      isOnFloor = false;
      isWalking = false;
      
      if (e.type === "touchstart") {
        dragInitialX = e.touches[0].clientX - currentX;
        dragInitialY = e.touches[0].clientY - currentY;
        dragPreviousX = e.touches[0].clientX;
      } else {
        dragInitialX = e.clientX - currentX;
        dragInitialY = e.clientY - currentY;
        dragPreviousX = e.clientX;
      }

      witchElement.style.cursor = 'grabbing';
      e.preventDefault();
      e.stopPropagation();
      updateWitchStateAndDirection();
    }

    function drag(e) {
      if (!isDragging) return;
      
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

      // Keep velocity at zero while dragging
      velocityY = 0;
      velocityX = 0;
      isOnFloor = false;
      isWalking = false;
      
      // Update drag direction
      const dragDirection = currentDragX - dragPreviousX;
      dragPreviousX = currentDragX;
      
      // Update state and direction while dragging
      if (Math.abs(dragDirection) > 0.1) {
        updateWitchStateAndDirection();
      }
      
      setTranslate(currentX, currentY, witchElement);
    }

    function dragEnd(e) {
      if (!isDragging) return;
      
      isDragging = false;
      witchElement.style.cursor = 'grab';
      
      // Give a small upward velocity when released (like before)
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

  // Mouse events - attach to main element (it will catch all clicks on children)
  // Use capture phase to ensure we catch events even if children have pointer-events
  witchElement.addEventListener('mousedown', dragStart, true);
  document.addEventListener('mousemove', drag, true);
  document.addEventListener('mouseup', dragEnd, true);

  // Touch events - use capture phase
  witchElement.addEventListener('touchstart', dragStart, true);
  document.addEventListener('touchmove', drag, true);
  document.addEventListener('touchend', dragEnd, true);
  
  console.log('Little Witch Alcove: Event listeners attached to witch element');

  // Physics loop - gravity and floor collision
  function updatePhysics() {
    // Skip physics entirely if dragging
    if (isDragging) {
      return;
    }
    
    if (!witchElement || witchElement.style.display === 'none' || !witchElement.parentNode) {
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
    const headWidth = 50;
    if (currentX < 0) {
      currentX = 0;
      velocityX = 0;
    } else if (currentX > window.innerWidth - headWidth) {
      currentX = window.innerWidth - headWidth;
      velocityX = 0;
    }
    
    // Apply friction when on floor (unless walking)
    if (isOnFloor && !isWalking) {
      velocityX *= 0.95;
    }
    
    // Update state and direction based on movement (throttled to reduce choppiness)
    // Only update every few frames unless state changed
    if (Math.random() < 0.1 || isDragging || isWalking) {
      updateWitchStateAndDirection();
    }
    
    setTranslate(currentX, currentY, witchElement);
  }
  
  // Run physics loop
  setInterval(updatePhysics, 16); // ~60fps
  });
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

