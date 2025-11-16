// content script to inject witch into web pages
let witchElement = null;
let witchBodyImg = null;
let witchHeadImg = null;
let witchEnabled = false;
let selectedHat = 1;
let selectedRobe = 1;
let currentState = 'Idle'; // 'Idle', 'Flying', 'Walk 1', 'Walk 2', 'Study'
let currentDirection = 'Right'; // 'Left' or 'Right'
let walkFrame = 1; // to alternate walk frames
let isFocusing = false; // Track if user is focusing

function initWitch() {
  if (window.self !== window.top) {
    return;
  }
  
  chrome.storage.local.get(['witchEnabled'], function(result) {
    witchEnabled = result.witchEnabled || false;
    if (witchEnabled) {
      setTimeout(() => {
        createWitch();
      }, 100);
    }
  });
}

// productivity warning banner
let warningBanner = null;
let resumeBanner = null;

function createWarningBanner(reason) {
  // wait for body to be available
  if (!document.body) {
    setTimeout(() => createWarningBanner(reason), 100);
    return;
  }

  // remove existing banner if present
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

  // animation styles yay
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

function createResumeBanner() {
  // wait for body to be available
  if (!document.body) {
    setTimeout(() => createResumeBanner(), 100);
    return;
  }

  // rmove existing resume banner if present
  if (resumeBanner) {
    resumeBanner.remove();
  }

  // also lets hide warning banner if present
  hideWarningBanner();

  resumeBanner = document.createElement('div');
  resumeBanner.id = 'lwa-resume-banner';
  resumeBanner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #51cf66 0%, #40c057 100%);
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

  const resumeIcon = document.createElement('span');
  resumeIcon.textContent = '✓';
  resumeIcon.style.fontSize = '18px';

  const resumeText = document.createElement('span');
  resumeText.textContent = 'Timer resumed - You\'re back on a productive tab!';
  resumeText.style.flex = '1';

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
    hideResumeBanner();
  };

  resumeBanner.appendChild(resumeIcon);
  resumeBanner.appendChild(resumeText);
  resumeBanner.appendChild(closeButton);

  // make sure animation styles exist
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

  document.body.appendChild(resumeBanner);

  // auto-hide after 5 sec
  setTimeout(() => {
    hideResumeBanner();
  }, 5000);
}

function hideResumeBanner() {
  if (resumeBanner) {
    resumeBanner.style.animation = 'slideUp 0.3s ease-out';
    setTimeout(() => {
      if (resumeBanner) {
        resumeBanner.remove();
        resumeBanner = null;
      }
    }, 300);
  }
}

// listen for messages from popup and bg
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'showWitch') {
    witchEnabled = true;
    if (!witchElement) {
      createWitch();
    } else {
      witchElement.style.display = 'block';
    }
    sendResponse({ success: true });
  } else if (request.action === 'hideWitch') {
    witchEnabled = false;
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
  } else if (request.action === 'showResumeBanner') {
    createResumeBanner();
    sendResponse({ success: true });
  } else if (request.action === 'hideResumeBanner') {
    hideResumeBanner();
    sendResponse({ success: true });
  } else if (request.action === 'updateCustomization') {
    // update witch appearance w new drip
    if (witchElement) {
      updateWitchAppearance(request.hat || 1, request.robe || 1);
    }
    sendResponse({ success: true });
  } else if (request.action === 'startFocus') {
    // Move witch to corner and enter study state
    isFocusing = true;
    if (window.moveWitchToCorner) {
      window.moveWitchToCorner();
    }
    if (window.setWitchStudyState) {
      window.setWitchStudyState(true);
    }
    sendResponse({ success: true });
  } else if (request.action === 'stopFocus') {
    // Return to normal behavior
    isFocusing = false;
    if (window.setWitchStudyState) {
      window.setWitchStudyState(false);
    }
    sendResponse({ success: true });
  }
  return true; // keep message channel open for async response
});

// cache extension URLs to avoid repeated calls that might f us up
let extensionBaseUrl = null;
let extensionId = null;
let contextInvalidated = false;

