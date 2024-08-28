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

type InteractiveAnimationSequenceMap = Map<
	number,
	InteractiveAnimationSequence
>;

class SlideShowContext {
	public aSlideShowHandler: SlideShowHandler;
	public aTimerEventQueue: TimerEventQueue;
	public aEventMultiplexer: EventMultiplexer;
	public aNextEffectEventArray: NextEffectEventArray;
	public aInteractiveAnimationSequenceMap: InteractiveAnimationSequenceMap;
	public aActivityQueue: ActivityQueue;
	public bIsSkipping: boolean;

	constructor(
		aSlideShowHandler: SlideShowHandler,
		aTimerEventQueue: TimerEventQueue,
		aEventMultiplexer: EventMultiplexer,
		aNextEffectEventArray: NextEffectEventArray,
		aInteractiveAnimationSequenceMap: InteractiveAnimationSequenceMap,
		aActivityQueue: ActivityQueue,
	) {
		this.aSlideShowHandler = aSlideShowHandler;
		this.aTimerEventQueue = aTimerEventQueue;
		this.aEventMultiplexer = aEventMultiplexer;
		this.aNextEffectEventArray = aNextEffectEventArray;
		this.aInteractiveAnimationSequenceMap = aInteractiveAnimationSequenceMap;
		this.aActivityQueue = aActivityQueue;
		this.bIsSkipping = false;
	}
}

class SlideShowHandler {
	public static readonly MAXIMUM_FRAME_COUNT: number = 60;
	public static readonly MINIMUM_TIMEOUT: number =
		1.0 / SlideShowHandler.MAXIMUM_FRAME_COUNT;
	public static readonly MAXIMUM_TIMEOUT: number = 4.0;
	public static readonly MINIMUM_FRAMES_PER_SECONDS: number = 10;
	public static readonly PREFERRED_FRAMES_PER_SECONDS: number = 50;
	public static readonly PREFERRED_FRAME_RATE: number =
		1.0 / SlideShowHandler.PREFERRED_FRAMES_PER_SECONDS;

	private theMetaPres: MetaPresentation;
	private aTimer: ElapsedTime;
	private aFrameSynchronization: FrameSynchronization;
	private aTimerEventQueue: TimerEventQueue;
	private aActivityQueue: ActivityQueue;
	private aNextEffectEventArray: NextEffectEventArray;
	private aInteractiveAnimationSequenceMap: InteractiveAnimationSequenceMap;
	private aEventMultiplexer: EventMultiplexer;
	private aContext: SlideShowContext;
	private bIsIdle: boolean;
	private bIsEnabled: boolean;
	private bNoSlideTransition: boolean;
	private bIsTransitionRunning: boolean;
	private nCurrentEffect: number;
	private bIsNextEffectRunning: boolean;
	private bIsRewinding: boolean;
	private bIsSkipping: boolean;
	private bIsSkippingAll: boolean;
	private nTotalInteractivePlayingEffects: number;
	private aStartedEffectList: Effect[];
	private aStartedEffectIndexMap: Map<number, number | undefined>;
	private automaticAdvanceTimeout: number | { rewindedEffect: number };

	constructor() {
		this.aTimer = new ElapsedTime();
		this.aFrameSynchronization = new FrameSynchronization(
			SlideShowHandler.PREFERRED_FRAME_RATE,
		);
		this.aTimerEventQueue = new TimerEventQueue(this.aTimer);
		this.aActivityQueue = new ActivityQueue(this.aTimer);
		this.aNextEffectEventArray = null;
		this.aInteractiveAnimationSequenceMap = null;
		this.aEventMultiplexer = null;

		this.aContext = new SlideShowContext(
			this,
			this.aTimerEventQueue,
			this.aEventMultiplexer,
			this.aNextEffectEventArray,
			this.aInteractiveAnimationSequenceMap,
			this.aActivityQueue,
		);

		this.bIsIdle = true;
		this.bIsEnabled = true;
		this.bNoSlideTransition = false;
		this.bIsTransitionRunning = false;

		this.nCurrentEffect = 0;
		this.bIsNextEffectRunning = false;
		this.bIsRewinding = false;
		this.bIsSkipping = false;
		this.bIsSkippingAll = false;
		this.nTotalInteractivePlayingEffects = 0;
		this.aStartedEffectList = [];
		this.aStartedEffectIndexMap = new Map();
		this.aStartedEffectIndexMap.set(-1, undefined);
		this.automaticAdvanceTimeout = null;
	}

