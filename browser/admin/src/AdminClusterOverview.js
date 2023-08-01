/* -*- js-indent-level: 8 -*- */
/*
    Socket to be intialized on opening the cluster overview page in Admin console
*/
/* global DlgLoading _ AdminSocketBase Admin d3 Map */

var AdminClusterOverview = AdminSocketBase.extend({
    constructor: function (host) {
        this.base(host);
    },

    _statsData: new Map(),
    _size: 20,

    _graphDimensions:{
        x: 756,
        y: 115,
    },

	_graphMargins: {
		top: 5,
		right: 0,
		bottom: 5,
		left: 25
	},

    addStat: function(serverId) {
        var interval = 5;
        var offset = 0;
        var memData = [];
        var cpuData = [];
        for (var i = 0; i < this._size ; i++) {
			memData.unshift({time: -(offset), value: 0});
			cpuData.unshift({time: -(offset), value: 0});
			offset += interval;
		}
        this._statsData.set(serverId, {
            mem:memData,
            cpu:cpuData,
        });
    },

    updateStat: function (serverId, mem, cpuUsage) {
        var stat = this._statsData.get(serverId);
        if (serverId) {
            for (var i=stat.mem.length - 1; i> 0; i--) {
                stat.mem[i].time = stat.mem[i-1].time;
                stat.cpu[i].time = stat.cpu[i-1].time;
            }

            stat.mem.push({time: 0, value: mem});
            stat.cpu.push({time: 0, value: cpuUsage});
            if (stat.mem.length > this._size) {
                stat.mem.shift();
            }
            if (stat.cpu.length > this._size) {
                stat.cpu.shift();
            }
        }
    },

    deleteStat: function(serverId) {
        this._statsData.delete(serverId);
    },

    createCard: function (server) {
        var card = document.createElement('div');
        card.className = 'tile is-child card';
        card.id = 'card-' + server.serverId;

        var cardContent = document.createElement('div');
        cardContent.className = 'card-content';

        var cardTitle = document.createElement('p');
        cardTitle.className = 'title has-text-centered';
        if (server.podname) {
            cardTitle.textContent = server.podname;
        } else {
            console.warn('podname doesnot exist, using serverId instead of podname on card title');
            cardTitle.textContent = server.serverId;
        }
        cardContent.appendChild(cardTitle);

        var mainTile = document.createElement('div');
        mainTile.className = 'tile is-fullwidth is-vertical';

        var cpuSubTitle = document.createElement('p');
        cpuSubTitle.className = 'tile is-fullwidth subtitle';
        cpuSubTitle.textContent = _('CPU History');
        cpuSubTitle.setAttribute('style', 'margin-bottom: 0rem !important');

        mainTile.appendChild(cpuSubTitle);

        var data = this._statsData.get(server.serverId);
        var tileParent = this.createGraph('cpu', data.cpu, server.cpu);
        mainTile.appendChild(tileParent);

        var memorySubTitle = document.createElement('p');
        memorySubTitle.className = 'tile is-fullwidth subtitle';
        memorySubTitle.textContent = _('Memory History');
        memorySubTitle.setAttribute('style', 'margin-bottom: 0rem !important; margin-top:1.5rem');

        mainTile.appendChild(memorySubTitle);

        tileParent = this.createGraph('mem',  data.mem, server.memory);
        mainTile.appendChild(tileParent);

        var horizontalTile = document.createElement('div');
        horizontalTile.className = 'tile is-fullwidth';
        tileParent = this.createParentTile(_('RouteToken'), server.routeToken, 'route');
        horizontalTile.appendChild(tileParent);

        tileParent = this.createParentTile(_('ServerId'), server.serverId, 'serverId');
        horizontalTile.appendChild(tileParent);

        cardContent.appendChild(mainTile);
        cardContent.appendChild(horizontalTile);

        card.appendChild(cardContent);
        var parentTile = document.createElement('div');
        parentTile.className = 'tile is-parent is-4';
        parentTile.appendChild(card);
        var tileAncestor = document.getElementById('tileAncestor');
        tileAncestor.appendChild(parentTile);
    },

    updateCardContent: function(cardId, server) {
        var card = document.getElementById(cardId);
        card.querySelector('#cpu-usage').textContent = server.cpu + '%';
        card.querySelector('#mem-con').textContent = server.memory + ' MB';
        card.querySelector('#route').textContent = server.routeToken;

        var data = this._statsData.get(server.serverId);

        var memObj = this.getScaleAndLine(data.mem);
        var cpuObj = this.getScaleAndLine(data.cpu);

        var memSvg = card.querySelector('#mem-graph svg');
        d3.select(memSvg).select('path.line')
        .datum(data.mem)
        .attr('d', memObj.line);

        var innerWidth = this._graphDimensions.x - this._graphMargins.left - this._graphMargins.right;

        var yAxisMemGenerator = d3.axisLeft(memObj.yScale);
        yAxisMemGenerator.ticks(3);
        yAxisMemGenerator.tickSize(-innerWidth);

        var yAxisMem = d3.select(memSvg).select('.y-axis')
        .transition()
        .duration(500)
        .call(yAxisMemGenerator);

        yAxisMem.select('.domain').attr('stroke-width', 0);
        yAxisMem.selectAll('.tick line').attr('stroke', '#EDEDED');

        var cpuSvg = card.querySelector('#cpu-graph svg');
        d3.select(cpuSvg).select('path.line')
        .datum(data.cpu)
        .attr('d', cpuObj.line);

        var yAxisCpuGenerator = d3.axisLeft(cpuObj.yScale);
        yAxisCpuGenerator.ticks(3);
        yAxisCpuGenerator.tickSize(-innerWidth);

        var yAxisCpu = d3.select(cpuSvg).select('.y-axis')
        .transition()
        .duration(500)
        .call(yAxisCpuGenerator);

        yAxisCpu.select('.domain').attr('stroke-width', 0);
        yAxisCpu.selectAll('.tick line').attr('stroke', '#EDEDED');
    },

    createGraph: function(graphName, data, currData) {
        var tileParent = document.createElement('div');
        tileParent.className = 'tile is-parent is-vertical';

        var graphChild = document.createElement('div');
        graphChild.className = 'tile is-child';

        if (graphName == 'cpu') {
            var cpuStat = document.createElement('p');
            cpuStat.className = 'pb-1 has-text-right';

            var spanforBullet = document.createElement('span');
            spanforBullet.style = 'color:blue';
            spanforBullet.textContent = '● ';

            var spanforText = document.createElement('span');
            spanforText.id = 'cpu-usage';
            spanforText.textContent = currData + '%';

            cpuStat.appendChild(spanforBullet);
            cpuStat.appendChild(spanforText);
            tileParent.appendChild(cpuStat);
        } else if (graphName == 'mem') {
            var memStat = document.createElement('p');
            memStat.className = 'pb-1 has-text-right';

            var spanforBullet = document.createElement('span');
            spanforBullet.style = 'color:green';
            spanforBullet.textContent = '● ';

            var spanforText = document.createElement('span');
            spanforText.id = 'mem-con';
            spanforText.textContent = currData + ' MB';

            memStat.appendChild(spanforBullet);
            memStat.appendChild(spanforText);
            tileParent.appendChild(memStat);
        }

        var figure = document.createElement('figure');
        figure.id = graphName + '-graph';

        var svg = d3.select(figure).append('svg')
            .attr('width', '100%')
            .attr('height', this._graphDimensions.y)
            .attr('viewBox', '0 0 ' + this._graphDimensions.x + ' ' + this._graphDimensions.y)
            .append('g')
            .attr('transform', 'translate(' + this._graphMargins.left + ',' + this._graphMargins.top + ')');

        var obj = this.getScaleAndLine(data);

        var yAxisGenerator = d3.axisLeft(obj.yScale);
        yAxisGenerator.ticks(3);

        var innerWidth = this._graphDimensions.x - this._graphMargins.left - this._graphMargins.right;
        yAxisGenerator.tickSize(-innerWidth);

        var yAxis = svg.append('g')
            .attr('class', 'y-axis axis')
            .call(yAxisGenerator);

        yAxis.select('.domain').attr('stroke-width', 0);
        yAxis.selectAll('.tick line').attr('stroke', '#EDEDED');

        // add empty axis
        var xAxis = svg.append('g')
            .attr('class', 'x-axis axis')
            .attr('transform', 'translate(0,' + (this._graphDimensions.y - this._graphMargins.bottom - this._graphMargins.top) + ')')
            .call(d3.axisBottom(obj.xScale).tickSize(0).tickValues([]));

        xAxis.select('.domain').attr('stroke', '#DBDBDB');

        var lineColor = 'blue';
        if (graphName == 'mem') {
            lineColor = 'green';
        }
        svg.append('path')
            .attr('class', 'line')
            .datum(data)
            .attr('d', obj.line)
            .attr('stroke', lineColor)
            .attr('stroke-width', 2)
            .attr('stroke-linejoin', 'round')
            .attr('fill', 'none');

        graphChild.appendChild(figure);
        tileParent.appendChild(graphChild);
        return tileParent;
    },

    getScaleAndLine: function(data) {
        var xAccessor = function (d) {
            return d.time;
        };
        var yAccessor = function (d) {
            return d.value;
        };

        var xDomain = d3.extent(data, xAccessor);
        var yDomain = [0, d3.max(data, yAccessor)];

        var width = this._graphDimensions.x - this._graphMargins.left - this._graphMargins.right;
        var height = this._graphDimensions.y - this._graphMargins.top - this._graphMargins.bottom;

        var xScale = d3.scaleTime()
            .domain(xDomain)
            .range([0, width]);

        var yScale = d3.scaleLinear()
            .domain(yDomain)
            .range([height, 0]);

        var line = d3.line()
            .x(function (d) {
                return xScale(xAccessor(d));
            }).y(function (d) {
                return yScale(yAccessor(d));
            }).curve(d3.curveBumpX);

        return {
            xScale: xScale,
            yScale: yScale,
            line: line,
        };
    },

    createRow: function(filename, mem, pid) {
        var row = document.createElement('tr');
        row.id = 'doc-' + pid;
        var documentCell = document.createElement('td');
        documentCell.textContent = filename;
        documentCell.className = 'has-text-left';

        var memoryCell = document.createElement('td');
        memoryCell.textContent = mem;
        memoryCell.className = 'has-text-centered docmem';
        row.appendChild(documentCell);
        row.appendChild(memoryCell);
        return row;
    },

    createDocumentTable: function(documents) {
        var table = document.createElement('table');
        table.className = 'table is-fullwidth is-striped is-bordered';

        var tableHeader = document.createElement('thead');
        var tableHeaderRow = document.createElement('tr');
        var documentNameHeader = document.createElement('th');

        documentNameHeader.textContent = _('Document');
        documentNameHeader.className = 'has-text-centered';

        var documentMemoryHeader = document.createElement('th');
        documentMemoryHeader.textContent = _('Memory');
        documentMemoryHeader.className = 'has-text-centered';

        tableHeaderRow.appendChild(documentNameHeader);
        tableHeaderRow.appendChild(documentMemoryHeader);
        tableHeader.appendChild(tableHeaderRow);
        table.appendChild(tableHeader);

        var tableBody = document.createElement('tbody');
        var that = this;
        documents.forEach(function (doc) {
            var row = that.createRow(doc.documentName, doc.memoryConsumed, doc.pid);
            tableBody.appendChild(row);
        });

        table.appendChild(tableBody);
        return table;
    },

    createParentTile: function(heading, value, id) {
        var tile = document.createElement('div');
        tile.className = 'tile has-text-centered is-fullwidth';

        var tileParent = document.createElement('div');
        tileParent.className = 'tile is-parent';

        var tileChild = document.createElement('div');
        tileChild.className = 'tile is-child has-text-centered';

        var elementHeading = document.createElement('p');
        elementHeading.className = 'heading';
        elementHeading.textContent = heading;

        var elementValue = document.createElement('p');
        elementValue.className = 'subtitle';
        elementValue.textContent = value;
        elementValue.id = id;

        tileChild.appendChild(elementHeading);
        tileChild.appendChild(elementValue);
        tileParent.appendChild(tileChild);
        return tileParent;
    },

    createAnchor: function(server) {
        var anchor = document.createElement('a');
        anchor.className = 'list-item';
        anchor.id = 'anchor' + server.serverId;
        anchor.href = server.ingressUrl + '/browser/dist/admin/admin.html?RouteToken=' + server.routeToken;
        anchor.setAttribute('target', '_blank');
        if (server.podname) {
            anchor.textContent = server.podname;
        } else {
            console.warn('podname doesnot exist, using serverId instead of podname on anchor tag');
            anchor.textContent = server.serverId;
        }
        return anchor;
    },


    updateAnchor: function(server) {
        var anchor = document.getElementById('anchor' + server.serverId);
        anchor.id = 'anchor' + server.serverId;
        anchor.href = server.ingressUrl + '/browser/dist/admin/admin.html?RouteToken=' + server.routeToken;
    },

    onSocketMessage: function (e) {
        var textMsg;
        if (typeof e.data === 'string') {
            textMsg = e.data;
        }
        else {
            textMsg = '';
        }

        if (textMsg.startsWith('stats')) {
            var stats = JSON.parse(textMsg.substring(textMsg.indexOf('[')));
            var srvList = document.querySelector('#column-admin-panel .list');
            var that = this;
            stats.forEach(function (srvStat) {
                var anchor = document.getElementById('anchor' + srvStat.serverId);
                if (anchor) {
                    that.updateAnchor(srvStat);
                } else {
                    anchor = that.createAnchor(srvStat);
                    srvList.appendChild(anchor);
                }
                var cardId = 'card-' + srvStat.serverId;
                var card = document.getElementById(cardId);
                if (card) {
                    that.updateStat(srvStat.serverId, srvStat.memory, srvStat.cpu);
                    that.updateCardContent(cardId, srvStat);
                } else {
                    that.addStat(srvStat.serverId);
                    that.createCard(srvStat);
                }
            });
        } else if (textMsg.startsWith('documents')) {
            var srvs = JSON.parse(textMsg.substring(textMsg.indexOf('[')));
            var that = this;
            srvs.forEach(function (srv) {
                var cardId = 'card-' + srv.serverId;
                var card = document.getElementById(cardId);
                if (card && srv.documents.length) {
                    var table = that.createDocumentTable(srv.documents);
                    card.querySelector('.card-content').appendChild(table);
                }
            });
        } else if (textMsg.startsWith('adddoc')) {
            textMsg = textMsg.substring('adddoc'.length);
            var tokens = textMsg.trim().split(' ');
            if (tokens.length < 4) {
                return;
            }
            var serverId = tokens[0];
            var pid = tokens[1];
            var filename = tokens[2];
            var mem = tokens[3];
            var cardId = 'card-' + serverId;
            var card = document.getElementById(cardId);
            if (card) {
                var table = card.querySelector('table');
                if (!table) {
                    table = this.createDocumentTable([{documentName: decodeURI(filename), memoryConsumed: mem, pid: pid }]);
                    card.querySelector('.card-content').appendChild(table);
                } else {
                    var row = this.createRow(decodeURI(filename), mem, pid);
                    card.querySelector('tbody').appendChild(row);
                }
            }
        } else if (textMsg.startsWith('rmdoc')) {
            textMsg = textMsg.substring('rmdoc'.length);
            var tokens = textMsg.trim().split(' ');
            if (tokens.length < 3) {
                return;
            }
            var serverId = tokens[0];
            var pid = tokens[1];
            var filename = tokens[2];
            var cardId = 'card-' + serverId;
            var card = document.getElementById(cardId);
            if (card) {
                card.querySelector('#doc-' + pid).remove();
                var rows = card.querySelectorAll('tbody tr');
                if (rows.length == 0) {
                    card.querySelector('table').remove();
                }
            }
        } else if (textMsg.startsWith('propchange')) {
            textMsg = textMsg.substring('propchange'.length);
            var tokens = textMsg.trim().split(' ');
            if (tokens.length < 3) {
                return;
            }
            var serverId = tokens[0];
            var pid = tokens[1];
            var newMem = tokens[2];
            var cardId = 'card-' + serverId;
            var card = document.getElementById(cardId);
            if (card) {
                var row = card.querySelector('#doc-' + pid);
                if (row) {
                    row.querySelector('.docmem').textContent = newMem;
                }
            }
        } else if (textMsg.startsWith('rmsrv')) {
            textMsg = textMsg.substring('rmsrv'.length);
            var tokens = textMsg.trim().split(' ');
            if (tokens.length < 1) {
                return;
            }
            var serverId = tokens[0];
            var cardId = 'card-' + serverId;
            var card = document.getElementById(cardId);
            if (card) {
                card.remove();
            }
            var anchor = document.getElementById('anchor' + serverId);
            if (anchor) {
                anchor.remove();
            }
        } else if (textMsg.startsWith('scaling')) {
            var msg = textMsg.split(' ')[1];
            if (msg == 'true') {
                var dialog = (new DlgLoading())
                    .text(_('Please wait kubernetes cluster is scaling...'));
                dialog.open();
            } else {
                this.socket.send('stats');
                DlgLoading.close();
            }
        }
    },

    onSocketOpen: function () {
        this.base.call(this);

        this.socket.send('stats');
        this.socket.send('documents');
        var that = this;
        setInterval(function () {
            that.socket.send('stats');
        }, 5000);
    }
});

Admin.ClusterOverview = function (host) {
    return new AdminClusterOverview(host);
};