// initialize extension URL cache early, but don't throw errors
function initializeExtensionURL() {
  if (contextInvalidated || extensionBaseUrl) return; // alr initialized or invalidated
  
  try {
    if (chrome && chrome.runtime && chrome.runtime.id) {
      extensionId = chrome.runtime.id;
      extensionBaseUrl = `chrome-extension://${extensionId}/`;
    } else if (chrome && chrome.runtime && chrome.runtime.getURL) {
      // Fallback: try to get URL and extract base
      try {
        const testUrl = chrome.runtime.getURL('Assets/Witch/Flying/Flying Head 1.png');
        if (testUrl) {
          const pathIndex = testUrl.indexOf('Assets/Witch/Flying/Flying Head 1.png');
          if (pathIndex > 0) {
            extensionBaseUrl = testUrl.substring(0, pathIndex);
          }
        }
      } catch (e) {
        // context invalidated
        contextInvalidated = true;
      }
    }
  } catch (e) {
    // context invalidated, mark so we don't keep trying
    contextInvalidated = true;
    if (!window.lwaContextErrorLogged) {
      console.warn('Little Witch Alcove: Extension context invalidated. Please reload the page.');
      window.lwaContextErrorLogged = true;
    }
  }
}

// Initialize once
initializeExtensionURL();

// Hhlper function to safely get extension URL
function getExtensionURL(path) {
  // if context invalidated and don't have cached URL, return null asap
  if (contextInvalidated && !extensionBaseUrl) {
    return null;
  }
  
  // use cached URL if available (works even if context is invalidated)
  if (extensionBaseUrl) {
    return extensionBaseUrl + path;
  }
  
  // try to initialize if we haven't yet
  if (!contextInvalidated) {
    initializeExtensionURL();
    if (extensionBaseUrl) {
      return extensionBaseUrl + path;
    }
  }
  
  // last ditch effort: try direct call (but only if context is valid)
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
    // give up bro
    contextInvalidated = true;
    if (!window.lwaContextErrorLogged) {
      console.warn('Little Witch Alcove: Extension context invalidated. Please reload the page.');
      window.lwaContextErrorLogged = true;
    }
  }
  
  return null;
}

// get PNG path based on state, dir, customization
function getWitchPNGPath(state, direction, type, number) {
  // type: 'Body' or 'Head'
  // number: 1-5 (from hat/robe selection)
  // state: 'Idle', 'Flying', 'Walk 1', 'Walk 2', 'Study'
  // direction: 'Left' or 'Right' (not used for Study state)
  const folder = state;
  const fileName = `${state} ${type} ${number}.png`;
  return `Assets/Witch/${folder}/${fileName}`;
}

// update witch appearance w new drip
function updateWitchAppearance(hat, robe) {
  selectedHat = hat;
  selectedRobe = robe;
  updateWitchImages();
}

// update witch images based on current state, dir, customization
function updateWitchImages() {
  if (!witchBodyImg || !witchHeadImg) return;
  
  const bodyPath = getWitchPNGPath(currentState, currentDirection, 'Body', selectedRobe);
  const headPath = getWitchPNGPath(currentState, currentDirection, 'Head', selectedHat);
  
  const bodyUrl = getExtensionURL(bodyPath);
  const headUrl = getExtensionURL(headPath);
  
  // only update if we have valid URLs
  if (bodyUrl && bodyUrl !== witchBodyImg.src) {
    witchBodyImg.src = bodyUrl;
  }
  if (headUrl && headUrl !== witchHeadImg.src) {
    witchHeadImg.src = headUrl;
  }
  
  // if URLs are null and context is invalidated, give up
  if (!bodyUrl || !headUrl) {
    if (contextInvalidated) {
      // context is invalidated - stop trying to update images
      return;
    }
  }
  
  // Head is always in front for all states
  witchBodyImg.style.zIndex = '1';
  witchHeadImg.style.zIndex = '2';
  
  // update body positioning and size - make sprite larger
  const headWidth = 90; // Increased from 75
  let bodyWidth = 76; // Increased from 63 (proportional)
  
  if (currentState === 'Idle') {
    bodyWidth = 72; // Increased from 60 (proportional)
  } else if (currentState === 'Study') {
    bodyWidth = 76; // Increased from 63 (proportional)
  }
  
  if (witchBodyImg && witchHeadImg) {
    witchBodyImg.style.width = `${bodyWidth}px`;
    witchBodyImg.style.left = `${(headWidth - bodyWidth) / 2}px`;
    // Stack directly on top of each other - images are designed with head at top and body at bottom
    witchBodyImg.style.top = '0px';
    
    // Keep head position fixed, but move it up more for idle pose
    // For walk and flying, move head down (closer to body)
    if (currentState === 'Idle') {
      witchHeadImg.style.top = '-11px';
    } else if (currentState === 'Walk 1' || currentState === 'Walk 2' || currentState === 'Flying') {
      witchHeadImg.style.top = '-9px';
    } else if (currentState === 'Study') {
      witchHeadImg.style.top = '-10px';
    } else {
      witchHeadImg.style.top = '-10px';
    }
    
    // Flip horizontally when facing right (but not for Study state)
    if (currentState === 'Study') {
      // Study state doesn't flip - always face left (default)
      witchBodyImg.style.transform = 'scaleX(1)';
      witchHeadImg.style.transform = 'scaleX(1)';
    } else if (currentDirection === 'Right') {
      witchBodyImg.style.transform = 'scaleX(-1)';
      witchHeadImg.style.transform = 'scaleX(-1)';
    } else {
      witchBodyImg.style.transform = 'scaleX(1)';
      witchHeadImg.style.transform = 'scaleX(1)';
    }
  }
}

