/* -*- js-indent-level: 8 -*- */
/*
	Socket to be intialized on opening the overview page in Admin console
*/
/* global DlgYesNo _ vex $ Util AdminSocketBase Admin */

function appendDocRow(document, $rowContainer, $userContainer, sPid, sName, sViews, sMem, sDocTime, sDocIdle, modified, socket) {
	var $sessionCloseCell = $(document.createElement('td')).text('✖'); // This cell will open "Do you want to kill this session?" dialog.
	$rowContainer.append($sessionCloseCell);
	$sessionCloseCell.addClass('has-text-centered');
	$sessionCloseCell.css('cursor', 'pointer');
	$sessionCloseCell.click(function() {
		var dialog = (new DlgYesNo())
		.title(_('Confirmation'))
		.text(_('Are you sure you want to terminate this session?'))
		.yesButtonText(_('OK'))
		.noButtonText(_('Cancel'))
		.type('warning')
		.yesFunction(function() {
			socket.send('kill ' + sPid);
		});
		dialog.open();
	});

	var $pid = $(document.createElement('td')).text(sPid);
	$pid.append($userContainer);
	$rowContainer.append($pid);

	var $name = $(document.createElement('td')).text(sName);
	$rowContainer.append($name);

	var $views = $(document.createElement('td')).attr('id', 'docview' + sPid)
									.text(sViews);
	$rowContainer.append($views);

	var $mem = $(document.createElement('td')).attr('id', 'docmem' + sPid)
	.text(Util.humanizeMem(parseInt(sMem)));
	$rowContainer.append($mem);

	var $docTime = $(document.createElement('td')).addClass('elapsed_time')
	.val(parseInt(sDocTime))
	.text(Util.humanizeSecs(sDocTime));
	$rowContainer.append($docTime);

	var $docIdle = $(document.createElement('td')).attr('id', 'docidle' + sPid)
	.addClass('idle_time')
	.val(parseInt(sDocIdle))
	.text(Util.humanizeSecs(sDocIdle));
	$rowContainer.append($docIdle);

	var $mod = $(document.createElement('td')).attr('id', 'mod' + sPid).text(modified);
	$rowContainer.append($mod);
}