	private get automaticAdvanceTimeoutRewindedEffect(): number {
		const automaticAdvanceTimeout = this.automaticAdvanceTimeout as {
			rewindedEffect: number;
		};
		return automaticAdvanceTimeout.rewindedEffect;
	}

	setMetaPresentation(metaPres: MetaPresentation) {
		this.theMetaPres = metaPres;
	}

	setSlideEvents(
		aNextEffectEventArray: NextEffectEventArray,
		aInteractiveAnimationSequenceMap: InteractiveAnimationSequenceMap,
		aEventMultiplexer: EventMultiplexer,
	) {
		if (!aNextEffectEventArray)
			window.app.console.log(
				'SlideShow.setSlideEvents: aNextEffectEventArray is not valid',
			);

		if (!aInteractiveAnimationSequenceMap)
			window.app.console.log(
				'SlideShow.setSlideEvents:aInteractiveAnimationSequenceMap  is not valid',
			);

		if (!aEventMultiplexer)
			window.app.console.log(
				'SlideShow.setSlideEvents: aEventMultiplexer is not valid',
			);

		this.aContext.aNextEffectEventArray = aNextEffectEventArray;
		this.aNextEffectEventArray = aNextEffectEventArray;
		this.aContext.aInteractiveAnimationSequenceMap =
			aInteractiveAnimationSequenceMap;
		this.aInteractiveAnimationSequenceMap = aInteractiveAnimationSequenceMap;
		this.aContext.aEventMultiplexer = aEventMultiplexer;
		this.aEventMultiplexer = aEventMultiplexer;
		this.nCurrentEffect = 0;
	}

	createSlideTransition(
		aSlideTransitionHandler: SlideTransition,
		transitionParameters: TransitionParameters,
		aTransitionEndEvent: DelayEvent,
	): SimpleActivity {
		if (this.bNoSlideTransition) return null;

		const aSlideTransition =
			aSlideTransitionHandler.createSlideTransition(transitionParameters);
		if (!aSlideTransition) return null;

		let nDuration = 0.001;
		if (aSlideTransitionHandler.getDuration().isValue()) {
			nDuration = aSlideTransitionHandler.getDuration().getValue();
		} else {
			window.app.console.log(
				'SlideShow.createSlideTransition: duration is not a number',
			);
		}

		const aCommonParameterSet = new ActivityParamSet();
		aCommonParameterSet.aEndEvent = aTransitionEndEvent;
		aCommonParameterSet.aTimerEventQueue = this.aTimerEventQueue;
		aCommonParameterSet.aActivityQueue = this.aActivityQueue;
		aCommonParameterSet.nMinDuration = nDuration;
		aCommonParameterSet.nMinNumberOfFrames =
			aSlideTransitionHandler.getMinFrameCount();
		aCommonParameterSet.nSlideWidth = this.theMetaPres.slideWidth;
		aCommonParameterSet.nSlideHeight = this.theMetaPres.slideHeight;

		return new SimpleActivity(
			aCommonParameterSet,
			aSlideTransition,
			DirectionType.Forward,
		);
	}

	isEnabled() {
		return this.bIsEnabled;
	}

	isRunning() {
		return !this.bIsIdle;
	}

	isTransitionPlaying() {
		return this.bIsTransitionRunning;
	}