function createWitch() {
  // wait for body to be available
  if (!document.body) {
    setTimeout(createWitch, 100);
    return;
  }

  // load customization from storage
  chrome.storage.local.get(['selectedHat', 'selectedRobe'], function(result) {
    selectedHat = result.selectedHat || 1;
    selectedRobe = result.selectedRobe || 1;
    
    // remove existing witch if any
    if (witchElement && witchElement.parentNode) {
      witchElement.remove();
    }

    // create witch container
    witchElement = document.createElement('div');
    witchElement.id = 'little-witch-alcove-witch';
    
    // Calculate initial position - make sprite larger
    const headWidth = 90;
    const bodyWidth = 72;
    const initialX = (window.innerWidth / 2) - (headWidth / 2);
    const initialY = -100;
    
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
    
    // create head image (top layer)
    witchHeadImg = document.createElement('img');
    witchHeadImg.id = 'witch-head';
    witchHeadImg.style.cssText = `
      width: ${headWidth}px;
      height: auto;
      display: block;
      pointer-events: auto;
      position: absolute;
      top: -8px;
      left: 0;
      z-index: 2;
    `;
    witchHeadImg.alt = 'Witch Head';
    
    // create body image
    witchBodyImg = document.createElement('img');
    witchBodyImg.id = 'witch-body';
    witchBodyImg.style.cssText = `
      width: ${bodyWidth}px;
      height: auto;
      display: block;
      pointer-events: auto;
      position: absolute;
      top: 0px;
      left: ${(headWidth - bodyWidth) / 2}px;
      z-index: 1;
    `;
    witchBodyImg.alt = 'Witch Body';
    
    // create inner container for proper layering
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
    
    // set initial images
    updateWitchImages();
    
    // handle image load errors (but don't let it break drag functionality)
    witchBodyImg.onerror = function() {
      if (!window.lwaImageErrorLogged) {
        console.warn('Little Witch Alcove: Failed to load body image. Drag should still work. Please reload the page if images don\'t appear.');
        window.lwaImageErrorLogged = true;
      }
      witchBodyImg.onerror = null;
    };
    
    witchHeadImg.onerror = function() {
      if (!window.lwaImageErrorLogged) {
        console.warn('Little Witch Alcove: Failed to load head image. Drag should still work. Please reload the page if images don\'t appear.');
        window.lwaImageErrorLogged = true;
      }
      witchHeadImg.onerror = null;
    };
    
    document.body.appendChild(witchElement);
    console.log('Little Witch Alcove: Witch element created and added to page');
    
    // Physics vars
    let velocityY = 0;
    let velocityX = 0;
    const gravity = 0.5;
    const floorPadding = 0; // Floor at bottom edge of tab
    let floorY = window.innerHeight - 150;
    const bounceDamping = 0.3;
    let isOnFloor = false;
    
    // random walking vars
    let randomWalkTimer = null;
    let isWalking = false;
    const walkSpeed = 0.8;
    const walkDuration = 1500;
    const walkCooldown = 5000;
    
    // drag functionality vars
    let isDragging = false;
    let currentX = initialX;
    let currentY = initialY;
    let dragInitialX = 0;
    let dragInitialY = 0;
    let dragPreviousX = 0;
    let previousX = currentX;
    
    // track last state to avoid unnecessary updates
    let lastState = '';
    let lastDirection = '';
    let walkAnimationTimer = null;
    
    // func to update state and direction, then update images
    function updateWitchStateAndDirection() {
      let newState = '';
      let newDirection = currentDirection;
      
      // Check if focusing first - Study state takes priority
      if (isFocusing) {
        newState = 'Study';
        // Keep current direction for Study state (not really used)
      } else if (isDragging) {
        newState = 'Flying';
        // dir is determined by drag movement
        const dragDirection = dragPreviousX - (dragInitialX + currentX);
        newDirection = dragDirection > 0 ? 'Right' : 'Left';
      } else if (isWalking) {
        newState = walkFrame === 1 ? 'Walk 1' : 'Walk 2';
        newDirection = velocityX > 0 ? 'Right' : 'Left';
      } else {
        newState = 'Idle';
        if (Math.abs(velocityX) > 0.1) {
          newDirection = velocityX > 0 ? 'Right' : 'Left';
        }
      }
      
      if (newState !== lastState || newDirection !== lastDirection) {
        currentState = newState;
        currentDirection = newDirection;
        lastState = newState;
        lastDirection = newDirection;
        updateWitchImages();
      }
    }
    
    // walk animation loop
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
      }, 400);
    }
    
    // func to start random walking
    function startRandomWalk() {
      if (isDragging || !isOnFloor || isWalking) {
        return;
      }
      
      // randomly decide to walk
      if (Math.random() > 0.4) {
        return;
      }
      
      isWalking = true;
      walkFrame = 1;
      startWalkAnimation();
      // random direction: left or right
      const direction = Math.random() > 0.5 ? 1 : -1;
      velocityX = walkSpeed * direction;
      
      // stop walking after duration
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
    
    // start random walk timer
    function initRandomWalking() {
      if (randomWalkTimer) {
        clearInterval(randomWalkTimer);
      }
      randomWalkTimer = setInterval(() => {
        if (!isDragging && isOnFloor && !isWalking && !isFocusing) {
          startRandomWalk();
        }
      }, walkCooldown);
    }
    
    initRandomWalking();
    
    // Function to move witch to corner (bottom right)
    function moveWitchToCorner() {
      if (!witchElement) return;
      
      const headWidth = 90; // Increased from 75
      const bodyWidth = currentState === 'Idle' ? 72 : 76;
      const cornerX = window.innerWidth - headWidth - 20; // 20px padding from right
      const cornerY = window.innerHeight - 100; // 100px from bottom
      
      currentX = cornerX;
      currentY = cornerY;
      velocityX = 0;
      velocityY = 0;
      setTranslate(currentX, currentY, witchElement);
    }
    
    // Function to set study state
    function setWitchStudyState(focusing) {
      isFocusing = focusing;
      if (focusing) {
        // Stop any walking
        isWalking = false;
        velocityX = 0;
        velocityY = 0;
        if (walkAnimationTimer) {
          clearInterval(walkAnimationTimer);
          walkAnimationTimer = null;
        }
        // Move to corner
        moveWitchToCorner();
        // Update state
        updateWitchStateAndDirection();
      } else {
        // Return to normal state
        updateWitchStateAndDirection();
      }
    }
    
    // Expose functions to window for message handler access
    window.moveWitchToCorner = moveWitchToCorner;
    window.setWitchStudyState = setWitchStudyState;
    
    // Check if timer is running and restore study mode if needed
    chrome.storage.local.get(['timerStartTime', 'timerPaused'], function(timerResult) {
      if (timerResult.timerStartTime && !timerResult.timerPaused) {
        // Timer is running - enter study mode
        setWitchStudyState(true);
      }
    });
    
    // update floor position based on actual image height
    function updateFloorPosition() {
      if (witchHeadImg && witchHeadImg.complete && witchBodyImg && witchBodyImg.complete) {
        const headWidth = 90; // Increased from 75
        // use current body width based on state
        const bodyWidth = currentState === 'Idle' ? 72 : (currentState === 'Study' ? 76 : 76);
        const headHeight = (witchHeadImg.naturalHeight / witchHeadImg.naturalWidth) * headWidth;
        const bodyHeight = (witchBodyImg.naturalHeight / witchBodyImg.naturalWidth) * bodyWidth;
        // The body is at top: 0px relative to witch element, so bottom of body is at currentY + bodyHeight
        // To make bottom of body touch bottom of window: currentY = window.innerHeight - bodyHeight
        // But we also need to account for the head overlap - head extends upward with negative top offset
        // So the actual visual bottom is just the body bottom
        floorY = window.innerHeight - bodyHeight;
      } else {
        floorY = window.innerHeight - 110;
      }
    }
    
    // update floor when body image loads
    witchBodyImg.onload = function() {
      updateFloorPosition();
      updateWitchStateAndDirection();
    };
    
    witchHeadImg.onload = function() {
      updateFloorPosition();
    };
    
    window.addEventListener('resize', updateFloorPosition);
    
    // also update floor when state changes
    const originalUpdateWitchStateAndDirection = updateWitchStateAndDirection;
    updateWitchStateAndDirection = function() {
      originalUpdateWitchStateAndDirection();
      updateFloorPosition();
    };

    function dragStart(e) {
      const target = e.target;
      
      if (!witchElement) {
        return;
      }
      
      const rect = witchElement.getBoundingClientRect();
      const clickX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
      const clickY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
      
      const isWithinBounds = clickX >= rect.left && clickX <= rect.right &&
                            clickY >= rect.top && clickY <= rect.bottom;
      
      const isWitchElement = target === witchElement;
      const isWitchChild = witchElement.contains(target);
      
      if (!isWithinBounds && !isWitchElement && !isWitchChild) {
        return;
      }
      
      // stop all physics immediately
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

      // keep velocity at zero while dragging
      velocityY = 0;
      velocityX = 0;
      isOnFloor = false;
      isWalking = false;
      
      // update drag direction
      const dragDirection = currentDragX - dragPreviousX;
      dragPreviousX = currentDragX;
      
      // update state and direction while dragging
      if (Math.abs(dragDirection) > 0.1) {
        updateWitchStateAndDirection();
      }
      
      setTranslate(currentX, currentY, witchElement);
    }

    function dragEnd(e) {
      if (!isDragging) return;
      
      isDragging = false;
      witchElement.style.cursor = 'grab';
      
      // give a small upward velocity when released
      velocityY = -2;
      isOnFloor = false;
      
      // update state after release
      updateWitchStateAndDirection();
    }

  function setTranslate(xPos, yPos, el) {
    el.style.left = `${xPos}px`;
    el.style.top = `${yPos}px`;
    el.style.transform = 'none';
  }

  // mouse events - attach to main el
  witchElement.addEventListener('mousedown', dragStart, true);
  document.addEventListener('mousemove', drag, true);
  document.addEventListener('mouseup', dragEnd, true);

  // Touch events
  witchElement.addEventListener('touchstart', dragStart, true);
  document.addEventListener('touchmove', drag, true);
  document.addEventListener('touchend', dragEnd, true);
  
  console.log('Little Witch Alcove: Event listeners attached to witch element');

  // Physics loop
  function updatePhysics() {
    // skip physics if drag or studying
    if (isDragging || isFocusing) {
      return;
    }
    
    if (!witchElement || witchElement.style.display === 'none' || !witchElement.parentNode) {
      return;
    }

    // apply gravity
    velocityY += gravity;
    
    // update position
    currentY += velocityY;
    currentX += velocityX;
    
    // floor collision
    if (currentY >= floorY) {
      currentY = floorY;
      if (velocityY > 0) {
        // bouncey bouncey on floor
        velocityY = -velocityY * bounceDamping;
        if (Math.abs(velocityY) < 0.5) {
          velocityY = 0;
          isOnFloor = true;
        }
      }
    }
    
    // side boundaries
    const headWidth = 75;
    if (currentX < 0) {
      currentX = 0;
      velocityX = 0;
    } else if (currentX > window.innerWidth - headWidth) {
      currentX = window.innerWidth - headWidth;
      velocityX = 0;
    }
    
    // apply friction when on floor
    if (isOnFloor && !isWalking) {
      velocityX *= 0.95;
    }
    
    // update state and direction based on movement
    // only update every few frames unless state changed
    if (Math.random() < 0.1 || isDragging || isWalking) {
      updateWitchStateAndDirection();
    }
    
    setTranslate(currentX, currentY, witchElement);
  }
  
  // run physics loop
  setInterval(updatePhysics, 16); // ~60fps
  });
}

// initialize when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    initWitch();
  });
} else {
  initWitch();
}

// also try after delay as backup
setTimeout(function() {
  if (witchEnabled && !witchElement) {
    createWitch();
  }
}, 1000);

