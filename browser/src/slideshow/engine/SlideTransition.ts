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

interface TransitionInfo {
	type: TransitionType;
	subType?: TransitionSubType;
	reverseDirection?: boolean;
	fadeColor?: string;
	duration?: number;
}

class SlideTransition {
	slideInfo: SlideInfo;
	aDuration: Duration;
	nMinFrameCount: number;
	bIsValid: boolean;

	constructor(slideInfo: SlideInfo) {
		this.slideInfo = slideInfo;
		this.bIsValid = !!this.getType();
		this.aDuration = new Duration(this.slideInfo.transitionDuration + 'ms');
		if (!this.aDuration.isSet()) {
			this.aDuration = new Duration(null); // duration == 0.0
		}

		// set up min frame count value;
		this.nMinFrameCount = this.getDuration().isValue()
			? this.getDuration().getValue() *
				SlideShowHandler.MINIMUM_FRAMES_PER_SECONDS
			: SlideShowHandler.MINIMUM_FRAMES_PER_SECONDS;
		if (this.nMinFrameCount < 1.0) this.nMinFrameCount = 1;
		else if (this.nMinFrameCount > SlideShowHandler.MINIMUM_FRAMES_PER_SECONDS)
			this.nMinFrameCount = SlideShowHandler.MINIMUM_FRAMES_PER_SECONDS;
	}

	isValid() {
		return this.bIsValid;
	}

	createSlideTransition(
		transitionParameters: TransitionParameters,
	): SlideChangeBase {
		if (!this.isValid()) return null;

		switch (this.getType()) {
			case TransitionType.FADE:
				return new SlideShow.FadeTransition(transitionParameters);

			case TransitionType.BARWIPE:
				return BarWipeTransition(transitionParameters);

			case TransitionType.PINWHEELWIPE:
				return new SlideShow.WheelTransition(transitionParameters);

			case TransitionType.SLIDEWIPE:
				return SlideWipeTransition(transitionParameters);

			case TransitionType.RANDOMBARWIPE:
				return new SlideShow.BarsTransition(transitionParameters);

			case TransitionType.CHECKERBOARDWIPE:
				return new SlideShow.CheckersTransition(transitionParameters);

			case TransitionType.FOURBOXWIPE:
				return new SlideShow.PlusTransition(transitionParameters);

			case TransitionType.IRISWIPE:
				return SlideShow.IrisWipeTransition(transitionParameters);

			case TransitionType.ELLIPSEWIPE:
				return SlideShow.EllipseWipeTransition(transitionParameters);

			case TransitionType.FANWIPE:
				return new SlideShow.WedgeTransition(transitionParameters);

			case TransitionType.BLINDSWIPE:
				return new SlideShow.VenetianTransition(transitionParameters);

			case TransitionType.DISSOLVE:
				return new SlideShow.SimpleDissolveTransition(transitionParameters);

			case TransitionType.PUSHWIPE:
				return SlideShow.PushWipeTransition(transitionParameters);

			case TransitionType.BARNDOORWIPE:
				return new SlideShow.SplitTransition(transitionParameters);

			case TransitionType.WATERFALLWIPE:
				return new SlideShow.DiagonalTransition(transitionParameters);

			default:
				console.log(
					'Unknown transition type',
					transitionParameters.slideInfo.transitionType,
				);
				return new SlideShow.NoTransition(transitionParameters);
		}
	}

	public getType() {
		return stringToTransitionTypeMap[this.slideInfo.transitionType];
	}

	public getSubType() {
		return stringToTransitionSubTypeMap[this.slideInfo.transitionSubtype];
	}

	public getFadeColor(): string {
		return this.slideInfo.transitionFadeColor || '#000000';
	}

	public isDirectionForward() {
		return this.slideInfo.transitionDirection;
	}

	public getDuration() {
		return this.aDuration;
	}

	public getMinFrameCount(): number {
		return this.nMinFrameCount;
	}
}