	isMainEffectPlaying() {
		return this.bIsNextEffectRunning;
	}

	isInteractiveEffectPlaying() {
		return this.nTotalInteractivePlayingEffects > 0;
	}

	isAnyEffectPlaying() {
		return this.isMainEffectPlaying() || this.isInteractiveEffectPlaying();
	}

	hasAnyEffectStarted() {
		return this.aStartedEffectList.length > 0;
	}

	notifyNextEffectStart() {
		assert(
			!this.bIsNextEffectRunning,
			'SlideShow.notifyNextEffectStart: an effect is already started.',
		);
		this.bIsNextEffectRunning = true;
		this.aEventMultiplexer.registerNextEffectEndHandler(
			this.notifyNextEffectEnd.bind(this),
		);
		const aEffect = new Effect();
		aEffect.start();
		this.aStartedEffectIndexMap.set(-1, this.aStartedEffectList.length);
		this.aStartedEffectList.push(aEffect);

		const sCurSlideHash = this.theMetaPres.getCurrentSlideHash();
		const aAnimatedElementMap = this.theMetaPres
			.getMetaSlide(sCurSlideHash)
			.animationsHandler.getAnimatedElementMap();
		for (const sId in aAnimatedElementMap)
			aAnimatedElementMap.get(sId).notifyNextEffectStart(this.nCurrentEffect);
	}

	notifyNextEffectEnd() {
		assert(
			this.bIsNextEffectRunning,
			'SlideShow.notifyNextEffectEnd: effect already ended.',
		);
		this.bIsNextEffectRunning = false;

		this.aStartedEffectList[this.aStartedEffectIndexMap.get(-1)].end();
		if (this.automaticAdvanceTimeout !== null) {
			if (this.automaticAdvanceTimeoutRewindedEffect === this.nCurrentEffect) {
				this.automaticAdvanceTimeout = null;
				this.notifyAnimationsEnd();
			}
		}
	}

	notifyAnimationsEnd() {
		const sCurrSlideHash = this.theMetaPres.getCurrentSlideHash();

		if (this.theMetaPres.isLastSlide(sCurrSlideHash)) return;

		assert(
			this.automaticAdvanceTimeout === null,
			'SlideShow.notifyAnimationsEnd: Timeout already set.',
		);

		const slideInfo = this.theMetaPres.getSlideInfo(sCurrSlideHash);
		const nTimeout = Math.ceil(slideInfo.nextSlideDuration * 1000);
		if (nTimeout < 0) return;

		this.automaticAdvanceTimeout = window.setTimeout(
			'switchSlide(1, false)',
			nTimeout,
		);
	}

	notifySlideStart(nNewSlideIndex: number, nOldSlideIndex: number) {
		this.nCurrentEffect = 0;
		this.bIsRewinding = false;
		this.bIsSkipping = false;
		this.bIsSkippingAll = false;
		this.nTotalInteractivePlayingEffects = 0;
		this.aStartedEffectList = [];
		this.aStartedEffectIndexMap = new Map();
		this.aStartedEffectIndexMap.set(-1, undefined);

		if (nOldSlideIndex !== undefined) {
			const metaOldSlide = this.theMetaPres.getMetaSlideByIndex(nOldSlideIndex);
			const aAnimatedElementMap =
				metaOldSlide.animationsHandler.getAnimatedElementMap();
			for (const sId in aAnimatedElementMap)
				aAnimatedElementMap.get(sId).notifySlideEnd();
		}
		const metaNewSlide = this.theMetaPres.getMetaSlideByIndex(nNewSlideIndex);
		const aAnimatedElementMap =
			metaNewSlide.animationsHandler.getAnimatedElementMap();
		for (const sId in aAnimatedElementMap)
			aAnimatedElementMap.get(sId).notifySlideStart(this.aContext);
	}

