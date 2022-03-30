window.onload = onLoaded;

function onLoaded() {
    var elem;
    window.addEventListener('message', onMessage, false);

    elem = document.getElementById('slide-1-button');
    if (elem)
	elem.onclick = function() {
            onSlideClick('slide-2-indicator', true);
	};

    elem = document.getElementById('slide-2-button');
    if (elem)
	elem.onclick = function() {
            onSlideClick('slide-3-indicator', true);
	};

    elem = document.getElementById('slide-3-button');
    if (elem)
	elem.onclick = function() {
            onClose();
	};

    elem = document.getElementById('slide-1-indicator');
    if (elem)
	elem.onclick = function() {
            onSlideClick('slide-1-indicator');
	};

    elem = document.getElementById('slide-2-indicator');
    if (elem)
	elem.onclick = function() {
            onSlideClick('slide-2-indicator');
	};

    elem = document.getElementById('slide-3-indicator');
    if (elem)
	elem.onclick = function() {
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
