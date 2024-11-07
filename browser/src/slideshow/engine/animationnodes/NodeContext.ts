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

class NodeContext {
	public aContext: SlideShowContext = null;
	public aAnimationNodeMap: AnimationNodeMap = null;
	public aAnimatedElementMap: Map<string, AnimatedElement> = null;
	public aSourceEventElementMap: Map<string, SourceEventElement> = null;
	public metaSlide: MetaSlide = null;
	public nStartDelay = 0.0;
	public bFirstRun: boolean | undefined = undefined;
	public bIsInvalid = false;

	constructor(aSlideShowContext: any) {
		this.aContext = aSlideShowContext;
	}

	public makeSourceEventElement(sId: string, aSlideShow: SlideShowHandler) {
		if (!this.aContext.aEventMultiplexer) {
			window.app.console.log(
				'NodeContext.makeSourceEventElement: event multiplexer not initialized',
			);
			return null;
		}

		if (!this.aSourceEventElementMap.has(sId)) {
			const triggerInfo = this.metaSlide.getTriggerInfo(sId);
			if (!triggerInfo) {
				window.app.console.log(
					'NodeContext.makeSourceEventElement: no bounds found for event trigger: ' +
						sId,
				);
				return null;
			}

			this.aSourceEventElementMap.set(
				sId,
				new SourceEventElement(
					sId,
					this.aContext.aCanvas,
					triggerInfo.bounds,
					triggerInfo.index,
					aSlideShow,
					this.aContext.aEventMultiplexer,
				),
			);
		}
		return this.aSourceEventElementMap.get(sId);
	}
}
