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
                                  <div id="presentation-content">
                                    <div id="first-presentation">
										<div id="timer-container">
											<div id="timer"></div>
											 <div id="timer-controls">
												<button type="button" id="pause" disabled>
													<img src="images/presenterscreen-ButtonPauseTimerNormal.svg">
												</button>
												<button type="button" id="restart" disabled>
													<img src="images/presenterscreen-ButtonRestartTimerNormal.svg">
												</button>
											 </div>
											<div id="today"></div>
										</div>
                                        <div id='current-slide-container'>
                                            <canvas id="current-presentation"></canvas>
                                        </div>
										<div id="slideshow-control-container">
											<div id="navigation-container">
												<button type="button" id="prev" disabled>
													<img src="images/presenterscreen-ButtonSlidePreviousSelected.svg">
												</button>
												<div id="title-current">${labels[0]}</div>
												<button type="button" id="next" disabled>
													<img src="images/presenterscreen-ButtonEffectNextSelected.svg">
												</button>
											</div>
											<div id="action-buttons-container">
												<button type="button" id="notes" disabled>
													<img src="images/presenterscreen-ButtonNotesNormal.png">
													<label>${labels[4]}</label>
												</button>
												<button type="button" id="slides" disabled>
													<img src="images/presenterscreen-ButtonSlideSorterNormal.png">
													<label>${labels[5]}</label>
												</button>
											</div>
										</div>
									</div>
									<div id="notes-separator"></div>
                                     <div id="second-presentation">
                                         <div id="title-next">${labels[1]}</div>
                                         <div id='next-slide-container'>
                                            <img id="next-presentation"></img>
                                         </div>
                                    </div>
                                  </div>
                                  <div id="toolbar">
									<div id="separator"></div>
									<button type="button" id="help" disabled>
										<img src="images/presenterscreen-ButtonHelpNormal.png">
										<label>${labels[8]}</label>
									</button>
									<div id="separator"></div>
									<button type="button" id="exit" disabled>
										<img src="images/presenterscreen-ButtonExitPresenterNormal.png">
										<label>${labels[9]}</label>
									</button>
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
			let elem = this._slides.querySelector('#slides-preview');
			for (let index = 0; index < this._previews.length; index++) {
				img = this._proxyPresenter.document.createElement('img');
				img.src = document.querySelector('meta[name="previewImg"]').content;
				img.style.marginLeft = '10px';
				img.style.marginRight = '10px';
				img.style.marginTop = '10px';
				img.style.marginBottom = '10px';
				img.width = 100;
				img.height = 100;
				img._index = index;
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

		this._map.fire('enablecommand', {
			controlId: 'view-presentation-in-console',
			enable: false,
		});
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
		this.slideShowColor = window
			.getComputedStyle(document.documentElement)
			.getPropertyValue('--color-slideshow');
		let slideShowFontFamily = window
			.getComputedStyle(document.documentElement)
			.getPropertyValue('--cool-font');

		elem.style.backgroundColor = slideShowBGColor;
		elem.style.color = this.slideShowColor;
		elem.style.fontFamily = slideShowFontFamily;
		elem.style.display = 'flex';
		elem.style.flexDirection = 'column';
		elem.style.minWidth = '100vw';
		elem.style.minHeight = '100vh';

		elem = this._proxyPresenter.document.querySelector('#presentation-content');
		elem.style.display = 'flex';
		elem.style.flexWrap = 'wrap';
		elem.style.gap = '3vw';

		this._first = elem = this._proxyPresenter.document.querySelector(
			'#first-presentation',
		);
		elem.style.display = 'flex';
		elem.style.flexDirection = 'column';
		elem.style.flex = '1';
		// consistent gap between label and presentation preview
		elem.style.gap = '1vh';
		elem.style.marginTop = '8vh';
		elem.style.marginLeft = '2vw';

		// Apply common button style to every button in Current slide division
		let currentSlideActionButtons = this._first.querySelectorAll('button');
		currentSlideActionButtons.forEach((button) => {
			button.style.display = 'flex';
			button.style.flexDirection = 'column';
			button.style.alignItems = 'center';
			button.style.backgroundColor = 'transparent';
			button.style.color = this.slideShowColor;
			button.style.border = 'none';
		});

		elem = this._proxyPresenter.document.querySelector('#title-current');
		elem.style.display = 'flex';
		elem.style.flexDirection = 'column';
		elem.style.justifyContent = 'center';
		elem.style.alignItems = 'center';
		elem.style.backgroundColor = 'transparent';
		elem.style.color = this.slideShowColor;
		elem.style.fontSize = '22px';

		elem = this._proxyPresenter.document.querySelector(
			'#current-slide-container',
		);
		// this will handle the responsiveness on resize for current-presentation window
		elem.style.width = '56vw';
		elem.style.height = '67vh';

		// slideshow-control-container
		let slideshowControlContainer = this._proxyPresenter.document.querySelector(
			'#slideshow-control-container',
		);
		slideshowControlContainer.style.display = 'flex';
		slideshowControlContainer.style.gap = '2vw';
		slideshowControlContainer.style.alignItems = 'center';
		slideshowControlContainer.style.marginTop = '1vh';

		// Select the parent container by its ID
		let navigationContainer = this._proxyPresenter.document.getElementById(
			'navigation-container',
		);

		// Add the necessary styles to make elements appear in a row
		navigationContainer.style.display = 'flex';
		navigationContainer.style.width = 'max-content';
		navigationContainer.style.alignItems = 'center';
		navigationContainer.style.gap = '0.5vw'; // Adjust gap as needed

		// Select all button elements inside #navigation-container
		let navigationButtons = this._proxyPresenter.document.querySelectorAll(
			'#navigation-container button',
		);

		// Apply additional style for navigation button
		navigationButtons.forEach((button) => {
			button.style.width = '2.5vw';
			button.style.height = '5.5vh';
			button.style.border = '1px solid';
			button.style.borderColor = this.slideShowColor;
			button.style.borderRadius = '2.5vw';
			button.style.justifyContent = 'center';
		});

		// slideshow-control-container
		let actionBtnContainer = this._proxyPresenter.document.querySelector(
			'#action-buttons-container',
		);
		actionBtnContainer.style.display = 'flex';
		actionBtnContainer.style.gap = '1vw';

		this._first.addEventListener('click', L.bind(this._onToolbarClick, this));

		let notesSeparator =
			this._proxyPresenter.document.querySelector('#notes-separator');
		notesSeparator.style.backgroundColor = 'transparent';
		notesSeparator.style.color = 'transparent';
		notesSeparator.style.border = '1px solid';
		notesSeparator.style.margin = '8vh 0vw';
		notesSeparator.style.height = '80vh';

		this._second = elem = this._proxyPresenter.document.querySelector(
			'#second-presentation',
		);
		elem.style.display = 'flex';
		elem.style.flexDirection = 'column';
		elem.style.flex = '1';
		// consistent gap between label and presentation preview
		elem.style.gap = '1vh';
		elem.style.marginTop = '8vh';

		elem = this._proxyPresenter.document.querySelector('#title-next');
		elem.style.display = 'flex';
		elem.style.flexDirection = 'column';
		elem.style.backgroundColor = 'transparent';
		elem.style.color = this.slideShowColor;
		elem.style.height = '35px';
		elem.style.fontSize = '22px';
		elem.style.justifyContent = 'center';

		elem = this._proxyPresenter.document.querySelector('#next-slide-container');
		elem.style.width = '25vw';
		elem.style.height = '50vh';
		elem.style.display = 'flex';
		elem.style.flexDirection = 'column';
		elem.style.gap = '2vh';

		this._notes = this._proxyPresenter.document.createElement('div');
		this._notes.style.height = '50vh';
		this._notes.style.width = '25vw';
		this._notes.style.paddingTop = '10px';
		this._notes.style.borderTop = '2px solid transparent';

		elem = this._proxyPresenter.document.createElement('div');
		elem.id = 'notes';
		elem.style.height = '90%';
		elem.style.width = '100%';

		this._notes.appendChild(elem);
		elem = this._proxyPresenter.document.createElement('div');
		elem.style.textAlign = 'center';

		this._notes.appendChild(elem);

		this._slides = this._proxyPresenter.document.createElement('div');
		this._slides.style.height = '100%';
		this._slides.style.width = '100%';
		elem = this._proxyPresenter.document.createElement('div');
		elem.id = 'slides-preview';
		elem.style.overflow = 'auto';
		elem.style.height = '80vh';
		elem.style.width = '100%';
		this._slides.appendChild(elem);
		this._slides.addEventListener('click', L.bind(this._onClickSlides, this));
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
		elem.style.gap = '1vw';
		elem.addEventListener('click', L.bind(this._onToolbarClick, this));

		let list = this._proxyPresenter.document.querySelectorAll('button');
		for (elem = 0; elem < list.length; elem++) {
			list[elem].style.display = 'flex';
			list[elem].style.flexDirection = 'column';
			list[elem].style.justifyContent = 'center';
			list[elem].style.alignItems = 'center';
			list[elem].style.backgroundColor = 'transparent';
			list[elem].style.color = this.slideShowColor;
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
		elem.style.display = 'flex';
		elem.style.alignItems = 'center';
		elem.style.width = '100%';
		elem.style.gap = '15px';

		elem = this._proxyPresenter.document.querySelector('#timer');
		elem.style.fontSize = '22px';
		elem.style.color = this.slideShowColor;

		let timeControlElem =
			this._proxyPresenter.document.querySelector('#timer-controls');
		timeControlElem.style.display = 'flex';
		timeControlElem.style.alignItems = 'center';
		timeControlElem.style.gap = '5px';

		timeControlElem.addEventListener(
			'click',
			L.bind(this._onToolbarClick, this),
		);

		// Style buttons in slideshow control container
		const buttons = timeControlElem.querySelectorAll('button');
		buttons.forEach(
			function (button) {
				button.style.display = 'flex';
				button.style.flexDirection = 'column';
				button.style.alignItems = 'center';
				button.style.justifyContent = 'center';
				button.style.backgroundColor = 'transparent';
				button.style.borderColor = 'none';
			}.bind(this),
		);

		elem = this._proxyPresenter.document.querySelector('#today');
		elem.style.textAlign = 'right';
		elem.style.fontSize = '22px';
		elem.style.marginLeft = 'auto';
		elem.style.color = this.slideShowColor;

		this._ticks = 0;
		this._onTimer();

		// simulate resize to Firefox
		this._onResize();
	}

	_pauseButton() {
		// Update the image source
		let imgElem = this._proxyPresenter.document.querySelector('#pause>img');
		if (imgElem) {
			imgElem.src = this._pause
				? 'images/presenterscreen-ButtonResumeTimerNormal.svg'
				: 'images/presenterscreen-ButtonPauseTimerNormal.svg';
		}
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
				this._pauseButton();
				break;
			case 'restart':
				this._pause = false;
				this._ticks = 0;
				this._pauseButton();
				break;
			case 'exit':
				this._proxyPresenter.close();
				break;
			case 'help':
				// TODO. add help.collaboraonline.com
				window.open('https://collaboraonline.com', '_blank');
				break;
			case 'notes':
				if (this._proxyPresenter.document.contains(this._notes)) {
					this._onHideNotes();
				} else {
					this._onShowNotes();
				}
				break;
			case 'slides':
				// toggle based on slides preview present or not
				if (this._proxyPresenter.document.querySelector('#slides-preview')) {
					this._onHideSlides();
				} else {
					this._onShowSlides();
				}
				break;
		}

		e.stopPropagation();
	}

	_onShowSlides() {
		let elem = this._proxyPresenter.document.querySelector('#slides');
		this.toggleButtonState(elem, true);

		elem = this._proxyPresenter.document.querySelector('#next-presentation');
		let rect = elem.getBoundingClientRect();
		let size = this._map.getPreview(2000, 0, rect.width, rect.height, {
			fetchThumbnail: false,
			autoUpdate: false,
		});

		let notesSeparator =
			this._proxyPresenter.document.querySelector('#notes-separator');
		notesSeparator.remove();
		this._first.remove();
		this._second.remove();

		elem = this._proxyPresenter.document.querySelector('#presentation-content');
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

	_onHideSlides(img) {
		let elem = this._proxyPresenter.document.querySelector(
			'#presentation-content',
		);

		this._slides.remove();
		let notesSeparator =
			this._proxyPresenter.document.querySelector('#notes-separator');
		elem.appendChild(this._first);
		elem.appendChild(notesSeparator);
		elem.appendChild(this._second);

		elem = this._proxyPresenter.document.querySelector('#slides');
		this.toggleButtonState(elem, false);

		if (img) {
			requestAnimationFrame(
				function (navigator, index) {
					navigator.displaySlide(index, true);
				}.bind(null, this._presenter.getNavigator(), img._index),
			);
		}
	}

	_onClickSlides(e) {
		if (e.target && e.target.localName === 'img') {
			setTimeout(L.bind(this._onHideSlides, this, e.target), 0);
		}

		e.stopPropagation();
	}

	_onShowNotes() {
		let elem = this._proxyPresenter.document.querySelector('#notes');
		this.toggleButtonState(elem, true);

		let container = this._proxyPresenter.document.querySelector(
			'#next-slide-container',
		);
		this._notes.style.borderTopColor = this.slideShowColor;

		let notesSeparator =
			this._proxyPresenter.document.querySelector('#notes-separator');
		notesSeparator.style.color = this.slideShowColor;

		container.appendChild(this._notes);
		this._onResize();
	}

	_onHideNotes(e) {
		let notesSeparator =
			this._proxyPresenter.document.querySelector('#notes-separator');
		notesSeparator.style.color = 'transparent';

		this._notes.style.borderTopColor = 'transparent';

		this._notes.remove();

		let elem = this._proxyPresenter.document.querySelector('#notes');
		this.toggleButtonState(elem, false);
		this._onResize();

		if (e) {
			e.stopPropagation();
		}
	}

	toggleButtonState(elem, toggleOn) {
		if (toggleOn) {
			// Apply the 'selected' styles on show notes to display toggle effect on button
			elem.style.filter = 'invert(1)';
			elem.style.backgroundColor = 'black';
			elem.disable = true;
		} else {
			elem.style.filter = '';
			elem.style.backgroundColor = 'transparent';
			elem.disable = false;
		}
	}

	_onTimer() {
		if (!this._proxyPresenter) {
			return;
		}

		if (!this._pause) {
			++this._ticks;
		}

		requestAnimationFrame(this._drawClock.bind(this));
	}

	_drawClock() {
		if (!this._proxyPresenter || !this._proxyPresenter.document) {
			return;
		}

		let sec, min, hour, elem;
		if (!this._pause) {
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
			elem.innerText = dateTime.toLocaleTimeString(String.Locale, {
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
		this._map.fire('enablecommand', {
			controlId: 'view-presentation-in-console',
			enable: true,
		});
	}

	_resizeSlideView(viewContainerId, slideViewId) {
		let container = this._proxyPresenter.document.querySelector(
			'#' + viewContainerId,
		);
		if (!container) {
			return;
		}
		let rect = container.getBoundingClientRect();
		let size = this._map.getPreview(2000, 0, rect.width, rect.height, {
			fetchThumbnail: false,
			autoUpdate: false,
		});
		let slideView = this._proxyPresenter.document.querySelector(
			'#' + slideViewId,
		);
		if (slideView) {
			slideView.style.width = size.width + 'px';
			slideView.style.height = size.height + 'px';
		}
	}

	_onResize() {
		this._resizeSlideView('current-slide-container', 'current-presentation');
		this._resizeSlideView('next-slide-container', 'next-presentation');
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
				_('Slide') +
				' ' +
				(e.slide + 1) +
				' ' +
				_('of') +
				' ' +
				this._previews.length;
		}

		if (this._notes) {
			let notes = this._presenter.getNotes(e.slide);
			if (notes) elem = this._notes.querySelector('#notes');
			if (elem) {
				elem.innerText =
					notes.toLowerCase() === 'click to add notes'.toLowerCase()
						? 'No Notes'
						: notes;
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

		// We need to resize the frame to the current slide canvas size explicitly.
		// In fact, in Firefox transferFromImageBitmap does not resize it
		// automatically to the set canvas size as it occurs in Chrome.
		// According to Firefox version we can have 2 different behavior:
		// on older versions (like 115) the frame is cropped wrt the canvas size
		// on newer versions (like 121) the canvas is automatically resized to
		// frame size, the latter case can lead to worse performance.
		createImageBitmap(bitmap, {
			resizeWidth: this._currentSlideCanvas.width,
			resizeHeight: this._currentSlideCanvas.height,
		}).then((image) => {
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

		let elem = this._slides.querySelector('#slides-preview');
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