	notifyTransitionEnd(nSlideIndex: number) {
		const nCurSlide = this.theMetaPres.getCurrentSlideIndex();
		this.bIsTransitionRunning = false;
		if (this.bIsRewinding) {
			this.theMetaPres.getMetaSlideByIndex(nSlideIndex).hide();
			const nIndex = nCurSlide !== undefined ? nCurSlide : -1;
			this.displaySlide(nIndex, true);
			this.skipAllEffects();
			this.bIsRewinding = false;
			return;
		}

		this.theMetaPres.setCurrentSlide(nSlideIndex);

		if (this.isEnabled()) {
			// clear all queues
			this.dispose();

			const sCurSlideHash = this.theMetaPres.getCurrentSlideHash();
			var aCurrentSlide = this.theMetaPres.getMetaSlide(sCurSlideHash);
			if (aCurrentSlide.animationsHandler.elementsParsed()) {
				aCurrentSlide.animationsHandler.start();
				this.aEventMultiplexer.registerAnimationsEndHandler(
					this.notifyAnimationsEnd.bind(this),
				);
			} else this.notifyAnimationsEnd();

			this.update();
		} else this.notifyAnimationsEnd();
	}

	notifyInteractiveAnimationSequenceStart(nNodeId: number) {
		++this.nTotalInteractivePlayingEffects;
		const aEffect = new Effect(nNodeId);
		aEffect.start();
		this.aStartedEffectIndexMap.set(nNodeId, this.aStartedEffectList.length);
		this.aStartedEffectList.push(aEffect);
	}

	notifyInteractiveAnimationSequenceEnd(nNodeId: number) {
		assert(
			this.isInteractiveEffectPlaying(),
			'SlideShow.notifyInteractiveAnimationSequenceEnd: no interactive effect playing.',
		);

		this.aStartedEffectList[this.aStartedEffectIndexMap.get(nNodeId)].end();
		--this.nTotalInteractivePlayingEffects;
	}

	/** nextEffect
	 *  Start the next effect belonging to the main animation sequence if any.
	 *  If there is an already playing effect belonging to any animation sequence
	 *  it is skipped.
	 *
	 *  @return {Boolean}
	 *      False if there is no more effect to start, true otherwise.
	 */
	nextEffect() {
		if (!this.isEnabled()) return false;

		if (this.isTransitionPlaying()) {
			this.skipTransition();
			return true;
		}

		if (this.isAnyEffectPlaying()) {
			this.skipAllPlayingEffects();
			return true;
		}

		if (!this.aNextEffectEventArray) return false;

		if (this.nCurrentEffect >= this.aNextEffectEventArray.size()) return false;

		this.notifyNextEffectStart();

		this.aNextEffectEventArray.at(this.nCurrentEffect).fire();
		++this.nCurrentEffect;
		this.update();
		return true;
	}

	/** skipTransition
	 *  Skip the current playing slide transition.
	 */
	skipTransition() {
		if (this.bIsSkipping || this.bIsRewinding) return;

		this.bIsSkipping = true;

		this.aActivityQueue.endAll();
		this.aTimerEventQueue.forceEmpty();
		this.aActivityQueue.endAll();
		this.update();
		this.bIsSkipping = false;
	}

	/** skipAllPlayingEffects
	 *  Skip all playing effect, independently to which animation sequence they
	 *  belong.
	 *
	 */
	skipAllPlayingEffects() {
		if (this.bIsSkipping || this.bIsRewinding) return true;

		this.bIsSkipping = true;
		// TODO: The correct order should be based on the left playing time.
		for (let i = 0; i < this.aStartedEffectList.length; ++i) {
			const aEffect = this.aStartedEffectList[i];
			if (aEffect.isPlaying()) {
				if (aEffect.isMainEffect())
					this.aEventMultiplexer.notifySkipEffectEvent();
				else
					this.aEventMultiplexer.notifySkipInteractiveEffectEvent(
						aEffect.getId(),
					);
			}
		}
		this.update();
		this.bIsSkipping = false;
		return true;
	}

