/* -*- js-indent-level: 8 -*- */

/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * PresenterConsole
 */

/* global SlideShow _ */

class PresenterConsole {
	constructor(map) {
		this._map = map;
		this._map.on('presentationinfo', this._onPresentationInfo, this);
		this._map.on('newpresentinconsole', this._onPresentInConsole, this);
		this._map.on('transitionend', this._onEndTransition, this);
	}

	_generateHtml(title) {
		let sanitizer = document.createElement('div');
		sanitizer.innerText = title;

		let sanitizedTitle = sanitizer.innerHTML;
		return `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>${sanitizedTitle}</title>
			</head>
			<body>
                                <header>
                                </header>
                                <main id="main-content">
                                     <div id="first-presentation">
                                         <canvas id="current-presentation"></canvas>
                                         <div id="timer"></div>
                                     </div>
                                     <div id="second-presentation">
                                         <canvas id="next-presentation"></canvas>
                                         <div id='notes'></div>
                                     </div>
                                </main>
                                <footer>
                                </footer>
			</body>
			</html>
			`;
	}

	_onPresentationInfo() {
		if (!this._proxyPresenter) {
			return;
		}
		this._timer = setInterval(L.bind(this._onTimer, this), 1000);
		this._ticks = 0;
	}

	_onPresentInConsole() {
		this._map.fire('newpresentinwindow');

		let top = screen.height - 500;
		let left = screen.width - 800;
		this._proxyPresenter = window.open(
			'',
			'_blank',
			'popup,width=800,height=500,left=' + left + ',top=' + top,
		);
		if (!this._proxyPresenter) {
			this._map.slideShowPresenter._notifyBlockedPresenting();
			return;
		}

		this._map.off('newpresentinconsole', this._onPresentInConsole, this);

		this._proxyPresenter.document.open();
		this._proxyPresenter.document.write(
			this._generateHtml(_('Presenter Console')),
		);
		this._proxyPresenter.document.close();

		this._map.slideShowPresenter._slideShowWindowProxy.addEventListener(
			'unload',
			L.bind(this._onWindowClose, this),
		);
		this._proxyPresenter.addEventListener(
			'unload',
			L.bind(this._onConsoleClose, this),
		);
		this._proxyPresenter.addEventListener('click', L.bind(this._onClick, this));
		this._proxyPresenter.addEventListener(
			'keydown',
			L.bind(this._onKeyDown, this),
		);

		this._proxyPresenter.document.body.style.margin = '0';
		this._proxyPresenter.document.body.style.padding = '0';
		this._proxyPresenter.document.body.style.overflow = 'hidden';

		this._proxyPresenter.document.body.style.display = 'flex';
		this._proxyPresenter.document.body.style.flexDirection = 'column';
		this._proxyPresenter.document.body.style.minHeight = '100vh';
		this._proxyPresenter.document.body.style.minWidth = '100vw';

		let elem = this._proxyPresenter.document.querySelector('#main-content');
		elem.style.display = 'flex';
		elem.style.flexDirection = 'row';
		elem.style.flexWrap = 'wrap';
		elem.style.minWidth = '100vh';
		elem.style.minHeight = '100vw';

		elem = this._proxyPresenter.document.querySelector('#first-presentation');
		elem.style.display = 'flex';
		elem.style.flexDirection = 'column';
		elem.style.flex = '1';

		elem = this._proxyPresenter.document.querySelector('#second-presentation');
		elem.style.display = 'flex';
		elem.style.flexDirection = 'column';
		elem.style.flex = '1';

		elem = this._proxyPresenter.document.querySelector('#current-presentation');
		elem.style.height = '50%';
		elem.style.width = '100%';

		elem = this._proxyPresenter.document.querySelector('#timer');
		elem.style.textAlign = 'center';
		elem.style.verticalAlign = 'middle';
		elem.style.fontSize = 'large';
		elem.style.fontWeight = 'bold';
		elem.style.height = '50%';

		elem = this._proxyPresenter.document.querySelector('#next-presentation');
		elem.style.height = '50%';
		elem.style.width = '100%';

		elem = this._proxyPresenter.document.querySelector('#notes');
		elem.style.height = '50%';
		this._ticks = 0;
		this._onTimer();
	}

	_onKeyDown(e) {
		this._map.slideShowPresenter.getNavigator().onKeyDown(e);
	}

	_onClick(e) {
		this._map.slideShowPresenter.getNavigator().onClick(e);
	}

	_onTimer() {
		let sec, min, hour, elem;
		++this._ticks;
		sec = this._ticks % 60;
		min = Math.floor(this._ticks / 60);
		hour = Math.floor(min / 60);
		min = min % 60;

		elem = this._proxyPresenter.document.querySelector('#timer');
		if (elem) {
			elem.innerText =
				String(hour).padStart(2, '0') +
				':' +
				String(min).padStart(2, '0') +
				':' +
				String(sec).padStart(2, '0');
		}
	}

	_onWindowClose() {
		if (this._proxyPresenter && !this._proxyPresenter.closed)
			this._proxyPresenter.close();

		this._map.slideShowPresenter._stopFullScreen();
	}

	_onConsoleClose() {
		if (
			this._map.slideShowPresenter._slideShowWindowProxy &&
			!this._map.slideShowPresenter._slideShowWindowProxy.closed
		)
			this._map.slideShowPresenter._slideShowWindowProxy.close();

		this._proxyPresenter.removeEventListener(
			'click',
			L.bind(this._onClick, this),
		);
		this._proxyPresenter.removeEventListener(
			'keydown',
			L.bind(this._onKeyDown, this),
		);
		delete this._proxyPresenter;
	}

	_onEndTransition(e) {
		let notes = this._map.slideShowPresenter.getNotes(e.slide);
		let elem = this._proxyPresenter.document.querySelector('#notes');
		if (elem) {
			elem.innerText = notes;
		}
	}
}

SlideShow.PresenterConsole = PresenterConsole;
