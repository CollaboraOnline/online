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
		this._map.on('slidecached', this._onSlideCached, this);
		this._map.on('transitionstart', this._onTransitionStart, this);
		this._map.on('tilepreview', this._onTilePreview, this);
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
                                         <div id='container'>
                                            <img id="next-presentation"></img>
                                         </div>
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

		this._computeCanvas(
			this._proxyPresenter.document.querySelector('#current-presentation'),
		);

		this._timer = setInterval(L.bind(this._onTimer, this), 1000);
		this._ticks = 0;

		this._previews = new Array(this._map.slideShowPresenter._getSlidesCount());
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

		this._proxyPresenter.addEventListener(
			'resize',
			L.bind(this._onResize, this),
		);
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
		elem.style.height = '50vh';
		elem.style.width = '50vw';

		elem = this._proxyPresenter.document.querySelector('#timer');
		elem.style.textAlign = 'center';
		elem.style.verticalAlign = 'middle';
		elem.style.fontSize = 'large';
		elem.style.fontWeight = 'bold';
		elem.style.height = '50%';

		elem = this._proxyPresenter.document.querySelector('#container');
		elem.style.height = '50vh';
		elem.style.width = '50vw';

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
		delete this._previews;
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

		this.drawImage(
			this._proxyPresenter.document.querySelector('#current-presentation'),
			e.slide,
		);

		let notes = this._map.slideShowPresenter.getNotes(e.slide);
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

		if (
			this._currentIndex + 1 >=
			this._map.slideShowPresenter._getSlidesCount()
		) {
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

	drawImage(canvas, slide) {
		const bitmap =
			this._map.slideShowPresenter._slideCompositor.getSlide(slide);
		if (bitmap) {
			createImageBitmap(bitmap).then(function (image) {
				let renderer = canvas.getContext('bitmaprenderer');
				renderer.transferFromImageBitmap(image);
			});
		}
	}

	_onSlideCached(e) {
		if (!this._proxyPresenter) {
			return;
		}

		if (this._currentIndex === undefined) {
			return;
		}

		let slide = this._map.slideShowPresenter._slideCompositor.getSlideInfo(
			e.slideHash,
		);

		if (this._currentIndex === slide.index) {
			this.drawImage(
				this._proxyPresenter.document.querySelector('#current-presentation'),
				slide.index,
			);
		}
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
			next.src = this._previews[this._currentIndex + 1] = e.tile.src;
		}
	}

	_computeCanvas(canvas) {
		let rect = canvas.getBoundingClientRect();
		let size =
			this._map.slideShowPresenter._slideCompositor.computeLayerResolution(
				rect.width,
				rect.height,
			);
		size = this._map.slideShowPresenter._slideCompositor.computeLayerSize(
			size[0],
			size[1],
		);
		canvas.width = size[0];
		canvas.height = size[1];
	}
}

SlideShow.PresenterConsole = PresenterConsole;