	/** skipNextEffect
	 *  Skip the next effect to be played (if any) that belongs to the main
	 *  animation sequence.
	 *  Require: no effect is playing.
	 *
	 *  @return {Boolean}
	 *      False if there is no more effect to skip, true otherwise.
	 */
	skipNextEffect(): boolean {
		if (this.bIsSkipping || this.bIsRewinding) return true;

		assert(!this.isAnyEffectPlaying(), 'SlideShow.skipNextEffect');

		if (!this.aNextEffectEventArray) return false;

		if (this.nCurrentEffect >= this.aNextEffectEventArray.size()) return false;

		this.notifyNextEffectStart();

		this.bIsSkipping = true;
		this.aNextEffectEventArray.at(this.nCurrentEffect).fire();
		this.aEventMultiplexer.notifySkipEffectEvent();
		++this.nCurrentEffect;
		this.update();
		this.bIsSkipping = false;
		return true;
	}

	/** skipPlayingOrNextEffect
	 *  Skip the next effect to be played that belongs to the main animation
	 *  sequence  or all playing effects.
	 *
	 *  @return {Boolean}
	 *      False if there is no more effect to skip, true otherwise.
	 */
	skipPlayingOrNextEffect() {
		if (this.isTransitionPlaying()) {
			this.skipTransition();
			return true;
		}

		if (this.isAnyEffectPlaying()) return this.skipAllPlayingEffects();
		else return this.skipNextEffect();
	}

	/** skipAllEffects
	 *  Skip all left effects that belongs to the main animation sequence and all
	 *  playing effects on the current slide.
	 *
	 *  @return {Boolean}
	 *      True if it already skipping or when it has ended skipping,
	 *      false if the next slide needs to be displayed.
	 */
	skipAllEffects() {
		if (this.bIsSkippingAll) return true;

		this.bIsSkippingAll = true;

		if (this.isTransitionPlaying()) {
			this.skipTransition();
		}

		if (this.isAnyEffectPlaying()) {
			this.skipAllPlayingEffects();
		} else if (
			!this.aNextEffectEventArray ||
			this.nCurrentEffect >= this.aNextEffectEventArray.size()
		) {
			this.bIsSkippingAll = false;
			return false;
		}

		// Pay attention here: a new next effect event is appended to
		// aNextEffectEventArray only after the related animation node has been
		// resolved, that is only after the animation node related to the previous
		// effect has notified to be deactivated to the main sequence time container.
		// So you should avoid any optimization here because the size of
		// aNextEffectEventArray will going on increasing after every skip action.
		while (this.nCurrentEffect < this.aNextEffectEventArray.size()) {
			this.skipNextEffect();
		}
		this.bIsSkippingAll = false;
		return true;
	}

	/** rewindTransition
	 * Rewind the current playing slide transition.
	 */
	rewindTransition() {
		if (this.bIsSkipping || this.bIsRewinding) return;

		this.bIsRewinding = true;
		this.aActivityQueue.endAll();
		this.update();
		this.bIsRewinding = false;
	}

