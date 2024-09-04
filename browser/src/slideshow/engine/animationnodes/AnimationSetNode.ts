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

class AnimationSetNode extends AnimationBaseNode2 {
	constructor(
		aNodeInfo: AnimationNodeInfo,
		aParentNode: BaseContainerNode,
		aNodeContext: NodeContext,
	) {
		super(aNodeInfo, aParentNode, aNodeContext);
		this.sClassName = 'AnimationSetNode';
	}

	public createActivity() {
		const aAnimation = createPropertyAnimation(
			this.getAttributeName(),
			this.getAnimatedElement(),
			this.aNodeContext.aContext.nSlideWidth,
			this.aNodeContext.aContext.nSlideHeight,
		);

		const aActivityParamSet = this.fillActivityParams();

		return new SetActivity(aActivityParamSet, aAnimation, this.getToValue());
	}
}
