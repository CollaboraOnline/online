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

function assert(object: any, message: string) {
    if (!object)
    {
		window.app.console.trace()
        throw new Error(message);
    }
}


enum AnimationNodeType {
	Custom,
	Par,
	Seq,
	Iterate,
	Animate,
	Set,
	AnimateMotion,
	AnimateColor,
	AnimateTransform,
	TransitionFilter,
	Audio,
	Command
}

enum ImpressNodeType {
	Default,
	OnClick,
	WithPrevious,
	AfterPrevious,
	MainSequence,
	TimingRoot,
	InteractiveSequence
}

enum TransitionMode {
	out,
	in
}


function getAnimationNodeType(aNode:any) {
	const typeStr = aNode.nodeName as keyof typeof AnimationNodeType;
	return AnimationNodeType[typeStr];
}

function getNodeChildren(aNode: any): Array<any> {
	return aNode.children || [];
}

function createAnimationTree(aAnimationRoot: any): any {
	return createAnimationNode(aAnimationRoot, null, null);
}

function createAnimationNode(aNode: any, aParentNode: any, aNodeContext: any): any {
	assert(aNode, 'createAnimationNode: invalid animation node');

	const eAnimationNodeType = getAnimationNodeType(aNode);
	let aCreatedNode = null;
	let aCreatedContainer = null;

	switch (eAnimationNodeType) {
		case AnimationNodeType.Par:
			aCreatedNode = aCreatedContainer =
				new ParallelTimeContainer(aNode, aParentNode, aNodeContext);
			break;
		case AnimationNodeType.Iterate:
			window.app.console.log('createAnimationNode: Iterate not implemented');
			return;
		case AnimationNodeType.Seq:
			aCreatedNode = aCreatedContainer =
				new SequentialTimeContainer(aNode, aParentNode, aNodeContext);
			break;
		case AnimationNodeType.Animate:
			aCreatedNode = new PropertyAnimationNode(aNode, aParentNode, aNodeContext);
			break;
		case AnimationNodeType.Set:
			aCreatedNode = new AnimationSetNode(aNode, aParentNode, aNodeContext);
			break;
		case AnimationNodeType.AnimateMotion:
			window.app.console.log('createAnimationNode: AnimateMotion not implemented');
			return null;
		case AnimationNodeType.AnimateColor:
			window.app.console.log('createAnimationNode: AnimateColor not implemented');
			return;
		case AnimationNodeType.AnimateTransform:
			aCreatedNode = new AnimationTransformNode(aNode, aParentNode, aNodeContext);
			break;
		case AnimationNodeType.TransitionFilter:
			aCreatedNode = new AnimationTransitionFilterNode(aNode, aParentNode, aNodeContext);
			break;
		case AnimationNodeType.Audio:
			window.app.console.log('createAnimationNode: Audio not implemented');
			return null;
		case AnimationNodeType.Command:
			window.app.console.log('createAnimationNode: Command not implemented');
			return null;
		default:
			window.app.console.log('createAnimationNode: invalid Animation Node Type: ' + eAnimationNodeType);
			return null;
	}

	if (aCreatedContainer) {
		const aChildrenArray = getNodeChildren(aNode);
		for (let i = 0; i < aChildrenArray.length; ++i) {
			if (!createChildNode(aChildrenArray[i], aCreatedContainer, aNodeContext)) {
				aCreatedContainer.removeAllChildrenNodes();
				break;
			}
		}
	}

	return aCreatedNode;
}

function createChildNode(aNodeInfo: any, aParentNode: any, aNodeContext: any): boolean {
	const aChildNode = createAnimationNode(aNodeInfo, aParentNode, aNodeContext);

	if (!aChildNode) {
		window.app.console.log('createChildNode: child node creation failed');
		return false;
	} else {
		aParentNode.appendChildNode(aChildNode);
		return true;
	}
}


class SlideAnimations {

	private aRootNode: any;

	public importAnimations(aAnimationRoot: any) : boolean {
		if (!aAnimationRoot)
			return false;

		this.aRootNode = createAnimationTree(aAnimationRoot);
		return !!this.aRootNode;
	}

	public parseInfo() {
		if( !this.aRootNode )
			return false;

		this.aRootNode.parseNodeInfo()
	}

	public getAnimationsTree() {
		return this.aRootNode;
	}
}

class BaseNode {
	public readonly eAnimationNodeType: AnimationNodeType;
	protected bIsContainer = false;
	protected readonly aNodeInfo: any;
	protected readonly aParentNode: any;
	protected readonly aNodeContext: any;


	private aBegin: any;
	private aEnd: any;
	private aDuration: any;
	protected bIsMainSequenceRootNode: boolean = false;
	protected bIsInteractiveSequenceRootNode: boolean = false;


