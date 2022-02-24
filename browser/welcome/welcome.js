window.onload = onLoaded;

function onLoaded() {
    document.getElementById('slide-1-button').onclick = function() {
        onSlideClick('slide-2-indicator', true);
    };

    document.getElementById('slide-2-button').onclick = function() {
        onSlideClick('slide-3-indicator', true);
    };

    document.getElementById('slide-3-button').onclick = function() {
        onClose();
    };

    document.getElementById('slide-1-indicator').onclick = function() {
        onSlideClick('slide-1-indicator');
    };

    document.getElementById('slide-2-indicator').onclick = function() {
        onSlideClick('slide-2-indicator');
    };

    document.getElementById('slide-3-indicator').onclick = function() {
        onSlideClick('slide-3-indicator');
    };

    if (window.parent !== window.self) {
        window.parent.postMessage('{"MessageId":"welcome-show"}', '*');
    }
}

function onClose() {
    if (window.parent !== window.self) {
        window.parent.postMessage('{"MessageId":"welcome-close"}', '*');
    }
}

function onSlideClick(e, isButton = false) {
    for (var i = 1; i < 4; i++)
        document.getElementById('slide-' + i + '-indicator').classList.remove("active");

    document.getElementById(e).classList.add("active");
    if (isButton)
        document.location = '#' + e.replace('-indicator', '');
}
