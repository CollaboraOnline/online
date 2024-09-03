/* -*- tab-width: 4 -*- */

/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

declare var app: any;

class SlideShowNavigator {
	private theMetaPres: MetaPresentation = null;
	private slideShowHandler: SlideShowHandler;
	private presenter: SlideShowPresenter;
	private keyHandlerMap: Record<string, () => void>;
	private _canvasClickHandler: MouseClickHandler;
	private currentSlide: number;
	private prevSlide: number;

	constructor(slideShowHandler: SlideShowHandler) {
		this.slideShowHandler = slideShowHandler;
		this.currentSlide = undefined;
		this.prevSlide = undefined;
		this.initKeyMap();
		this.addHandlers();
	}

	private initKeyMap() {
		this.keyHandlerMap = {
			ArrowLeft: this.rewindEffect.bind(this),
			ArrowRight: this.dispatchEffect.bind(this),
			ArrowUp: this.rewindEffect.bind(this),
			ArrowDown: this.skipEffect.bind(this),
			PageUp: this.rewindAllEffects.bind(this),
			PageDown: this.skipAllEffects.bind(this),
			Home: this.goToFirstSlide.bind(this),
			End: this.goToLastSlide.bind(this),
			Space: this.dispatchEffect.bind(this),
			Backspace: this.rewindEffect.bind(this),
			Escape: this.quit.bind(this),
		};
	}

	private addHandlers() {
		this._canvasClickHandler = {
			handleClick: this.clickHandler.bind(this),
		};
	}

	private removeHandlers() {
		this._canvasClickHandler.handleClick = null;
	}

	public setMetaPresentation(metaPres: MetaPresentation) {
		this.theMetaPres = metaPres;
	}

	public get currentSlideIndex(): number {
		return this.currentSlide;
	}

	public get canvasClickHandler(): MouseClickHandler {
		return this._canvasClickHandler;
	}

	dispatchEffect() {
		NAVDBG.print(
			'SlideShowNavigator.dispatchEffect: current index: ' + this.currentSlide,
		);
		const bRet = this.slideShowHandler.nextEffect();
		if (!bRet) {
			this.switchSlide(1, false);
		}
	}

	skipEffect() {
		NAVDBG.print(
			'SlideShowNavigator.skipEffect: current index: ' + this.currentSlide,
		);
		const bRet = this.slideShowHandler.skipPlayingOrNextEffect();
		if (!bRet) {
			this.switchSlide(1, true);
		}
	}

	skipAllEffects() {
		NAVDBG.print(
			'SlideShowNavigator.skipAllEffects: current index: ' + this.currentSlide,
		);
		const bRet = this.slideShowHandler.skipAllEffects();
		if (!bRet) {
			this.switchSlide(1, true);
		}
	}

	rewindEffect() {
		NAVDBG.print(
			'SlideShowNavigator.rewindEffect: current index: ' + this.currentSlide,
		);
		if (this.backToLastSlide()) return;
		this.slideShowHandler.rewindEffect();
	}

	rewindAllEffects() {
		NAVDBG.print(
			'SlideShowNavigator.rewindAllEffects: current index: ' +
				this.currentSlide,
		);
		if (this.backToLastSlide()) return;
		this.slideShowHandler.rewindAllEffects();
	}

	goToFirstSlide() {
		NAVDBG.print(
			'SlideShowNavigator.goToFirstSlide: current index: ' + this.currentSlide,
		);
		this.displaySlide(0, true);
	}

	goToLastSlide() {
		NAVDBG.print(
			'SlideShowNavigator.goToLastSlide: current index: ' + this.currentSlide,
		);
		this.displaySlide(this.theMetaPres.numberOfSlides - 1, true);
	}

	private backToLastSlide(): boolean {
		if (this.currentSlide >= this.theMetaPres.numberOfSlides) {
			this.goToLastSlide();
			return true;
		}
		return false;
	}

	quit() {
		NAVDBG.print(
			'SlideShowNavigator.quit: current index: ' + this.currentSlide,
		);
		this.endPresentation(true);
	}

	switchSlide(nOffset: number, bSkipTransition: boolean) {
		NAVDBG.print('SlideShowNavigator.switchSlide: nOffset: ' + nOffset);
		this.displaySlide(this.currentSlide + nOffset, bSkipTransition);
	}

	displaySlide(nNewSlide: number, bSkipTransition: boolean) {
		NAVDBG.print(
			'SlideShowNavigator.displaySlide: current index: ' +
				this.currentSlide +
				', nNewSlide: ' +
				nNewSlide +
				', bSkipTransition: ' +
				bSkipTransition,
		);
		if (nNewSlide === undefined || nNewSlide < 0) return;
		if (nNewSlide >= this.theMetaPres.numberOfSlides) {
			this.currentSlide = nNewSlide;
			const force = nNewSlide > this.theMetaPres.numberOfSlides;
			this.endPresentation(force);
			return;
		}
		this.slideCompositor.fetchAndRun(nNewSlide, () => {
			assert(
				this instanceof SlideShowNavigator,
				'SlideShowNavigator.displaySlide: slideCompositor.fetchAndRun: ' +
					'callback: this is not a SlideShowNavigator instance',
			);

			this.prevSlide = this.currentSlide;
			if (this.prevSlide >= this.theMetaPres.numberOfSlides)
				this.prevSlide = undefined;
			this.currentSlide = nNewSlide;
			this.slideShowHandler.displaySlide(
				this.currentSlide,
				this.prevSlide,
				bSkipTransition,
			);
		});
	}

	startPresentation(nStartSlide: number, bSkipTransition: boolean) {
		NAVDBG.print(
			'SlideShowNavigator.startPresentation: current index: ' +
				this.currentSlide +
				', nStartSlide: ' +
				nStartSlide,
		);
		this.slideShowHandler.isStarting = true;
		this.displaySlide(nStartSlide, false);
	}

	endPresentation(force: boolean = false) {
		this.presenter.endPresentation(force);
	}

	onClick(aEvent: MouseEvent) {
		aEvent.preventDefault();
		aEvent.stopPropagation();

		const metaSlide = this.theMetaPres.getMetaSlideByIndex(this.currentSlide);
		if (!metaSlide)
			window.app.console.log(
				'SlideShowNavigator.onClick: no meta slide available for index: ' +
					this.currentSlide,
			);

		if (metaSlide && metaSlide.animationsHandler) {
			const aEventMultiplexer = metaSlide.animationsHandler.eventMultiplexer;
			if (aEventMultiplexer) {
				if (aEventMultiplexer.hasRegisteredMouseClickHandlers()) {
					aEventMultiplexer.notifyMouseClick(aEvent);
					return;
				}
			}
		}
		this.clickHandler(aEvent);
	}

	private clickHandler(aEvent: MouseEvent) {
		if (aEvent.button === 0) this.dispatchEffect();
		else if (aEvent.button === 2) this.switchSlide(-1, false);
	}

	onKeyDown(aEvent: KeyboardEvent) {
		aEvent.preventDefault();
		aEvent.stopPropagation();
		const handler = this.keyHandlerMap[aEvent.code];
		if (handler) handler();
	}

	setPresenter(presenter: SlideShowPresenter) {
		this.presenter = presenter;
	}

	private get slideCompositor(): SlideCompositor {
		return this.presenter._slideCompositor;
	}
}