	constructor(aNodeInfo: any, aParentNode: any, aNodeContext: any) {
		this.aNodeInfo = aNodeInfo;
		this.aParentNode = aParentNode
		this.aNodeContext = aNodeContext;
		this.eAnimationNodeType = getAnimationNodeType(aNodeInfo);
	}

	public parseNodeInfo() {
		this.aBegin = this.aNodeInfo.begin;
		this.aEnd = this.aNodeInfo.end;
		this.aDuration = this.aNodeInfo.dur;
	}

	public isContainer(): boolean {
		return this.bIsContainer;
	}
	public isMainSequenceRootNode(): boolean {
		return this.bIsMainSequenceRootNode;
	}

	public isInteractiveSequenceRootNode(): boolean {
		return this.bIsInteractiveSequenceRootNode;
	}

	public getBegin(): any {
		return this.aBegin;
	}

	public getEnd(): any {
		return this.aEnd;
	}

	public getDuration(): any {
		return this.aDuration;
	}

	public getInfo(verbose: boolean): string {
		let sInfo = 'node name: ' + this.aNodeInfo.nodeName;

		if (verbose) {
			sInfo += ';  is container: ' + this.isContainer();

			if (this.getBegin())
				sInfo += ';  begin: ' + this.getBegin();

			if (this.getDuration())
				sInfo += ';  dur: ' + this.getDuration();

			if (this.getEnd())
				sInfo += ';  end: ' + this.getEnd();
		}

		return sInfo;
	}
}

class BaseContainerNode extends BaseNode {
	private aChildrenArray: Array<BaseNode> = [];
	private eImpressNodeType: ImpressNodeType;

	constructor(aNodeInfo: any, aParentNode: any, aNodeContext: any) {
		super(aNodeInfo, aParentNode, aNodeContext);

		this.bIsContainer = true;
	}

	public parseNodeInfo() {
		super.parseNodeInfo();

		this.eImpressNodeType = this.aNodeInfo.nodeType;
		this.bIsMainSequenceRootNode = this.eImpressNodeType === ImpressNodeType.MainSequence;
		this.bIsInteractiveSequenceRootNode = this.eImpressNodeType === ImpressNodeType.InteractiveSequence;

		for (const child of this.aChildrenArray) {
			child.parseNodeInfo();
		}
	}

	public appendChildNode(aNode: any) {
		this.aChildrenArray.push(aNode);
	}

	public removeAllChildrenNodes() {
		this.aChildrenArray = [];
	}

	public forEachChildNode(aFunction: any) {
		for (const child of this.aChildrenArray) {
			aFunction(child);
		}
	}

	public getImpressNodeType(): ImpressNodeType {
		return this.eImpressNodeType;
	}

	public getChildren() {
		return this.aChildrenArray;
	}

	public getInfo(verbose: boolean): string {
		let sInfo = super.getInfo(verbose);

		if (verbose) {
			if (this.getImpressNodeType())
				sInfo += '; nodeType: ' + this.getImpressNodeType();
		}

		for (const child of this.aChildrenArray) {
			sInfo += '\n';
			sInfo += child.getInfo(verbose);
		}
		return sInfo;
	}
}

class ParallelTimeContainer extends BaseContainerNode {
	constructor(aNodeInfo: any, aParentNode: any, aNodeContext: any) {
		super(aNodeInfo, aParentNode, aNodeContext);
	}
}

class SequentialTimeContainer extends BaseContainerNode {
	constructor(aNodeInfo: any, aParentNode: any, aNodeContext: any) {
		super(aNodeInfo, aParentNode, aNodeContext);
	}
}

class AnimationBaseNode extends BaseNode {
	private aTargetHash: string;
	constructor(aNodeInfo: any, aParentNode: any, aNodeContext: any) {
		super(aNodeInfo, aParentNode, aNodeContext);
	}

	public parseNodeInfo() {
		super.parseNodeInfo();

		this.aTargetHash = this.aNodeInfo.targetElement;
	}

	public getTargetHash() {
		return this.aTargetHash;
	}

	public getInfo(verbose: boolean): string {
		let sInfo = super.getInfo(verbose);

		if (verbose) {
			if (this.getTargetHash()) {
				sInfo += ';  target hash: ' + this.getTargetHash();
			}
		}
		return sInfo;
	}
}

class AnimationBaseNode2 extends AnimationBaseNode {
	private attributeName: string = '';
	private aToValue: any;

	constructor(aNodeInfo: any, aParentNode: any, aNodeContext: any) {
		super(aNodeInfo, aParentNode, aNodeContext);
	}

