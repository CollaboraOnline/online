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

declare var app: any;

class SetActivity extends AnimationActivity {
	private aAnimation: AnimationBase | null;
	private aTargetElement: null;
	private aEndEvent: DelayEvent;
	private aTimerEventQueue: TimerEventQueue;
	private aToAttr: string;
	private bIsActive: boolean;

	constructor(
		aCommonParamSet: ActivityParamSet,
		aAnimation: AnimationBase | null,
		aToAttr: string,
	) {
		super();

		this.aAnimation = aAnimation;
		this.aTargetElement = null;
		this.aEndEvent = aCommonParamSet.aEndEvent;
		this.aTimerEventQueue = aCommonParamSet.aTimerEventQueue;
		this.aToAttr = aToAttr;
		this.bIsActive = true;
	}

	public activate(aEndEvent: DelayEvent) {
		this.aEndEvent = aEndEvent;
		this.bIsActive = true;
	}

	public dispose() {
		this.bIsActive = false;
		if (this.aEndEvent && this.aEndEvent.isCharged()) this.aEndEvent.dispose();
	}

	public calcTimeLag() {
		return 0.0;
	}

	public perform() {
		if (!this.isActive()) return false;

		// we're going inactive immediately:
		this.bIsActive = false;

		if (this.aAnimation && this.aTargetElement) {
			this.aAnimation.start(this.aTargetElement);
			this.aAnimation.perform(this.aToAttr);
			this.aAnimation.end();
		}

		if (this.aEndEvent) this.aTimerEventQueue.addEvent(this.aEndEvent);
	}

	public isActive() {
		return this.bIsActive;
	}

	public dequeued() {
		// empty body
	}

	public end() {
		this.perform();
	}

	public setTargets(aTargetElement: any) {
		assert(
			aTargetElement,
			'SetActivity.setTargets: target element is not valid',
		);
		this.aTargetElement = aTargetElement;
	}
}
