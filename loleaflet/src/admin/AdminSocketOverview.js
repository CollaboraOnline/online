/*
	Socket to be intialized on opening the overview page in Admin console
*/
/* global vex $ Util AdminSocketBase */
/* eslint no-unused-vars:0 */
var AdminSocketOverview = AdminSocketBase.extend({
	constructor: function(host) {
		this.base(host);
	},

	_basicStatsIntervalId: 0,

	_docElapsedTimeIntervalId: 0,

	_getBasicStats: function() {
		this.socket.send('total_mem');
		this.socket.send('active_docs_count');
		this.socket.send('active_users_count');
	},

	onSocketOpen: function() {
		// Base class' onSocketOpen handles authentication
		this.base.call(this);

		this.socket.send('documents');
		this.socket.send('subscribe adddoc rmdoc resetidle propchange modifications');

		this._getBasicStats();
		var socketOverview = this;
		this._basicStatsIntervalId =
		setInterval(function() {
			return socketOverview._getBasicStats();
		}, 5000);

		this._docElapsedTimeIntervalId =
		setInterval(function() {
			$('td.elapsed_time').each(function() {
				var newSecs = parseInt($(this).val()) + 1;
				$(this).val(newSecs);
				$(this).html(Util.humanizeSecs(newSecs));
			});
			$('td.idle_time').each(function() {
				var newSecs = parseInt($(this).val()) + 1;
				$(this).val(newSecs);
				$(this).html(Util.humanizeSecs(newSecs));
			});
		}, 1000);

		// Allow table rows to have a context menu for terminating sessions
		$('body').on('contextmenu', '#docview tr', function(ev) {
			$('#rowContextMenu').css({
				display: 'block',
				left: ev.pageX,
				top: ev.pageY
			})
			.data('rowToKill', ev.target.parentElement.id);

			return false;
		})
		.click(function() {
			$('#rowContextMenu').hide();
		});

		$('#rowContextMenu').on('click', 'a', function() {
			vex.dialog.confirm({
				message: _('Are you sure you want to terminate this session?'),
				callback: function(value) {
					if (value) {
						var killPid = ($('#rowContextMenu').data('rowToKill')).substring('doc'.length);
						socketOverview.socket.send('kill ' + killPid);
					}
					$('#rowContextMenu').hide();
				}
			});
		});

		$('.view-opt-button').on('click', function() {
			$('#docview-btn').toggleClass('selected-view-opt');
			$('#userview-btn').toggleClass('selected-view-opt');
			$('#docview').toggle();
			$('#userview').toggle();
		});

		$('body').on('click', '#userlist .doc_list_label', function() {
			if ($(this).text() === '🢃 list') {
				docName = $($('.docentry', $(this).parent())[0]).text();
				$user = $(this).parent().parent();
				docCount = parseInt($('.doc_number', $user).text()) - 1 ;
				$(this).text('🡺 ' + docName + ' and ' + String(docCount) + ' other docs');
			}
			else
				$(this).text('🢃 list');
			$('.docentry', $(this).parent()).toggle();
		});
	},

	onSocketMessage: function(e) {
		var textMsg;
		if (typeof e.data === 'string') {
			textMsg = e.data;
		}
		else {
			textMsg = '';
		}

		var $rowContainer;
		var $pid, $name, $views, $mem, $docTime, $docIdle, $doc, $a;
		var nViews, nTotalViews;
		var docProps, sPid, sName, sViews, sMem, sDocTime;
		if (textMsg.startsWith('documents')) {
			jsonStart = textMsg.indexOf('{');
			jsonMsg = JSON.parse(textMsg.substr(jsonStart).trim());
			docList = jsonMsg['documents'];
			for (var i = 0; i < docList.length; i++) {

				docProps = docList[i];
				sPid = docProps['pid'];
				sName = decodeURI(docProps['fileName']);
				sViews = docProps['activeViews'];
				sMem = docProps['memory'];
				sDocTime = docProps['elapsedTime'];
				sDocIdle = docProps['idleTime'];
				modified = docProps['modified'];
				userListJson = docProps['views'];

				$doc = $('#doc' + sPid);
				$rowContainer = $(document.createElement('tr')).attr('id', 'doc' + sPid);
				$pid = $(document.createElement('td')).text(sPid);
				$userContainer = $(document.createElement('div')).attr('id', 'ucontainer' + sPid)
										  .addClass('userContainer dropdown');
				$listContainer = $(document.createElement('ul')).addClass('dropdown-menu');
				$listLabel = $(document.createElement('li')).addClass('dropdown-header')
															.text('Users');
				$listContainer.append($listLabel);

				for (var j = 0; j < userListJson.length; j++) {
					$user = $(document.createElement('li')).attr('id', 'user' + userListJson[j]['sessionid']);
					$userA = $(document.createElement('a')).text(userListJson[j]['userName']);
					$user.append($userA);
					$listContainer.append($user);

					sessionid = userListJson[j]['sessionid'];
					encodedUName = userListJson[j]['userName'].replace(/ /g, '');
					// this isn't the right way to do this, but we can't also use encode here. what should we do then.

					$userListRow = $('#usr' + encodedUName);

					if ($userListRow.length == 0) {

						$userListRow = $(document.createElement('tr')).attr('id', 'usr' + encodedUName);

						$uName = $(document.createElement('td')).text(userListJson[j]['userName']);
						$userListRow.append($uName);

						$noOfDocuments = $(document.createElement('td')).addClass('doc_number')
																	.text('1');
						$userListRow.append($noOfDocuments);

						$docList = $(document.createElement('td')).addClass('doc_list');
						$docLabel = $(document.createElement('div')).addClass('doc_list_label');
						$docentry = $(document.createElement('div')).addClass('docentry')
																.attr('id', sessionid + '_' + sPid)
																.text(sName);
						$docList.append($docLabel);
						$docList.append($docentry);
						$userListRow.append($docList);

						$('#userlist').append($userListRow);
					}
					else {
						userListChildren = $userListRow[0].childNodes;

						docCount = parseInt($(userListChildren[1]).text())
						$(userListChildren[1]).text(docCount + 1);

						$docLabel = $(userListChildren[2].getElementsByClassName('doc_list_label')[0]);
						$docLabel.text('🡺 ' + sName + ' and ' + String(docCount) + ' other docs');

						$('.docentry', $('userListChildren[2]').hide());

						$docentry = $(document.createElement('div')).addClass('docentry')
																.attr('id', sessionid + '_' + sPid)
																.text(sName);

						$(userListChildren[2]).append($docentry);
						$('.docentry', $userListRow).css('display', 'none');
					}
				}
				$userContainer.append($listContainer);
				$pid.append($userContainer);
				$rowContainer.append($pid);

				$name = $(document.createElement('td')).text(sName);
				$rowContainer.append($name);

				$views = $(document.createElement('td')).attr('id', 'docview' + sPid)
									    .text(sViews);
				$rowContainer.append($views);

				$mem = $(document.createElement('td')).attr('id', 'docmem' + sPid)
						.text(Util.humanizeMem(parseInt(sMem)));
				$rowContainer.append($mem);

				$docTime = $(document.createElement('td')).addClass('elapsed_time')
									      .val(parseInt(sDocTime))
									      .text(Util.humanizeSecs(sDocTime));
				$rowContainer.append($docTime);

				$docIdle = $(document.createElement('td')).attr('id', 'docidle' + sPid)
									      .addClass('idle_time')
									      .val(parseInt(sDocIdle))
									      .text(Util.humanizeSecs(sDocIdle));
				$rowContainer.append($docIdle);

				$mod = $(document.createElement('td')).attr('id', 'mod' + sPid)
										  .text(modified);
				$rowContainer.append($mod);

				$('#doclist').append($rowContainer);
			}
		}
		else if (textMsg.startsWith('resetidle')) {
			textMsg = textMsg.substring('resetidle'.length);
			docProps = textMsg.trim().split(' ');
			sPid = docProps[0];
			var $idle = $(document.getElementById('docidle' + sPid));
			$idle.val(0).text(Util.humanizeSecs(0));
		}
		else if (textMsg.startsWith('adddoc')) {
			textMsg = textMsg.substring('adddoc'.length);
			docProps = textMsg.trim().split(' ');
			sPid = docProps[0];
			sName = decodeURI(docProps[1]);
			sessionid = docProps[2];
			uName = decodeURI(docProps[3]);
			sMem = docProps[4];

			$doc = $('#doc' + sPid);
			if ($doc.length === 0) {
				$rowContainer = $(document.createElement('tr')).attr('id', 'doc' + sPid);

				$pid = $(document.createElement('td')).text(sPid);
				$userContainer = $(document.createElement('div')).attr('id', 'ucontainer' + sPid)
										  .addClass('userContainer dropdown');
				$listContainer = $(document.createElement('ul')).addClass('dropdown-menu');
				$listLabel = $(document.createElement('li')).addClass('dropdown-header')
															.text('Users');
				$listContainer.append($listLabel);
				$userContainer.append($listContainer);
				$pid.append($userContainer);
				$rowContainer.append($pid);

				$name = $(document.createElement('td')).text(sName);
				$rowContainer.append($name);

				$views = $(document.createElement('td')).attr('id', 'docview' + sPid)
					                                    .text(0);
				$rowContainer.append($views);

				$mem = $(document.createElement('td')).text(Util.humanizeMem(parseInt(sMem)));
				$rowContainer.append($mem);

				$docTime = $(document.createElement('td')).addClass('elapsed_time')
					                                      .val(0)
					                                      .text(Util.humanizeSecs(0));
				$rowContainer.append($docTime);

				$docIdle = $(document.createElement('td')).attr('id', 'docidle' + sPid)
									      .addClass('idle_time')
					                                      .val(0)
					                                      .text(Util.humanizeSecs(0));
				$rowContainer.append($docIdle);

				$mod = $(document.createElement('td')).attr('id', 'mod' + sPid)
										  .text('');
				$rowContainer.append($mod);

				$('#doclist').append($rowContainer);

				$a = $(document.getElementById('active_docs_count'));
				$a.text(parseInt($a.text()) + 1);
			}

			$views = $(document.getElementById('docview' + sPid));
			nViews = parseInt($views.text());
			$views.text(nViews + 1);

			$userContainer = $(document.getElementById('ucontainer' + sPid));
			$list = $('ul', $userContainer)
			$user = $(document.createElement('li')).attr('id', 'user' + sessionid);
			$userA = $(document.createElement('a')).text(uName);
			$user.append($userA);
			$list.append($user);
			$userContainer.append($list);

			$a = $(document.getElementById('active_users_count'));
			nTotalViews = parseInt($a.text());
			$a.text(nTotalViews + 1);


			encodedUName = uName.replace(/ /g, '');
			$user = $('#usr' + encodedUName);
			if ($user.length === 0) {

				$userListRow = $(document.createElement('tr')).attr('id', 'usr' + encodedUName);

				$uName = $(document.createElement('td')).text(uName);
				$userListRow.append($uName);

				$noOfDocuments = $(document.createElement('td')).addClass('doc_number')
															.text('1');
				$userListRow.append($noOfDocuments);

				$docList = $(document.createElement('td')).addClass('doc_list');
				$docLabel = $(document.createElement('div')).addClass('doc_list_label');
				$docentry = $(document.createElement('div')).addClass('docentry')
														.attr('id', sessionid + '_' + sPid)
														.text(sName);
				$docList.append($docLabel);
				$docList.append($docentry);
				$userListRow.append($docList);

				$('#userlist').append($userListRow);
			}
			else {
				userListChildren = $user[0].childNodes;

				docCount = parseInt($(userListChildren[1]).text())
				$(userListChildren[1]).text(docCount + 1);

				$docLabel = $(userListChildren[2].getElementsByClassName('doc_list_label')[0]);
				$docLabel.text('🡺 ' + sName + ' and ' + String(docCount) + ' other docs');

				$docentry = $(document.createElement('div')).addClass('docentry')
														.attr('id', sessionid + '_' + sPid)
														.text(sName);

				$(userListChildren[2]).append($docentry);
				$('.docentry', $(userListChildren[2])).hide();
			}
		}
		else if (textMsg.startsWith('total_mem') ||
			textMsg.startsWith('active_docs_count') ||
			textMsg.startsWith('active_users_count'))
		{
			textMsg = textMsg.split(' ');
			var sCommand = textMsg[0];
			var nData = parseInt(textMsg[1]);

			if (sCommand === 'total_mem') {
				nData = Util.humanizeMem(nData);
			}
			$(document.getElementById(sCommand)).text(nData);
		}
		else if (textMsg.startsWith('rmdoc')) {
			textMsg = textMsg.substring('rmdoc'.length);
			docProps = textMsg.trim().split(' ');
			sPid = docProps[0];
			sessionid = docProps[1];

			$doc = $('#doc' + sPid);
			if ($doc.length !== 0) {
				$user = $(document.getElementById('user' + sessionid));
				$user.remove();
				$views = $('#docview' + sPid);
				nViews = parseInt($views.text()) - 1;
				$views.text(nViews);
				if (nViews === 0) {
					$doc.remove();
				}
				$a = $(document.getElementById('active_users_count'));
				nTotalViews = parseInt($a.text());
				$a.text(nTotalViews - 1);
			}

			$docEntry = $('#' + sessionid + '_' + sPid);
			$user = $docEntry.parent().parent();
			$nDocs = $('.doc_number', $user);
			docCount = parseInt($nDocs.text());
			if (docCount == 1) {
				$user.remove();
			}
			else if (docCount == 2) {
				$('.doc_list_label', $user).text('');
				$('.docentry', $user).show();
				$nDocs.text(docCount - 1);
				$docEntry.remove();
			}
			else {
				$parent = $docEntry.parent()
				$docEntry.remove();
				$child = $('.docentry', $parent);
				$('.doc_list_label', $user).text('🡺 ' + $($child[0]).text() + ' and ' + String(docCount - 2) + ' other docs')
				$('.docentry', $user).hide();
				$nDocs.text(docCount - 1);
			}
		}
		else if (textMsg.startsWith('propchange')) {
			textMsg = textMsg.substring('propchange'.length);
			docProps = textMsg.trim().split(' ');
			sPid = docProps[0];
			sProp = docProps[1];
			sValue = docProps[2];

			$doc = $('#doc' + sPid);
			if ($doc.length !== 0) {
				if (sProp == 'mem') {
					$mem = $('#docmem' + sPid);
					$mem.text(Util.humanizeMem(parseInt(sValue)));
				}
			}
		}
		else if (textMsg.startsWith('modifications')) {
			textMsg = textMsg.substring('modifications'.length);
			docProps = textMsg.trim().split(' ');
			sPid = docProps[0];
			value = docProps[1];

			$mod = $(document.getElementById('mod' + sPid));
			$mod.text(value);
		}
	},

	onSocketClose: function() {
		clearInterval(this._basicStatsIntervalId);
		clearInterval(this._docElapsedTimeIntervalId);
	}
});

Admin.Overview = function(host) {
	return new AdminSocketOverview(host);
};
