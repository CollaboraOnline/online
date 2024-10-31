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
	constructor(map, presenter) {
		this._map = map;
		this._presenter = presenter;
		this._map.on('presentationinfo', this._onPresentationInfo, this);
		this._map.on('newpresentinconsole', this._onPresentInConsole, this);
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
                                     </div>
                                     <div id="second-presentation">
                                         <div id='container'>
                                            <img id="next-presentation"></img>
                                         </div>
                                         <div id='notes'></div>
                                     </div>
                                </main>
                                <div id="toolbar">
                                  <button type="button" id="prev" disabled>
                                     <img src="images/presenterscreen-ButtonSlidePreviousSelected.png">
                                     <label>Previous</label>
                                  </button>
                                  <button type="button" id="next" disabled>
                                     <img src="images/presenterscreen-ButtonEffectNextSelected.png">
                                     <label>Next</label>
                                  </button>
                                  <button type="button" id="notes-button" disabled>
                                     <img src="images/presenterscreen-ButtonNotesNormal.png">
                                     <label>Notes</label>
                                  </button>
                                  <button type="button" id="slides" disabled>
                                     <img src="images/presenterscreen-ButtonSlideSorterNormal.png">
                                     <label>Slides</label>
                                  </button>
                                  <div id="separator1"></div>
                                  <div id="timer-container">
                                     <div id="today"> </div>
                                     <div id="timer"></div>
                                  </div>
                                  <button type="button" id="restart" disabled>
                                     <img src="images/presenterscreen-ButtonRestartTimerNormal.png">
                                     <label>Restart</label>
                                  </button>
                                </div>
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

		this._map.on('newslideshowframe', this._onNextFrame, this);
		this._map.on('transitionstart', this._onTransitionStart, this);
		this._map.on('transitionend', this._onTransitionEnd, this);
		this._map.on('tilepreview', this._onTilePreview, this);

		this._computeCanvas(
			this._proxyPresenter.document.querySelector('#current-presentation'),
		);

		this._timer = setInterval(L.bind(this._onTimer, this), 1000);
		this._ticks = 0;

		this._previews = new Array(this._presenter._getSlidesCount());
		if (this._previews.length > 1) {
			let button = this._proxyPresenter.document.querySelector('#prev');
			button.disabled = false;
			button = this._proxyPresenter.document.querySelector('#next');
			button.disabled = false;
			button = this._proxyPresenter.document.querySelector('#restart');
			button.disabled = false;
		}
	}

	_onPresentInConsole() {
		this._map.fire('newpresentinwindow');

		let top = screen.height - 500;
		let left = screen.width - 800;
		this._proxyPresenter = window.open(
			'',
			'_blank',
			'toolbar=0,scrollbars=0,location=0,statusbar=0,menubar=0,' +
				'resizable=1,popup=true,width=800,height=500,left=' +
				left +
				',top=' +
				top,
		);
		if (!this._proxyPresenter) {
			this._presenter._notifyBlockedPresenting();
			return;
		}

		this._map.off('newpresentinconsole', this._onPresentInConsole, this);

		this._proxyPresenter.document.open();
		this._proxyPresenter.document.write(
			this._generateHtml(_('Presenter Console')),
		);
		this._proxyPresenter.document.close();

		this._currentSlideCanvas = this._proxyPresenter.document.querySelector(
			'#current-presentation',
		);
		this._currentSlideContext =
			this._currentSlideCanvas.getContext('bitmaprenderer');

		this._proxyPresenter.addEventListener(
			'resize',
			L.bind(this._onResize, this),
		);

		if (this._presenter._slideShowWindowProxy) {
			this._presenter._slideShowWindowProxy.addEventListener(
				'unload',
				L.bind(this._onWindowClose, this),
			);
		}
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
		let slideShowBGColor = window
			.getComputedStyle(document.documentElement)
			.getPropertyValue('--color-background-slideshow');
		let slideShowColor = window
			.getComputedStyle(document.documentElement)
			.getPropertyValue('--color-slideshow');

		elem.style.backgroundColor = slideShowBGColor;
		elem.style.color = slideShowColor;
		elem.style.display = 'flex';
		elem.style.flexDirection = 'row';
		elem.style.flexWrap = 'wrap';
		elem.style.minWidth = '100vw';
		elem.style.minHeight = '100vh';

		elem = this._proxyPresenter.document.querySelector('#first-presentation');
		elem.style.display = 'flex';
		elem.style.flexDirection = 'column';
		elem.style.flex = '1';

		elem = this._proxyPresenter.document.querySelector('#second-presentation');
		elem.style.display = 'flex';
		elem.style.flexDirection = 'column';
		elem.style.flex = '1';

		elem = this._proxyPresenter.document.querySelector('#current-presentation');
		elem.style.height = '50vh';
		elem.style.width = '50vw';

		elem = this._proxyPresenter.document.querySelector('#container');
		elem.style.height = '50vh';
		elem.style.width = '50vw';

		elem = this._proxyPresenter.document.querySelector('#notes');
		elem.style.height = '50%';

		elem = this._proxyPresenter.document.querySelector('#toolbar');
		elem.style.display = 'flex';
		elem.style.alignItems = 'center';
		elem.style.justifyContent = 'center';
		elem.style.backgroundColor = slideShowBGColor;
		elem.style.overflow = 'hidden';
		elem.style.position = 'fixed';
		elem.style.bottom = 0;
		elem.style.width = '100%';

		elem = this._proxyPresenter.document.querySelector('#prev');
		elem.style.display = 'flex';
		elem.style.flexDirection = 'column';
		elem.style.justifyContent = 'center';
		elem.style.alignItems = 'center';
		elem.style.backgroundColor = 'transparent';
		elem.style.border = 'none';
		elem.style.color = 'white';
		elem.addEventListener('click', L.bind(this._onPrev, this));

		elem = this._proxyPresenter.document.querySelector('#next');
		elem.style.display = 'flex';
		elem.style.flexDirection = 'column';
		elem.style.justifyContent = 'center';
		elem.style.alignItems = 'center';
		elem.style.backgroundColor = 'transparent';
		elem.style.border = 'none';
		elem.style.color = 'white';
		elem.addEventListener('click', L.bind(this._onNext, this));

		elem = this._proxyPresenter.document.querySelector('#notes-button');
		elem.style.display = 'flex';
		elem.style.flexDirection = 'column';
		elem.style.justifyContent = 'center';
		elem.style.alignItems = 'center';
		elem.style.backgroundColor = 'transparent';
		elem.style.border = 'none';
		elem.style.color = 'white';
		elem.addEventListener('click', L.bind(this._onNotes, this));

		elem = this._proxyPresenter.document.querySelector('#slides');
		elem.style.display = 'flex';
		elem.style.flexDirection = 'column';
		elem.style.justifyContent = 'center';
		elem.style.alignItems = 'center';
		elem.style.backgroundColor = 'transparent';
		elem.style.border = 'none';
		elem.style.color = 'white';
		elem.addEventListener('click', L.bind(this._onSlides, this));

		elem = this._proxyPresenter.document.querySelector('#separator1');
		elem.style.width = '1px';
		elem.style.height = '30px';
		elem.style.borderLeft = '1px';
		elem.style.borderColor = 'white';
		elem.style.borderStyle = 'solid';

		elem = this._proxyPresenter.document.querySelector('#timer-container');
		elem.style.height = '33px';

		elem = this._proxyPresenter.document.querySelector('#today');
		elem.style.paddingLeft = '4px';
		elem.style.paddingRight = '4px';
		elem.style.textAlign = 'center';
		elem.style.verticalAlign = 'middle';
		elem.style.fontSize = 'large';
		elem.style.fontWeight = 'bold';
		elem.style.color = 'white';

		elem = this._proxyPresenter.document.querySelector('#timer');
		elem.style.textAlign = 'center';
		elem.style.verticalAlign = 'middle';
		elem.style.fontSize = 'large';
		elem.style.fontWeight = 'bold';
		elem.style.color = 'yellow';

		elem = this._proxyPresenter.document.querySelector('#restart');
		elem.style.display = 'flex';
		elem.style.flexDirection = 'column';
		elem.style.justifyContent = 'center';
		elem.style.alignItems = 'center';
		elem.style.backgroundColor = 'transparent';
		elem.style.border = 'none';
		elem.style.color = 'white';
		elem.addEventListener('click', L.bind(this._onRestart, this));

		this._ticks = 0;
		this._onTimer();

		// simulate resize to Firefox
		this._onResize();
	}

	_onKeyDown(e) {
		this._presenter.getNavigator().onKeyDown(e);
	}

	_onClick(e) {
		this._presenter.getNavigator().onClick(e);
	}

	_onPrev(e) {
		this._presenter.getNavigator().rewindEffect();
		e.stopPropagation();
	}

	_onNext(e) {
		this._presenter.getNavigator().dispatchEffect();
		e.stopPropagation();
	}

	_onRestart(e) {
		this._ticks = 0;
		e.stopPropagation();
	}

	_onNotes() {}

	_onSlides() {}

	_onTimer() {
		if (!this._proxyPresenter) {
			return;
		}

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

		let dateTime = new Date();
		elem = this._proxyPresenter.document.querySelector('#today');
		elem.innerText = dateTime.toLocaleDateString(String.Locale, {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});

		if (this._ticks % 2 == 0 && typeof this._lastIndex !== 'undefined') {
			setTimeout(
				L.bind(
					this._fetchPreview,
					this,
					this._lastIndex + 1,
					this._proxyPresenter.document.querySelector('#next-presentation'),
				),
				0,
			);
		}
	}

	_fetchPreview(index, elem) {
		if (index >= this._presenter._getSlidesCount()) {
			return;
		}

		let rect = elem.getBoundingClientRect();
		if (rect.width === 0 && rect.height === 0) {
			return;
		}

		let preview = this._previews[index];
		if (preview) {
			this._lastIndex = index;
			return;
		}

		let size = this._map.getPreview(2000, 0, rect.width, rect.height, {
			fetchThumbnail: false,
			autoUpdate: false,
		});

		this._map.getPreview(2000, index, size.width, size.height, {
			autoUpdate: false,
			slideshow: true,
		});
	}

	_onWindowClose() {
		if (this._proxyPresenter && !this._proxyPresenter.closed)
			this._proxyPresenter.close();

		this._presenter._stopFullScreen();
	}

	_onConsoleClose() {
		if (
			this._presenter._slideShowWindowProxy &&
			!this._presenter._slideShowWindowProxy.closed
		)
			this._presenter._slideShowWindowProxy.close();

		this._proxyPresenter.removeEventListener(
			'resize',
			L.bind(this._onResize, this),
		);
		this._proxyPresenter.removeEventListener(
			'click',
			L.bind(this._onClick, this),
		);
		this._proxyPresenter.removeEventListener(
			'keydown',
			L.bind(this._onKeyDown, this),
		);
		delete this._proxyPresenter;
		delete this._currentIndex;
		delete this._lastIndex;
		delete this._previews;
		clearInterval(this._timer);
		this._map.off('newslideshowframe', this._onNextFrame, this);
		this._map.off('transitionstart', this._onTransitionStart, this);
		this._map.off('transitionend', this._onTransitionEnd, this);
		this._map.off('tilepreview', this._onTilePreview, this);
		this._map.on('newpresentinconsole', this._onPresentInConsole, this);
	}

	_onResize() {
		let container = this._proxyPresenter.document.querySelector('#container');
		if (!container) {
			return;
		}
		let rect = container.getBoundingClientRect();
		let next =
			this._proxyPresenter.document.querySelector('#next-presentation');
		if (next) {
			next.style.width = rect.width + 'px';
			next.style.height = rect.height + 'px';
			this.drawNext(next);
		}
	}

	_onTransitionStart(e) {
		if (!this._proxyPresenter) {
			return;
		}

		this._currentIndex = e.slide;

		let next =
			this._proxyPresenter.document.querySelector('#next-presentation');
		this._fetchPreview(this._currentIndex + 1, next);
	}

	_onTransitionEnd(e) {
		if (!this._proxyPresenter) {
			return;
		}

		this._currentIndex = e.slide;

		let notes = this._presenter.getNotes(e.slide);
		let elem = this._proxyPresenter.document.querySelector('#notes');
		if (elem) {
			elem.innerText = notes;
		}

		let next =
			this._proxyPresenter.document.querySelector('#next-presentation');
		this.drawNext(next);
	}

	drawNext(elem) {
		if (this._currentIndex === undefined) {
			return;
		}

		let rect = elem.getBoundingClientRect();
		if (rect.width === 0 && rect.height === 0) {
			requestAnimationFrame(this.drawNext.bind(this, elem));
			return;
		}

		let size = this._map.getPreview(2000, 0, rect.width, rect.height, {
			fetchThumbnail: false,
			autoUpdate: false,
		});

		if (this._currentIndex + 1 >= this._presenter._getSlidesCount()) {
			this.drawEnd(size).then(function (blob) {
				var reader = new FileReader();
				reader.onload = function (e) {
					elem.src = e.target.result;
				};
				reader.readAsDataURL(blob);
			});
			return;
		}

		let preview = this._previews[this._currentIndex + 1];
		if (!preview) {
			elem.src = document.querySelector('meta[name="previewImg"]').content;
		} else {
			elem.src = preview;
		}

		if (!preview || rect.width !== size.width || rect.height !== size.height) {
			this._map.getPreview(
				2000,
				this._currentIndex + 1,
				size.width,
				size.height,
				{
					autoUpdate: false,
					slideshow: true,
				},
			);
			elem.style.width = size.width + 'px';
			elem.style.height = size.height + 'px';
		}
	}

	drawEnd(size) {
		const width = size.width;
		const height = size.height;
		const offscreen = new OffscreenCanvas(width, height);
		const ctx = offscreen.getContext('2d');

		ctx.fillStyle = 'black';
		ctx.fillRect(0, 0, width, height);

		ctx.fillStyle = 'white';
		ctx.font = '20px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		ctx.fillText(_('Click to exit presentation...'), width / 2, height / 2);

		return offscreen.convertToBlob({ type: 'image/png' });
	}

	_onNextFrame(e) {
		const bitmap = e.frame;
		if (!bitmap) return;
		createImageBitmap(bitmap).then((image) => {
			this._currentSlideContext.transferFromImageBitmap(image);
		});
	}

	_onTilePreview(e) {
		if (!this._proxyPresenter) {
			return;
		}

		if (this._currentIndex === undefined) {
			return;
		}

		if (e.id !== '2000') {
			return;
		}

		if (this._currentIndex + 1 === e.part) {
			let next =
				this._proxyPresenter.document.querySelector('#next-presentation');
			next.src = e.tile.src;
		}

		this._previews[e.part] = e.tile.src;
		this._lastIndex = e.part;
	}

	_computeCanvas(canvas) {
		let rect = canvas.getBoundingClientRect();
		let size = this._presenter._slideCompositor.computeLayerResolution(
			rect.width,
			rect.height,
		);
		size = this._presenter._slideCompositor.computeLayerSize(size[0], size[1]);
		canvas.width = size[0];
		canvas.height = size[1];
	}
}

SlideShow.PresenterConsole = PresenterConsole;
