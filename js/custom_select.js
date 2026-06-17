// Global overlay for custom selects
let selectOverlay, selectBox, selectTitle, selectOptionsContainer;
let currentSelectElement = null;

function initCustomSelectOverlay() {
    if (document.getElementById('custom-select-overlay')) return;

    selectOverlay = document.createElement('div');
    selectOverlay.id = 'custom-select-overlay';
    selectOverlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:99999; display:flex; justify-content:center; align-items:center; transition: opacity 0.3s ease; opacity: 0; pointer-events: none;';
    
    selectOverlay.innerHTML = `
        <div id="custom-select-box" style="background:#111; border:1px solid #444; border-radius:5px; padding:20px; width:400px; max-width:90%; text-align:center; box-shadow: 0 5px 25px rgba(0,0,0,0.8); transform: scale(0.9); transition: all 0.2s ease-out;">
            <h3 id="custom-select-title" style="color:#f33; margin-top:0; border-bottom:1px solid #333; padding-bottom:10px; font-family:'Special Elite';">Pilih Opsi</h3>
            
            <div id="custom-select-options-container" style="margin-top: 15px; max-height: 60vh; overflow-y: auto; text-align: left; display: flex; flex-direction: column; gap: 5px; padding-right: 5px; scrollbar-width: thin; scrollbar-color: #555 #111;">
                <!-- Options will be injected here -->
            </div>
        </div>
    `;
    
    // Close when clicking outside the box
    selectOverlay.addEventListener('click', (e) => {
        if (e.target === selectOverlay) {
            closeCustomSelectOverlay();
        }
    });

    document.body.appendChild(selectOverlay);
    
    selectBox = document.getElementById('custom-select-box');
    selectTitle = document.getElementById('custom-select-title');
    selectOptionsContainer = document.getElementById('custom-select-options-container');
}

function openCustomSelectOverlay(selectElement) {
    currentSelectElement = selectElement;
    const currentVal = selectElement.value;
    
    // Get title from previous <p> element if it exists
    let title = "Pilih Opsi";
    if (selectElement.previousElementSibling && selectElement.previousElementSibling.tagName === 'P') {
        title = selectElement.previousElementSibling.innerText.replace(':', '');
    }
    selectTitle.innerText = title;
    
    // Render options
    selectOptionsContainer.innerHTML = '';
    Array.from(selectElement.options).forEach(opt => {
        const optDiv = document.createElement('div');
        optDiv.innerText = opt.text;
        // Flat, elegant styling
        optDiv.style.cssText = `padding: 12px 15px; border-radius: 4px; cursor: pointer; font-family: 'Special Elite'; transition: background 0.1s; border: 1px solid transparent; background: transparent; color: #bbb;`;
        
        if (opt.value === currentVal) {
            optDiv.style.background = 'rgba(255,0,0,0.15)';
            optDiv.style.borderColor = '#900';
            optDiv.style.color = '#fff';
        }
        
        // Hover effect
        optDiv.addEventListener('mouseenter', () => {
            if (opt.value !== currentVal) {
                optDiv.style.background = 'rgba(255,255,255,0.05)';
            }
        });
        optDiv.addEventListener('mouseleave', () => {
            if (opt.value !== currentVal) {
                optDiv.style.background = 'transparent';
            }
        });
        
        // Immediate apply and close on click
        optDiv.addEventListener('click', () => {
            if (typeof Audio !== 'undefined' && typeof Audio.playSfx === 'function') Audio.playSfx('click');
            
            // Apply value
            currentSelectElement.value = opt.value;
            currentSelectElement.dispatchEvent(new Event('change'));
            
            closeCustomSelectOverlay();
        });
        
        selectOptionsContainer.appendChild(optDiv);
    });

    // Show overlay
    selectOverlay.style.pointerEvents = 'all';
    selectOverlay.style.opacity = '1';
    
    // Trigger reflow for animation
    void selectOverlay.offsetWidth;
    selectBox.style.transform = 'scale(1)';
}

function closeCustomSelectOverlay() {
    selectBox.style.transform = 'scale(0.9)';
    selectOverlay.style.opacity = '0';
    selectOverlay.style.pointerEvents = 'none';
    currentSelectElement = null;
}

function setupCustomSelects() {
    initCustomSelectOverlay();

    document.querySelectorAll('.set-select').forEach(select => {
        if(select.nextElementSibling && select.nextElementSibling.classList.contains('custom-select-trigger')) return;
        
        select.style.display = 'none';
        
        const trigger = document.createElement('div');
        trigger.className = 'custom-select-trigger';
        // Flat, sleek look for the trigger
        trigger.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: rgba(0,0,0,0.6); color: #fff; border: 1px solid #444; border-radius: 4px; cursor: pointer; font-family: 'Special Elite'; transition: all 0.2s; user-select: none;";
        
        const triggerSpan = document.createElement('span');
        triggerSpan.innerText = select.options[select.selectedIndex]?.text || '';
        
        const triggerIcon = document.createElement('i');
        triggerIcon.className = 'fa-solid fa-chevron-down';
        
        trigger.appendChild(triggerSpan);
        trigger.appendChild(triggerIcon);
        
        select.parentNode.insertBefore(trigger, select.nextSibling);
        
        trigger.addEventListener('mouseenter', () => {
            trigger.style.borderColor = '#800';
            trigger.style.background = 'rgba(20,0,0,0.8)';
        });
        trigger.addEventListener('mouseleave', () => {
            trigger.style.borderColor = '#444';
            trigger.style.background = 'rgba(0,0,0,0.6)';
        });
        
        trigger.addEventListener('click', (e) => {
            if (typeof Audio !== 'undefined' && typeof Audio.playSfx === 'function') Audio.playSfx('click');
            e.stopPropagation();
            openCustomSelectOverlay(select);
        });
        
        // Listen to underlying select changes to update trigger span
        select.addEventListener('change', () => {
            triggerSpan.innerText = select.options[select.selectedIndex]?.text || '';
        });
    });
}

// Ensure it runs even if called after load
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(setupCustomSelects, 200);
} else {
    window.addEventListener('load', () => setTimeout(setupCustomSelects, 200));
}