	public parseNodeInfo() {
		super.parseNodeInfo();

		this.attributeName = this.aNodeInfo.attributeName;
		this.aToValue = this.aNodeInfo.to;
	}

	public getAttributeName(): string {
		return this.attributeName;
	}

	public getToValue(): any {
		return this.aToValue;
	}

	public getInfo(verbose: boolean): string {
		let sInfo = super.getInfo(verbose);

		if (verbose) {
			if (this.getAttributeName())
				sInfo += ';  attributeName: ' + this.getAttributeName();

			if (this.getToValue())
				sInfo += ';  to: ' + this.getToValue();
		}
		return sInfo;
	}
}

class AnimationBaseNode3 extends AnimationBaseNode2 {
	private aFromValue: any;
	private aByValue: any;
	private aValues: Array<string> = [];

	constructor(aNodeInfo: any, aParentNode: any, aNodeContext: any) {
		super(aNodeInfo, aParentNode, aNodeContext);
	}

	public parseNodeInfo() {
		super.parseNodeInfo();

		this.aFromValue = this.aNodeInfo.from;
		this.aByValue = this.aNodeInfo.by;
		this.aValues = this.aNodeInfo.values ? this.aNodeInfo.values.split(';') : [];
	}

	public getFromValue(): any {
		return this.aFromValue;
	}

	public getByValue(): any {
		return this.aByValue;
	}

	public getValues(): Array<string> {
		return this.aValues;
	}

	public getInfo(verbose: boolean): string {
		let sInfo = super.getInfo(verbose);

		if (verbose) {
			if (this.getFromValue())
				sInfo += ';  from: ' + this.getFromValue();

			if (this.getByValue())
				sInfo += ';  by: ' + this.getByValue();

			if (this.getValues().length)
				sInfo += ';  values: ' + this.getValues().join(',');
		}
		return sInfo;
	}
}

class PropertyAnimationNode extends AnimationBaseNode3 {
	constructor(aNodeInfo: any, aParentNode: any, aNodeContext: any) {
		super(aNodeInfo, aParentNode, aNodeContext);
	}
}

class AnimationTransformNode extends AnimationBaseNode3 {
	private transformType: string;

	constructor(aNodeInfo: any, aParentNode: any, aNodeContext: any) {
		super(aNodeInfo, aParentNode, aNodeContext);
	}

	public parseNodeInfo() {
		super.parseNodeInfo();

		this.transformType = this.aNodeInfo.type;
	}

	public getTransformType(): string {
		return this.transformType;
	}

	public getInfo(verbose: boolean): string {
		let sInfo = super.getInfo(verbose);

		if (verbose) {
			if (this.getTransformType())
				sInfo += '; tranformType: ' + this.getTransformType();
		}
		return sInfo;
	}
}

class AnimationSetNode extends AnimationBaseNode2 {
	constructor(aNodeInfo: any, aParentNode: any, aNodeContext: any) {
		super(aNodeInfo, aParentNode, aNodeContext);
	}
}

class AnimationTransitionFilterNode extends AnimationBaseNode {
	private eTransitionType: string;
	private eTransitionSubType: string;
	private bIsReverseDirection: boolean = false;
	private eTransitionMode: TransitionMode;


	constructor(aNodeInfo: any, aParentNode: any, aNodeContext: any) {
		super(aNodeInfo, aParentNode, aNodeContext);
	}

	public parseNodeInfo() {
		super.parseNodeInfo();

		this.eTransitionType = this.aNodeInfo.type;
		this.eTransitionSubType = this.aNodeInfo.subtype;
		this.bIsReverseDirection = this.aNodeInfo.direction === 'reverse';
		const sMode: keyof typeof TransitionMode = this.aNodeInfo.mode;
		this.eTransitionMode = this.aNodeInfo.mode ? TransitionMode[sMode] : TransitionMode.in;
	}

	public getTransitionType() {
		return this.eTransitionType;
	}

	public getTransitionSubtype() {
		return this.eTransitionSubType;
	}

	public isReverseDirection() {
		return this.bIsReverseDirection;
	}

	public getTransitionMode() {
		return this.eTransitionMode;
	}

	public getInfo(verbose: boolean): string {
		let sInfo = super.getInfo(verbose);

		if (verbose) {
			if (this.getTransitionType())
				sInfo += '; type: ' + this.getTransitionType();

			if (this.getTransitionSubtype())
				sInfo += '; subtype: ' + this.getTransitionSubtype();

			sInfo += '; is reverse direction: ' + this.isReverseDirection();

			sInfo += '; mode: ' + TransitionMode[this.getTransitionMode()];
		}
		return sInfo;
	}
}