	/** rewindEffect
	 *  Rewind all the effects started after at least one of the current playing
	 *  effects. If there is no playing effect, it rewinds the last played one,
	 *  both in case it belongs to the main or to an interactive animation sequence.
	 *
	 */
	rewindEffect() {
		if (this.bIsSkipping || this.bIsRewinding) return;

		if (
			this.automaticAdvanceTimeout !== null &&
			!this.automaticAdvanceTimeoutRewindedEffect
		) {
			clearTimeout(this.automaticAdvanceTimeout as number);
			this.automaticAdvanceTimeout = { rewindedEffect: this.nCurrentEffect };
		}

		if (!this.hasAnyEffectStarted()) {
			this.rewindToPreviousSlide();
			return;
		}

		this.bIsRewinding = true;

		let nFirstPlayingEffectIndex = undefined;

		let i = 0;
		for (; i < this.aStartedEffectList.length; ++i) {
			const aEffect = this.aStartedEffectList[i];
			if (aEffect.isPlaying()) {
				nFirstPlayingEffectIndex = i;
				break;
			}
		}

		// There is at least one playing effect.
		if (nFirstPlayingEffectIndex !== undefined) {
			i = this.aStartedEffectList.length - 1;
			for (; i >= nFirstPlayingEffectIndex; --i) {
				const aEffect = this.aStartedEffectList[i];
				if (aEffect.isPlaying()) {
					if (aEffect.isMainEffect()) {
						this.aEventMultiplexer.notifyRewindCurrentEffectEvent();
						if (this.nCurrentEffect > 0) --this.nCurrentEffect;
					} else {
						this.aEventMultiplexer.notifyRewindRunningInteractiveEffectEvent(
							aEffect.getId(),
						);
					}
				} else if (aEffect.isEnded()) {
					if (aEffect.isMainEffect()) {
						this.aEventMultiplexer.notifyRewindLastEffectEvent();
						if (this.nCurrentEffect > 0) --this.nCurrentEffect;
					} else {
						this.aEventMultiplexer.notifyRewindEndedInteractiveEffectEvent(
							aEffect.getId(),
						);
					}
				}
			}
			this.update();

			// Pay attention here: we need to remove all rewinded effects from
			// the started effect list only after updating.
			i = this.aStartedEffectList.length - 1;
			for (; i >= nFirstPlayingEffectIndex; --i) {
				const aEffect = this.aStartedEffectList.pop();
				if (!aEffect.isMainEffect())
					this.aStartedEffectIndexMap.delete(aEffect.getId());
			}
		} // there is no playing effect
		else {
			const aEffect = this.aStartedEffectList.pop();
			if (!aEffect.isMainEffect())
				this.aStartedEffectIndexMap.delete(aEffect.getId());
			if (aEffect.isEnded()) {
				// Well that is almost an assertion.
				if (aEffect.isMainEffect()) {
					this.aEventMultiplexer.notifyRewindLastEffectEvent();
					if (this.nCurrentEffect > 0) --this.nCurrentEffect;
				} else {
					this.aEventMultiplexer.notifyRewindEndedInteractiveEffectEvent(
						aEffect.getId(),
					);
				}
			}
			this.update();
		}

		this.bIsRewinding = false;
	}

	/** rewindToPreviousSlide
	 *  Displays the previous slide with all effects, that belong to the main
	 *  animation sequence, played.
	 *
	 */
	rewindToPreviousSlide() {
		if (this.isTransitionPlaying()) {
			this.rewindTransition();
			return;
		}
		if (this.isAnyEffectPlaying()) return;

		const nCurSlide = this.theMetaPres.getCurrentSlideIndex();
		const nNewSlide = nCurSlide - 1;
		this.displaySlide(nNewSlide, true);
		this.skipAllEffects();
	}

	/** rewindAllEffects
	 *  Rewind all effects already played on the current slide.
	 *
	 */
	rewindAllEffects() {
		if (!this.hasAnyEffectStarted()) {
			this.rewindToPreviousSlide();
			return;
		}

		while (this.hasAnyEffectStarted()) {
			this.rewindEffect();
		}
	}

