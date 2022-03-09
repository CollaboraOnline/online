window.onload = onLoaded;

function onLoaded() {
    window.addEventListener('message', onMessage, false);

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
        var message = {
            MessageId: 'welcome-translate',
            strings: {}
        };
        getTranslatable(document.body, message.strings);
        window.parent.postMessage(JSON.stringify(message), '*');
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

function onMessage(e) {
    try {
        var msg = JSON.parse(e.data);
        if (window.parent !== window.self && msg.MessageId === 'welcome-translate') {
            setTranslatable(document.body, msg.strings);
            window.parent.postMessage('{"MessageId":"welcome-show"}', '*');
        }
    } catch (err) {
        return;
    }
}

function getTranslatable(root, strings) {
    var nodes = root.childNodes;
    for (var it = 0; it < nodes.length; ++it) {
        if (nodes[it].nodeType == Node.TEXT_NODE) {
            strings[nodes[it].nodeValue] = '';
        }
        getTranslatable(nodes[it], strings);
    }
}

function setTranslatable(root, strings) {
    var nodes = root.childNodes;
    for (var it = 0; it < nodes.length; ++it) {
        if (nodes[it].nodeType == Node.TEXT_NODE) {
            nodes[it].nodeValue = strings[nodes[it].nodeValue];
        }
        setTranslatable(nodes[it], strings);
    }
}
