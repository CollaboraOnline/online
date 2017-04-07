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
		this.socket.send('subscribe adddoc rmdoc resetidle propchange');

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
		$('body').on('contextmenu', 'table tr', function(ev) {
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
				userListJson = docProps['views']

				$doc = $('#doc' + sPid);
				$rowContainer = $(document.createElement('tr')).attr('id', 'doc' + sPid);
				$pid = $(document.createElement('td')).text(sPid);
				$userContainer = $(document.createElement('div')).attr('id', 'ucontainer' + sPid)
										  .addClass('userContainer');
				for (var j = 0; j < userListJson.length; j++) {
					$user = $(document.createElement('div')).text(userListJson[j]['userName'])
													.attr('id', 'user' + userListJson[j]['sessionid']);
					$userContainer.append($user);
				}
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
										  .addClass('userContainer');
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

				$('#doclist').append($rowContainer);

				$a = $(document.getElementById('active_docs_count'));
				$a.text(parseInt($a.text()) + 1);
			}

			$views = $(document.getElementById('docview' + sPid));
			nViews = parseInt($views.text());
			$views.text(nViews + 1);

			$userContainer = $(document.getElementById('ucontainer' + sPid));
			$user = $(document.createElement('div')).text(uName)
													.attr('id', 'user' + sessionid);
			$userContainer.append($user);

			$a = $(document.getElementById('active_users_count'));
			nTotalViews = parseInt($a.text());
			$a.text(nTotalViews + 1);
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
	},

	onSocketClose: function() {
		clearInterval(this._basicStatsIntervalId);
		clearInterval(this._docElapsedTimeIntervalId);
	}
});

Admin.Overview = function(host) {
	return new AdminSocketOverview(host);
};
