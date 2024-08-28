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

class MetaSlide {
	private _info: SlideInfo;
	private readonly _metaPres: MetaPresentation;
	private readonly _slideShowHandler: SlideShowHandler;
	private _transitionHandler: SlideTransition;
	private _animationsHandler: SlideAnimations;

	constructor(slideInfo: SlideInfo, metaPres: MetaPresentation) {
		this._info = slideInfo;
		this._metaPres = metaPres;
		this._slideShowHandler = metaPres.slideShowHandler;

		if (this.hasTransition())
			this._transitionHandler = new SlideTransition(slideInfo);

		this._animationsHandler = new SlideAnimations(
			this._slideShowHandler.getContext(),
		);
		this._animationsHandler.importAnimations(slideInfo.animations.root);
		this._animationsHandler.parseInfo();
	}

	public hasTransition(): boolean {
		return !!stringToTransitionTypeMap[this._info.transitionType];
	}

	public get info(): SlideInfo {
		return this._info;
	}

	public get next(): MetaSlide {
		return this.info.next ? this._metaPres.getMetaSlide(this.info.next) : null;
	}

	public get prev(): MetaSlide {
		return this.info.prev ? this._metaPres.getMetaSlide(this.info.prev) : null;
	}

	public get transitionHandler(): SlideTransition {
		return this._transitionHandler;
	}

	public get animationsHandler(): SlideAnimations {
		return this._animationsHandler;
	}

	public show() {
		// TODO implement it ?
	}

	public hide() {
		// TODO implement it ?
	}
}