	displaySlide(nNewSlide: number, bSkipSlideTransition: boolean) {
		const aMetaDoc = this.theMetaPres;
		if (nNewSlide >= aMetaDoc.numberOfSlides) {
			this.exitSlideShow();
		}

		if (this.isTransitionPlaying()) {
			this.skipTransition();
		}

		// handle current slide
		const nOldSlide = aMetaDoc.getCurrentSlideIndex();
		if (nOldSlide !== undefined) {
			var oldMetaSlide = aMetaDoc.getMetaSlideByIndex(nOldSlide);
			if (this.isEnabled()) {
				if (oldMetaSlide.animationsHandler.isAnimated()) {
					// force end animations
					oldMetaSlide.animationsHandler.end(bSkipSlideTransition);

					// clear all queues
					this.dispose();
				}
			}

			if (this.automaticAdvanceTimeout !== null) {
				window.clearTimeout(this.automaticAdvanceTimeout as number);
				this.automaticAdvanceTimeout = null;
			}
		}

		this.notifySlideStart(nNewSlide, nOldSlide);

		if (this.isEnabled() && !bSkipSlideTransition) {
			// create slide transition and add to activity queue
			if (nOldSlide === undefined || nNewSlide > nOldSlide) {
				let aOldMetaSlide;
				if (nOldSlide === undefined) {
					// for transition on start slide
					aOldMetaSlide = null; // aMetaDoc.getDummyMetaSlide()
				} else {
					aOldMetaSlide = aMetaDoc.getMetaSlideByIndex(nOldSlide);
				}
				const aNewMetaSlide = aMetaDoc.getMetaSlideByIndex(nNewSlide);

				var aSlideTransitionHandler = aNewMetaSlide.transitionHandler;
				if (aSlideTransitionHandler && aSlideTransitionHandler.isValid()) {
					const aLeavingSlide = aOldMetaSlide;
					const aEnteringSlide = aNewMetaSlide;
					const aTransitionEndEvent = makeEvent(
						this.notifyTransitionEnd.bind(this, nNewSlide),
					);

					const aTransitionActivity = this.createSlideTransition(
						aSlideTransitionHandler,
						null, // transitionParameters,
						aTransitionEndEvent,
					);

					if (aTransitionActivity) {
						this.bIsTransitionRunning = true;
						this.aActivityQueue.addActivity(aTransitionActivity);
						this.update();
					} else {
						this.notifyTransitionEnd(nNewSlide);
					}
				} else {
					this.notifyTransitionEnd(nNewSlide);
				}
			} else {
				this.notifyTransitionEnd(nNewSlide);
			}
		} else {
			this.notifyTransitionEnd(nNewSlide);
		}
	}

	exitSlideShow() {
		// TODO: implement it;
	}

	update() {
		this.aTimer.holdTimer();

		// process queues
		this.aTimerEventQueue.process();
		this.aActivityQueue.process();

		this.aFrameSynchronization.synchronize();

		this.aActivityQueue.processDequeued();

		this.aTimer.releaseTimer();

		var bActivitiesLeft = !this.aActivityQueue.isEmpty();
		var bTimerEventsLeft = !this.aTimerEventQueue.isEmpty();
		var bEventsLeft = bActivitiesLeft || bTimerEventsLeft;

		if (bEventsLeft) {
			var nNextTimeout;
			if (bActivitiesLeft) {
				nNextTimeout = SlideShowHandler.MINIMUM_TIMEOUT;
				this.aFrameSynchronization.activate();
			} else {
				nNextTimeout = this.aTimerEventQueue.nextTimeout();
				if (nNextTimeout < SlideShowHandler.MINIMUM_TIMEOUT)
					nNextTimeout = SlideShowHandler.MINIMUM_TIMEOUT;
				else if (nNextTimeout > SlideShowHandler.MAXIMUM_TIMEOUT)
					nNextTimeout = SlideShowHandler.MAXIMUM_TIMEOUT;
				this.aFrameSynchronization.deactivate();
			}

			this.bIsIdle = false;
			window.setTimeout('aSlideShow.update()', nNextTimeout * 1000);
		} else {
			this.bIsIdle = true;
		}
	}

	dispose() {
		// clear all queues
		this.aTimerEventQueue.clear();
		this.aActivityQueue.clear();
		this.aNextEffectEventArray = null;
		this.aEventMultiplexer = null;
	}

	getContext() {
		return this.aContext;
	}
}
