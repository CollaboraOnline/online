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

class AnimationTransitionFilterNode extends AnimationBaseNode {
	private eTransitionType: TransitionType | undefined;
	private eTransitionSubType: TransitionSubType | undefined;
	private bIsReverseDirection: boolean = false;
	private eTransitionMode: TransitionMode;

	constructor(
		aNodeInfo: AnimationNodeInfo,
		aParentNode: BaseContainerNode | null,
		aNodeContext: NodeContext,
	) {
		super(aNodeInfo, aParentNode, aNodeContext);
		this.sClassName = 'AnimationTransitionFilterNode';
	}

	public parseNodeInfo() {
		super.parseNodeInfo();

		let bIsValidTransition = true;
		const aNodeInfo = this.aNodeInfo as TransitionFilterNodeInfo;

		// type property
		this.eTransitionType = undefined;
		if (
			aNodeInfo.transitionType &&
			stringToTransitionTypeMap[aNodeInfo.transitionType] in TransitionType
		) {
			this.eTransitionType =
				stringToTransitionTypeMap[aNodeInfo.transitionType];
		} else {
			bIsValidTransition = false;
			window.app.console.log(
				'AnimationTransitionFilterNode.parseElement: transition type not valid: ' +
					aNodeInfo.transitionType,
			);
		}

		// subtype property
		this.eTransitionSubType = undefined;
		if (!aNodeInfo.transitionSubType) aNodeInfo.transitionSubType = 'Default';
		if (
			stringToTransitionSubTypeMap[aNodeInfo.transitionSubType] in
			TransitionSubType
		) {
			this.eTransitionSubType =
				stringToTransitionSubTypeMap[aNodeInfo.transitionSubType];
		} else {
			bIsValidTransition = false;
			window.app.console.log(
				'AnimationTransitionFilterNode.parseElement: transition subtype not valid: ' +
					aNodeInfo.transitionSubType,
			);
		}

		// if we do not support the requested transition type we fall back to crossfade transition;
		// note: if we do not provide an alternative transition and we set the state of the animation node to 'invalid'
		// the animation engine stops itself;
		if (!bIsValidTransition) {
			this.eTransitionType = TransitionType.FADE;
			this.eTransitionSubType = TransitionSubType.CROSSFADE;
			window.app.console.log(
				'AnimationTransitionFilterNode.parseElement: in place of the invalid transition a crossfade transition is used',
			);
		}

		this.bIsReverseDirection = aNodeInfo.transitionDirection === 'reverse';

		this.eTransitionMode = TransitionMode.in;
		if (
			aNodeInfo.transitionMode &&
			aNodeInfo.transitionMode in TransitionMode
		) {
			const sMode = aNodeInfo.transitionMode as keyof typeof TransitionMode;
			this.eTransitionMode = TransitionMode[sMode];
		}
	}

	public createActivity(): AnimationActivity | null {
		const aActivityParamSet = this.fillActivityParams();

		return createShapeTransition(
			aActivityParamSet,
			this.getAnimatedElement(),
			this.aNodeContext.aContext!.nSlideWidth,
			this.aNodeContext.aContext!.nSlideHeight,
			this,
		);
	}

	public getTransitionType() {
		return this.eTransitionType;
	}

	public getTransitionSubtype() {
		return this.eTransitionSubType;
	}

	public getTransitionMode() {
		return this.eTransitionMode;
	}

	public getReverseDirection() {
		return this.bIsReverseDirection;
	}

	public info(verbose: boolean = false): string {
		let sInfo = super.info(verbose);

		if (verbose) {
			if (this.getTransitionType())
				sInfo += '; type: ' + TransitionType[this.getTransitionType()!];

			if (this.getTransitionSubtype())
				sInfo +=
					'; subtype: ' + TransitionSubType[this.getTransitionSubtype()!];

			sInfo += '; is reverse direction: ' + this.getReverseDirection();

			sInfo += '; mode: ' + TransitionMode[this.getTransitionMode()];
		}
		return sInfo;
	}
}
