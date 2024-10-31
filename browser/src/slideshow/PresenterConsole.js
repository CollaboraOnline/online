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
		let labels = [
			_('Current Slide'),
			_('Next Slide'),
			_('Previous'),
			_('Next'),
			_('Notes'),
			_('Slides'),
			_('Pause'),
			_('Restart'),
			_('Exchange'),
			_('Help'),
			_('Exit'),
		];
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
                                         <div id="title-current">${labels[0]}</div>
                                         <canvas id="current-presentation"></canvas>
                                     </div>
                                     <div id="second-presentation">
                                         <div id="title-next">${labels[1]}</div>
                                         <div id='container'>
                                            <img id="next-presentation"></img>
                                         </div>
                                     </div>
                                </main>
                                <div id="toolbar">
                                  <button type="button" id="prev" disabled>
                                     <img src="images/presenterscreen-ButtonSlidePreviousSelected.png">
                                     <label>${labels[2]}</label>
                                  </button>
                                  <button type="button" id="next" disabled>
                                     <img src="images/presenterscreen-ButtonEffectNextSelected.png">
                                     <label>${labels[3]}</label>
                                  </button>
                                  <button type="button" id="notes" disabled>
                                     <img src="images/presenterscreen-ButtonNotesNormal.png">
                                     <label>${labels[4]}</label>
                                  </button>
                                  <button type="button" id="slides" disabled>
                                     <img src="images/presenterscreen-ButtonSlideSorterNormal.png">
                                     <label>${labels[5]}</label>
                                  </button>
                                  <div id="separator"></div>
                                  <div id="timer-container">
                                     <div id="today"> </div>
                                     <div id="timer"></div>
                                  </div>
                                  <button type="button" id="pause" disabled>
                                     <img src="images/presenterscreen-ButtonPauseTimerNormal.png">
                                     <label>${labels[6]}</label>
                                  </button>
                                  <button type="button" id="restart" disabled>
                                     <img src="images/presenterscreen-ButtonRestartTimerNormal.png">
                                     <label>${labels[7]}</label>
                                  </button>
                                  <div id="separator"></div>
                                  <button type="button" id="exchange" disabled>
                                     <img src="images/presenterscreen-ButtonSwitchMonitorNormal.png">
                                     <label>${labels[8]}</label>
                                  </button>
                                  <div id="separator"></div>
                                  <button type="button" id="help" disabled>
                                     <img src="images/presenterscreen-ButtonHelpNormal.png">
                                     <label>${labels[9]}</label>
                                  </button>
                                  <div id="separator"></div>
                                  <button type="button" id="exit" disabled>
                                     <img src="images/presenterscreen-ButtonExitPresenterNormal.png">
                                     <label>${labels[10]}</label>
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
		this._pause = false;

		this._previews = new Array(this._presenter._getSlidesCount());
		if (this._previews.length > 1) {
			let list = this._proxyPresenter.document.querySelectorAll('button');
			for (let index = 0; index < list.length; index++) {
				list[index].disabled = false;
			}
		}

		if (this._slides) {
			let img;
			let elem = this._slides.querySelector('#slides');
			for (let index = 0; index < this._previews.length; index++) {
				img = this._proxyPresenter.document.createElement('img');
				img.src = document.querySelector('meta[name="previewImg"]').content;
				img.style.marginLeft = '10px';
				img.style.marginRight = '10px';
				img.style.marginTop = '10px';
				img.style.marginBottom = '10px';
				img.width = 100;
				img.height = 100;
				elem.append(img);
			}
		}
	}

	_onPresentInConsole() {
		this._map.fire('newpresentinwindow');
		if (!this._presenter._slideShowWindowProxy) {
			return;
		}

		this._proxyPresenter = window.open(
			'',
			'_blank',
			'toolbar=0,scrollbars=0,location=0,statusbar=0,menubar=0,resizable=1,popup=true',
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

		this._first = elem = this._proxyPresenter.document.querySelector(
			'#first-presentation',
		);
		elem.style.display = 'flex';
		elem.style.flexDirection = 'column';
		elem.style.flex = '1';
		elem.style.height = '100vh';
		elem.style.width = '60vw';
		elem.style.marginTop = '5vw';
		elem.style.marginLeft = elem.style.marginRight = '2vw';

		elem = this._proxyPresenter.document.querySelector('#title-current');
		elem.style.display = 'flex';
		elem.style.flexDirection = 'column';
		elem.style.justifyContent = 'center';
		elem.style.alignItems = 'center';
		elem.style.backgroundColor = 'transparent';
		elem.style.color = 'white';

		elem = this._proxyPresenter.document.querySelector('#current-presentation');
		elem.style.width = '56vw';

		this._second = elem = this._proxyPresenter.document.querySelector(
			'#second-presentation',
		);
		elem.style.display = 'flex';
		elem.style.flexDirection = 'column';
		elem.style.alignItems = 'center';
		elem.style.flex = '1';
		elem.style.height = '100vh';
		elem.style.width = '40vw';
		elem.style.marginTop = '5vw';
		elem.style.marginLeft = elem.style.marginRight = '2vw';

		elem = this._proxyPresenter.document.querySelector('#title-next');
		elem.style.display = 'flex';
		elem.style.flexDirection = 'column';
		elem.style.justifyContent = 'center';
		elem.style.alignItems = 'center';
		elem.style.backgroundColor = 'transparent';
		elem.style.color = 'white';

		elem = this._proxyPresenter.document.querySelector('#container');
		elem.style.width = '25vw';
		elem.style.height = '50vh';

		this._notes = this._proxyPresenter.document.createElement('div');
		this._notes.style.height = '80%';
		this._notes.style.width = '100%';
		elem = this._proxyPresenter.document.createElement('div');
		elem.id = 'notes';
		elem.style.height = '90%';
		elem.style.width = '100%';
		this._notes.appendChild(elem);
		elem = this._proxyPresenter.document.createElement('div');
		elem.style.textAlign = 'center';
		let button = this._proxyPresenter.document.createElement('button');
		button.innerText = _('Close');
		button.addEventListener('click', L.bind(this._onHideNotes, this));
		elem.appendChild(button);
		this._notes.appendChild(elem);

		this._slides = this._proxyPresenter.document.createElement('div');
		this._slides.style.height = '100%';
		this._slides.style.width = '100%';
		elem = this._proxyPresenter.document.createElement('div');
		elem.id = 'slides';
		elem.style.overflow = 'auto';
		elem.style.height = '80vh';
		elem.style.width = '100%';
		this._slides.appendChild(elem);
		this._slides.addEventListener('click', L.bind(this._onClickSlides, this));
		elem = this._proxyPresenter.document.createElement('div');
		elem.style.textAlign = 'center';
		button = this._proxyPresenter.document.createElement('button');
		button.innerText = _('Close');
		button.addEventListener('click', L.bind(this._onHideSlides, this));
		elem.appendChild(button);
		this._slides.appendChild(elem);

		elem = this._proxyPresenter.document.querySelector('#toolbar');
		elem.style.display = 'flex';
		elem.style.alignItems = 'center';
		elem.style.justifyContent = 'center';
		elem.style.backgroundColor = slideShowBGColor;
		elem.style.overflow = 'hidden';
		elem.style.position = 'fixed';
		elem.style.bottom = 0;
		elem.style.width = '100%';
		elem.addEventListener('click', L.bind(this._onToolbarClick, this));

		let list = this._proxyPresenter.document.querySelectorAll('button');
		for (elem = 0; elem < list.length; elem++) {
			list[elem].style.display = 'flex';
			list[elem].style.flexDirection = 'column';
			list[elem].style.justifyContent = 'center';
			list[elem].style.alignItems = 'center';
			list[elem].style.backgroundColor = 'transparent';
			list[elem].style.border = 'none';
			list[elem].style.color = 'white';
		}

		list = this._proxyPresenter.document.querySelectorAll('[id=separator]');
		for (elem = 0; elem < list.length; elem++) {
			list[elem].style.width = '1px';
			list[elem].style.height = '30px';
			list[elem].style.borderLeft = '1px';
			list[elem].style.borderColor = 'white';
			list[elem].style.borderStyle = 'solid';
		}

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

	_onToolbarClick(e) {
		let target = e.target;
		if (!target) {
			return;
		}

		if (target.localName !== 'button') {
			target = target.parentElement;
		}

		if (target.localName !== 'button') {
			return;
		}

		switch (target.id) {
			case 'prev':
				this._presenter.getNavigator().rewindEffect();
				break;
			case 'next':
				this._presenter.getNavigator().dispatchEffect();
				break;
			case 'pause':
				this._pause = !this._pause;
				break;
			case 'exchange':
				this._presenter._slideShowWindowProxy.focus();
				break;
			case 'restart':
				this._ticks = 0;
				break;
			case 'exit':
				this._proxyPresenter.close();
				break;
			case 'help':
				// TODO. add help.collaboraonline.com
				window.open('https://collaboraonline.com', '_blank');
				break;
			case 'notes':
				this._onShowNotes();
				break;
			case 'slides':
				this._onShowSlides();
				break;
		}

		e.stopPropagation();
	}

	_onShowSlides() {
		let elem = this._proxyPresenter.document.querySelector('#slides');
		elem.disable = true;

		elem = this._proxyPresenter.document.querySelector('#next-presentation');
		let rect = elem.getBoundingClientRect();
		let size = this._map.getPreview(2000, 0, rect.width, rect.height, {
			fetchThumbnail: false,
			autoUpdate: false,
		});

		this._first.remove();
		this._second.remove();

		elem = this._proxyPresenter.document.querySelector('#main-content');
		elem.appendChild(this._slides);

		let preview;
		for (let index = 0; index < this._previews.length; index++) {
			preview = this._previews[index];
			if (
				!preview ||
				rect.width !== size.width ||
				rect.height !== size.height
			) {
				this._map.getPreview(2000, index, size.width, size.height, {
					autoUpdate: false,
					slideshow: true,
				});
			}
		}
	}

	_onHideSlides(e) {
		let elem = this._proxyPresenter.document.querySelector('#main-content');
		let selection = this._proxyPresenter.document.getSelection();
		if (selection && selection.rangeCount > 1) {
			let range = selection.getRangeAt(0);
			if (range) {
				this._presenter.getNavigator().displaySlide(range.startOffset, true);
			}
		}

		this._slides.remove();
		elem.appendChild(this._first);
		elem.appendChild(this._second);

		elem = this._proxyPresenter.document.querySelector('#slides');
		elem.disable = false;
		e.stopPropagation();
	}

	_onClickSlides(e) {
		if (e.target && e.target.localName === 'img') {
			this._proxyPresenter.document.getSelection().empty();
			let range = document.createRange();
			range.selectNode(e.target);
			this._proxyPresenter.document.getSelection().addRange(range);
		}

		e.stopPropagation();
	}

	_onShowNotes() {
		let elem = this._proxyPresenter.document.querySelector('#notes');
		elem.disable = true;

		let title = this._proxyPresenter.document.querySelector('#title-next');
		title.remove();

		let container = this._proxyPresenter.document.querySelector('#container');
		container.remove();

		elem = this._proxyPresenter.document.querySelector('#first-presentation');
		elem.style.justifyContent = 'center';
		elem.style.alignItems = 'center';
		elem.style.marginTop = '1vw';
		elem.style.width = '50vw';

		elem.appendChild(title);
		elem.appendChild(container);

		elem = this._proxyPresenter.document.querySelector('#current-presentation');
		elem.style.width = '50vw';

		elem = this._proxyPresenter.document.querySelector('#second-presentation');
		elem.appendChild(this._notes);
		this._onResize();
	}

	_onHideNotes(e) {
		let title = this._proxyPresenter.document.querySelector('#title-next');
		title.remove();

		let container = this._proxyPresenter.document.querySelector('#container');
		container.remove();

		this._notes.remove();

		let elem = this._proxyPresenter.document.querySelector(
			'#first-presentation',
		);
		elem.style.justifyContent = '';
		elem.style.alignItems = '';
		elem.style.marginTop = '5vw';
		elem.style.width = '60vw';

		elem = this._proxyPresenter.document.querySelector('#current-presentation');
		elem.style.width = '56vw';

		elem = this._proxyPresenter.document.querySelector('#second-presentation');
		elem.appendChild(title);
		elem.appendChild(container);
		elem = this._proxyPresenter.document.querySelector('#notes');
		elem.disable = false;
		this._onResize();
		e.stopPropagation();
	}

	_onTimer() {
		if (!this._proxyPresenter) {
			return;
		}

		let sec, min, hour, elem;

		if (!this._pause) {
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

		let dateTime = new Date();
		elem = this._proxyPresenter.document.querySelector('#today');
		if (elem) {
			elem.innerText = dateTime.toLocaleDateString(String.Locale, {
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
			});
		}

		let next =
			this._proxyPresenter.document.querySelector('#next-presentation');
		if (
			this._ticks % 2 == 0 &&
			typeof this._lastIndex !== 'undefined' &&
			next
		) {
			setTimeout(
				L.bind(this._fetchPreview, this, this._lastIndex + 1, next),
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
		let size = this._map.getPreview(2000, 0, rect.width, rect.height, {
			fetchThumbnail: false,
			autoUpdate: false,
		});
		let next =
			this._proxyPresenter.document.querySelector('#next-presentation');
		if (next) {
			next.style.width = size.width + 'px';
			next.style.height = size.height + 'px';
		}
	}

	_onTransitionStart(e) {
		if (!this._proxyPresenter) {
			return;
		}

		this._currentIndex = e.slide;

		let elem =
			this._proxyPresenter.document.querySelector('#next-presentation');
		if (elem) {
			this._fetchPreview(this._currentIndex + 1, elem);
		}
	}

	_onTransitionEnd(e) {
		if (!this._proxyPresenter) {
			return;
		}

		this._currentIndex = e.slide;

		let elem = this._proxyPresenter.document.querySelector('#title-current');
		if (elem) {
			elem.innerText =
				_('Current Slide, Slide') +
				' ' +
				(e.slide + 1) +
				', ' +
				this._previews.length;
		}

		if (this._notes) {
			let notes = this._presenter.getNotes(e.slide);
			elem = this._notes.querySelector('#notes');
			if (elem) {
				elem.innerText = notes;
			}
		}

		let next =
			this._proxyPresenter.document.querySelector('#next-presentation');
		this.drawNext(next);
	}

	drawNext(elem) {
		if (!elem) {
			return;
		}

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
			if (next) {
				next.src = e.tile.src;
			}
		}

		this._previews[e.part] = e.tile.src;
		this._lastIndex = e.part;

		let elem = this._slides.querySelector('#slides');
		let img = elem.children.item(e.part);
		if (img) {
			img.src = e.tile.src;
			img.width = e.width;
			img.height = e.height;
		}
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
