window.onload = onLoaded;

function onLoaded() {
    window.addEventListener('message', onMessage, false);

    document.getElementById('welcome-close').onclick = function() {
        onClose();
    }

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
        if (e.origin === window.origin && window.parent !== window.self
            && msg.MessageId === 'welcome-translate') {
            setTranslatable(document.body, msg.strings);
            window.parent.postMessage('{"MessageId":"welcome-show"}', '*');
        }
    } catch (err) {
        return;
    }
}

function getTranslatable(root, strings) {
    var children = root.children;
    for (var i = 0; i < children.length; ++i) {
        if (children[i].dataset.translate === 'true') {
            strings[children[i].innerHTML.trim().replace('\n', '')] = '';
        }
        getTranslatable(children[i], strings);
    }
}

function setTranslatable(root, strings) {
    var children = root.children;
    for (var i = 0; i < children.length; ++i) {
        if (children[i].dataset.translate === 'true') {
            children[i].innerHTML = strings[children[i].innerHTML.trim().replace('\n', '')];
        }
        setTranslatable(children[i], strings);
    }
}
