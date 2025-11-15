// Content script to inject witch into web pages
console.log('Little Witch Alcove: Content script loaded!');

let witchElement = null;
let witchEnabled = false;

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

// Listen for messages from popup
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
  }
  return true; // Keep message channel open for async response
});

function createWitch() {
  // Wait for body to be available
  if (!document.body) {
    setTimeout(createWitch, 100);
    return;
  }

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
  `;
  

  // Create witch image
  const witchImg = document.createElement('img');
  
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
  
  const leftImageUrl = getExtensionURL('Assets/Witch/Witch Left.png');
  const rightImageUrl = getExtensionURL('Assets/Witch/Witch Right.png');
  const flyingLeftImageUrl = getExtensionURL('Assets/Witch/Witch Flying Left.png');
  const flyingRightImageUrl = getExtensionURL('Assets/Witch/Witch Flying Right.png');
  
  if (!leftImageUrl || !rightImageUrl || !flyingLeftImageUrl || !flyingRightImageUrl) {
    console.error('Little Witch Alcove: Cannot get extension URL - extension may need to be reloaded');
    return;
  }
  
  console.log('Little Witch Alcove: Left image URL:', leftImageUrl);
  console.log('Little Witch Alcove: Right image URL:', rightImageUrl);
  console.log('Little Witch Alcove: Flying Left image URL:', flyingLeftImageUrl);
  console.log('Little Witch Alcove: Flying Right image URL:', flyingRightImageUrl);
  console.log('Little Witch Alcove: Extension ID:', chrome.runtime.id);
  
  // Set initial image (default to right)
  witchImg.src = rightImageUrl;
  witchImg.id = 'witch-image';
  witchImg.style.cssText = `
    width: 70px;
    height: auto;
    image-rendering: pixelated;
    image-rendering: -moz-crisp-edges;
    image-rendering: crisp-edges;
    pointer-events: none;
  `;
  witchImg.alt = 'Little Witch';
  
  // Store URLs for later use
  let storedLeftUrl = leftImageUrl;
  let storedRightUrl = rightImageUrl;
  let storedFlyingLeftUrl = flyingLeftImageUrl;
  let storedFlyingRightUrl = flyingRightImageUrl;
  
  // Handle image load errors - only log, don't retry with wrong path
  witchImg.onerror = function() {
    console.error('Little Witch Alcove: Failed to load witch image from:', witchImg.src);
    console.error('Little Witch Alcove: Make sure the extension is reloaded and the page is refreshed');
    // Remove the error handler to prevent infinite loop
    witchImg.onerror = null;
  };
  
  // Function to update image based on movement direction (for non-dragging movement)
  function updateWitchImage() {
    if (isDragging) {
      // Image is updated in drag() function, so skip here
      return;
    }
    
    // Use regular left/right images when not dragging
    const deltaX = currentX - previousX;
    const direction = Math.abs(velocityX) > 0.1 ? velocityX : deltaX;
    
    if (Math.abs(velocityX) > 0.1 || Math.abs(deltaX) > 0.1) {
      if (direction > 0) {
        // Moving right
        if (storedRightUrl && witchImg.src !== storedRightUrl) {
          witchImg.src = storedRightUrl;
        }
      } else if (direction < 0) {
        // Moving left
        if (storedLeftUrl && witchImg.src !== storedLeftUrl) {
          witchImg.src = storedLeftUrl;
        }
      }
    }
    previousX = currentX;
  }
  

  witchElement.appendChild(witchImg);
  document.body.appendChild(witchElement);
  console.log('Little Witch Alcove: Witch element created and added to page');
  console.log('Little Witch Alcove: Witch element position:', {
    left: witchElement.style.left,
    top: witchElement.style.top,
    display: window.getComputedStyle(witchElement).display,
    visibility: window.getComputedStyle(witchElement).visibility,
    zIndex: window.getComputedStyle(witchElement).zIndex
  });
  console.log('Little Witch Alcove: Image src:', witchImg.src);
  console.log('Little Witch Alcove: Image complete:', witchImg.complete);
  console.log('Little Witch Alcove: Image naturalWidth:', witchImg.naturalWidth);

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
  const walkCooldown = 5000; // Wait 6 seconds between walk attempts
  
  // Function to start random walking
  function startRandomWalk() {
    if (isDragging || !isOnFloor || isWalking) {
      return;
    }
    
    // Randomly decide to walk (15% chance - less frequent)
    if (Math.random() > 0.25) {
      return;
    }
    
    isWalking = true;
    // Random direction: left or right
    const direction = Math.random() > 0.5 ? 1 : -1;
    velocityX = walkSpeed * direction;
    
    // Stop walking after duration
    setTimeout(() => {
      isWalking = false;
      velocityX = 0;
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
    const imageHeight = witchImg.naturalHeight || 70;
    const imageWidth = witchImg.naturalWidth || 70;
    // Calculate actual displayed height (maintaining aspect ratio)
    const displayedHeight = (imageHeight / imageWidth) * 70;
    floorY = window.innerHeight - displayedHeight;
  }
  
  // Update floor when image loads
  witchImg.onload = function() {
    console.log('Little Witch Alcove: Witch image loaded successfully from:', witchImg.src);
    console.log('Little Witch Alcove: Image dimensions:', witchImg.naturalWidth, 'x', witchImg.naturalHeight);
    console.log('Little Witch Alcove: Witch element is visible:', window.getComputedStyle(witchElement).display !== 'none');
    updateFloorPosition();
  };
  
  window.addEventListener('resize', updateFloorPosition);
  
  // Drag functionality - declare variables in outer scope
  let isDragging = false;
  let currentX = initialX;
  let currentY = initialY;
  let dragInitialX = 0;
  let dragInitialY = 0;
  let dragPreviousX = 0; // Track drag position for direction
  
  // Track previous position to determine direction
  let previousX = currentX;

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
      // Set initial flying image based on current facing direction
      if (witchImg.src.includes('Right') || witchImg.src === rightImageUrl) {
        witchImg.src = storedFlyingRightUrl;
      } else {
        witchImg.src = storedFlyingLeftUrl;
      }
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
      
      // Update drag direction for image switching
      const dragDirection = currentDragX - dragPreviousX;
      dragPreviousX = currentDragX;
      
      // Update image while dragging (flying) based on drag direction
      if (Math.abs(dragDirection) > 0.1) {
        if (dragDirection > 0) {
          // Dragging right
          if (storedFlyingRightUrl && witchImg.src !== storedFlyingRightUrl) {
            witchImg.src = storedFlyingRightUrl;
          }
        } else {
          // Dragging left
          if (storedFlyingLeftUrl && witchImg.src !== storedFlyingLeftUrl) {
            witchImg.src = storedFlyingLeftUrl;
          }
        }
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
    // Update image based on direction after release
    updateWitchImage();
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

