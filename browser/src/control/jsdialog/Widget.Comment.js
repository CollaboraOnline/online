/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * JSDialog.rootCommentControl, JSDialog.commentControl - comment widgets
 */

/* global $ _ app JSDialog */

JSDialog._createComment = function (container, data) {
	// Create annotation copy and add it into the container.
	container.appendChild(data.annotation.sectionProperties.container);

	data.annotation.show();
	data.annotation.update();
	data.annotation.setExpanded();
};

JSDialog._emptyCommentWizard = function (parentContainer, data, builder) {
	window.L.DomUtil.addClass(parentContainer, 'content-has-no-comments');
	var emptyCommentWizard = window.L.DomUtil.create(
		'figure',
		'empty-comment-wizard-container',
		parentContainer,
	);
	var imgNode = window.L.DomUtil.create(
		'img',
		'empty-comment-wizard-img',
		emptyCommentWizard,
	);
	app.LOUtil.setImage(imgNode, 'lc_showannotations.svg', builder.map);
	imgNode.alt = data.text;

	var textNode = window.L.DomUtil.create(
		'figcaption',
		'empty-comment-wizard',
		emptyCommentWizard,
	);
	textNode.innerText = data.text;
	window.L.DomUtil.create('br', 'empty-comment-wizard', textNode);
	if (app.isCommentEditingAllowed()) {
		var linkNode = window.L.DomUtil.create(
			'div',
			'empty-comment-wizard-link',
			textNode,
		);
		linkNode.innerText = _('Insert Comment');
		linkNode.onclick = builder.map.insertComment.bind(builder.map);
	}
};

JSDialog.rootCommentControl = function (parentContainer, data, builder) {
	if (data.type === 'emptyCommentWizard') {
		builder._emptyCommentWizard(parentContainer, data, builder);
		return;
	}

	var mainContainer = document.getElementById(
		'explorable-entry level-' + builder._currentDepth + ' ' + data.id,
	);
	if (!mainContainer)
		mainContainer = window.L.DomUtil.create(
			'div',
			'ui-explorable-entry level-' +
				builder._currentDepth +
				' ' +
				builder.options.cssClass,
			parentContainer,
		);

	mainContainer.id =
		'explorable-entry level-' + builder._currentDepth + ' ' + data.id;

	var container = document.getElementById(data.id);
	if (!container)
		container = window.L.DomUtil.create(
			'div',
			'ui-header cool-annotation-header level-' +
				builder._currentDepth +
				' ' +
				builder.options.cssClass +
				' ui-widget',
			mainContainer,
		);

	container.annotation = data.annotation;
	container.id = data.id;
	builder._createComment(container, data);
	if (
		data.children.length > 1 &&
		mainContainer.id !== 'comment-thread' + data.id
	) {
		var numberOfReplies = data.children.length - 1;
		if (numberOfReplies > 0) {
			var replyCountNode = document.getElementById(
				'reply-count-node-' + data.id,
			);

			if (!replyCountNode)
				replyCountNode = window.L.DomUtil.create(
					'div',
					'cool-annotation-reply-count cool-annotation-content',
					$(container).find('.cool-annotation-content-wrapper')[0],
				);

			replyCountNode.id = 'reply-count-node-' + data.id;
			replyCountNode.style.display = 'block';

			var replyCountText;
			if (numberOfReplies === 1) {
				replyCountText = numberOfReplies + ' ' + _('reply');
			} else {
				replyCountText = numberOfReplies + ' ' + _('replies');
			}
			$(replyCountNode).text(replyCountText);
		}

		var childContainer = document.getElementById('comment-thread' + data.id);

		if (!childContainer)
			childContainer = window.L.DomUtil.create(
				'div',
				'ui-content level-' +
					builder._currentDepth +
					' ' +
					builder.options.cssClass,
				mainContainer,
			);

		childContainer.id = 'comment-thread' + data.id;
		childContainer.title = _('Comment');

		$(childContainer).hide();

		if (builder.wizard) {
			if ($(container).find('.cool-annotation-menubar').length > 0)
				$(container).find('.cool-annotation-menubar')[0].style.display = 'none';

			var arrowSpan = container.querySelector(
				"[id='arrow span " + data.id + "']",
			);

			if (!arrowSpan)
				arrowSpan = window.L.DomUtil.create(
					'span',
					'sub-menu-arrow',
					$(container).find('.cool-annotation-content-wrapper')[0],
				);

			arrowSpan.style.display = 'block';
			arrowSpan.textContent = '>';
			arrowSpan.style.padding = '0px';
			arrowSpan.id = 'arrow span ' + data.id;

			$(container).find('.cool-annotation')[0].onclick = function () {
				builder.wizard.goLevelDown(mainContainer);
				childContainer.style.display = 'block';
				if (!childContainer.childNodes.length)
					builder.build(childContainer, data.children);
			};

			var backButton = document.getElementById('mobile-wizard-back');

			backButton.onclick = function () {
				if (backButton.className !== 'close-button') {
					if (!mainContainer.childNodes.length)
						builder.build(mainContainer, data);
					if (data.type === 'rootcomment') {
						var temp = document.getElementById('comment-thread' + data.id);
						if (temp) temp.style.display = 'block';
					}
				}
			};
		}
	}

	$(container)
		.find('.cool-annotation')[0]
		.addEventListener('click', function () {
			app.sectionContainer
				.getSectionWithName(app.CSections.CommentList.name)
				.highlightComment(data.annotation);
		});
	return false;
};

JSDialog.commentControl = function (parentContainer, data, builder) {
	builder._createComment(parentContainer, data, false);
	return false;
};