var AdminSocketOverview = AdminSocketBase.extend({
	constructor: function(host) {
		this.base(host);
	},

	_basicStatsIntervalId: 0,

	_docElapsedTimeIntervalId: 0,

	_getBasicStats: function() {
		this.socket.send('mem_consumed');
		this.socket.send('active_docs_count');
		this.socket.send('active_users_count');
		this.socket.send('sent_bytes');
		this.socket.send('recv_bytes');
		this.socket.send('uptime');
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

		// Dialog uses <a href='#' - which triggers popstate
		vex.defaultOptions.closeAllOnPopState = false;

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

		$('body').on('click', '#rowContextMenu a', function() {
			vex.dialog.confirm({
				message: _('Are you sure you want to terminate this session?'),
				buttons: [
					$.extend({}, vex.dialog.buttons.YES, { text: _('OK') }),
					$.extend({}, vex.dialog.buttons.NO, { text: _('Cancel') })
				],
				callback: function(value) {
					if (value) {
						var killPid = ($('#rowContextMenu').data('rowToKill')).substring('doc'.length);
						socketOverview.socket.send('kill ' + killPid);
					}
					$('#rowContextMenu').hide();
				}
			});
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

		var $doc, $a, $rowContainer;
		var nViews, nTotalViews;
		var docProps, sPid, sName, sViews, sMem, sDocTime, sDocIdle, modified, userListJson;
		if (textMsg.startsWith('documents')) {
			var jsonStart = textMsg.indexOf('{');
			var jsonMsg = JSON.parse(textMsg.substr(jsonStart).trim());
			var docList = jsonMsg['documents'];
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
				var $userContainer = $(document.createElement('div')).attr('id', 'ucontainer' + sPid)
										  .addClass('userContainer dropdown');
				var $listContainer = $(document.createElement('ul')).addClass('dropdown-menu');
				var $listLabel = $(document.createElement('li')).addClass('dropdown-header')
															.text('Users');
				$listContainer.append($listLabel);

				for (var j = 0; j < userListJson.length; j++) {
					var $user = $(document.createElement('li')).attr('id', 'user' + userListJson[j]['sessionid']);
					var $userA = $(document.createElement('a')).text(userListJson[j]['userName']);
					$user.append($userA);
					$listContainer.append($user);

					var sessionid = userListJson[j]['sessionid'];
					var encodedUId = encodeURI(userListJson[j]['userId']);

					var $userListRow = $(document.getElementById('usr' + encodedUId));

					if ($userListRow.length == 0) {

						$userListRow = $(document.createElement('tr')).attr('id', 'usr' + encodedUId);

						var $uName = $(document.createElement('td')).text(userListJson[j]['userName']);
						$userListRow.append($uName);

						$number = $(document.createElement('div')).addClass('doc_number').attr('id', 'num' + encodedUId).text(1);
						var $noOfDocuments = $(document.createElement('td')).append($number);
						// Document List
						var $docListContainer = $(document.createElement('div')).addClass('dropdown docContainer');
						var $docDropDown = $(document.createElement('ul')).addClass('dropdown-menu')
						    .attr('id', 'docListContainer_' + encodedUId);
						var $docListHeader = $(document.createElement('li')).addClass('dropdown-header')
						    .text(_('Documents'));
						var $name = $(document.createElement('a')).text(sName);
						var $docentry = $(document.createElement('li')).addClass('docentry')
						    .attr('id', sessionid + '_' + sPid)
						    .append($name);
						$docDropDown.append($docListHeader);
						$docDropDown.append($docentry);
						$docListContainer.append($docDropDown);
						$noOfDocuments.append($docListContainer);

						$userListRow.append($noOfDocuments);

						$('#userlist').append($userListRow);
					}
					else {
						var $number = $(document.getElementById('num' + encodedUId));
						var docCount = parseInt($number.text());
						$number.text(docCount + 1);
						$name = $(document.createElement('a')).text(sName);
						$docentry = $(document.createElement('li')).addClass('docentry')
												.attr('id', sessionid + '_' + sPid)
												.append($name);

						$(document.getElementById('docListContainer_' + encodedUId)).append($docentry);
					}
				}
				$userContainer.append($listContainer);

				appendDocRow(document, $rowContainer, $userContainer, sPid, sName, sViews, sMem, sDocTime, sDocIdle, modified, this.socket);

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
			var uName = decodeURI(docProps[3]);
			encodedUId = encodeURI(docProps[4]);
			sMem = docProps[5];

			$doc = $('#doc' + sPid);
			if ($doc.length === 0) {
				$rowContainer = $(document.createElement('tr')).attr('id', 'doc' + sPid);

				$userContainer = $(document.createElement('div')).attr('id', 'ucontainer' + sPid)
										  .addClass('userContainer dropdown');
				$listContainer = $(document.createElement('ul')).addClass('dropdown-menu');
				$listLabel = $(document.createElement('li')).addClass('dropdown-header')
													.text('Users');
				$listContainer.append($listLabel);
				$userContainer.append($listContainer);

				appendDocRow(document, $rowContainer, $userContainer, sPid, sName, '0', sMem, '0', '0', '', this.socket);

				$('#doclist').append($rowContainer);

				$a = $(document.getElementById('active_docs_count'));
				$a.text(parseInt($a.text()) + 1);
			}

			var $views = $(document.getElementById('docview' + sPid));
			nViews = parseInt($views.text());
			$views.text(nViews + 1);

			$userContainer = $(document.getElementById('ucontainer' + sPid));
			var $list = $('ul', $userContainer);
			$user = $(document.createElement('li')).attr('id', 'user' + sessionid);
			$userA = $(document.createElement('a')).text(uName);
			$user.append($userA);
			$list.append($user);
			$userContainer.append($list);

			$a = $(document.getElementById('active_users_count'));
			nTotalViews = parseInt($a.text());
			$a.text(nTotalViews + 1);

			$userListRow = $(document.getElementById('usr' + encodedUId));
			if ($userListRow.length === 0) {

				$userListRow = $(document.createElement('tr')).attr('id', 'usr' + encodedUId);

				$uName = $(document.createElement('td')).text(uName);
				$userListRow.append($uName);

				$number = $(document.createElement('div')).addClass('doc_number').attr('id', 'num' + encodedUId).text(1);
				$noOfDocuments = $(document.createElement('td')).append($number);

				// Document List
				$docListContainer = $(document.createElement('div')).addClass('dropdown docContainer');
				$docDropDown = $(document.createElement('ul')).addClass('dropdown-menu')
										.attr('id', 'docListContainer_' + encodedUId);
				$docListHeader = $(document.createElement('li')).addClass('dropdown-header')
										.text(_('Documents'));
				$name = $(document.createElement('a')).text(sName);
				$docentry = $(document.createElement('li')).addClass('docentry')
										.attr('id', sessionid + '_' + sPid)
										.append($name);
				$docDropDown.append($docListHeader);
				$docDropDown.append($docentry);
				$docListContainer.append($docDropDown);
				$noOfDocuments.append($docListContainer);

				$userListRow.append($noOfDocuments);

				$('#userlist').append($userListRow);
			}
			else {
				$number = $(document.getElementById('num' + encodedUId));
				docCount = parseInt($number.text());
				$number.text(docCount + 1);
				$name = $(document.createElement('a')).text(sName);
				$docentry = $(document.createElement('li')).addClass('docentry')
										.attr('id', sessionid + '_' + sPid)
										.append($name);

				$(document.getElementById('docListContainer_' + encodedUId)).append($docentry);
			}
		}
		else if (textMsg.startsWith('mem_consumed') ||
			textMsg.startsWith('active_docs_count') ||
			textMsg.startsWith('active_users_count') ||
			textMsg.startsWith('sent_bytes') ||
			textMsg.startsWith('recv_bytes') ||
			textMsg.startsWith('uptime'))
		{
			textMsg = textMsg.split(' ');
			var sCommand = textMsg[0];
			var nData = parseInt(textMsg[1]);

			if (sCommand === 'mem_consumed' ||
			    sCommand === 'sent_bytes' ||
			    sCommand === 'recv_bytes') {
				nData = Util.humanizeMem(nData);
			}
			else if (sCommand === 'uptime') {
				nData = Util.humanizeSecs(nData);
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

			var $docEntry = $('#' + sessionid + '_' + sPid);
			$user = $docEntry.parent().parent().parent();
			var $nDocs = $('.doc_number', $user.parent());
			docCount = parseInt($nDocs.text());
			if (docCount == 1) {
				$user.parent().remove();
			}
			else {
				$docEntry.remove();
				$nDocs.text(docCount - 1);
			}
		}
		else if (textMsg.startsWith('propchange')) {
			textMsg = textMsg.substring('propchange'.length);
			docProps = textMsg.trim().split(' ');
			sPid = docProps[0];
			var sProp = docProps[1];
			var sValue = docProps[2];

			$doc = $('#doc' + sPid);
			if ($doc.length !== 0) {
				if (sProp == 'mem') {
					var $mem = $('#docmem' + sPid);
					$mem.text(Util.humanizeMem(parseInt(sValue)));
				}
			}
		}
		else if (textMsg.startsWith('modifications')) {
			textMsg = textMsg.substring('modifications'.length);
			docProps = textMsg.trim().split(' ');
			sPid = docProps[0];
			var value = docProps[1];

			var $mod = $(document.getElementById('mod' + sPid));
			$mod.text(value);
		}
		else if (e.data == 'InvalidAuthToken' || e.data == 'NotAuthenticated') {
			var msg;
			if (window.location.protocol === 'http:')
			{
				// Browsers refuse to overwrite the jwt cookie in this case.
				msg =  _('Failed to set jwt authentication cookie over insecure connection');
			}
			else
			{
				msg =  _('Failed to authenticate this session over protocol %0');
				msg = msg.replace('%0', window.location.protocol);
			}
			vex.dialog.alert({ message: msg });
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
