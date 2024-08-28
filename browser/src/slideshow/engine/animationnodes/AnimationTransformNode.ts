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

class AnimationTransformNode extends AnimationBaseNode3 {
	constructor(
		aNodeInfo: AnimationNodeInfo,
		aParentNode: BaseContainerNode,
		aNodeContext: NodeContext,
	) {
		super(aNodeInfo, aParentNode, aNodeContext);
		this.sClassName = 'AnimationTransformNode';
	}

	public static isValidTransformation(sType: string) {
		return (
			sType === 'translate' ||
			sType === 'scale' ||
			sType === 'rotate' ||
			sType === 'skewX' ||
			sType === 'skewY'
		);
	}

	public parseNodeInfo() {
		super.parseNodeInfo();

		const aNodeInfo = this.aNodeInfo as AnimateTransformNodeInfo;
		if (
			!AnimationTransformNode.isValidTransformation(aNodeInfo.transformType)
		) {
			this.eCurrentState = NodeState.Invalid;
			window.app.console.log(
				'AnimationTransformNode.parseElement: transformation type not found: ' +
					aNodeInfo.transformType,
			);
		} else {
			this.attributeName = aNodeInfo.transformType;
		}
	}

	public createActivity(): AnimationActivity {
		const aActivityParamSet = this.fillActivityParams();
		let aAnimation;

		if (
			this.getAttributeName() === 'scale' ||
			this.getAttributeName() === 'translate'
		) {
			aAnimation = createPairPropertyAnimation(
				this.getAttributeName(),
				this.getAnimatedElement(),
				this.aNodeContext.aSlideWidth,
				this.aNodeContext.aSlideHeight,
			);
		} else {
			aAnimation = createPropertyAnimation(
				this.getAttributeName(),
				this.getAnimatedElement(),
				this.aNodeContext.aSlideWidth,
				this.aNodeContext.aSlideHeight,
			);
		}

		const aInterpolator: PropertyInterpolatorType = null; // createActivity will compute it;
		return createActivity(aActivityParamSet, this, aAnimation, aInterpolator);
	}

	public getTransformType(): string {
		return this.getAttributeName();
	}
}
