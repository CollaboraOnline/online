/* -*- js-indent-level: 8 -*- */
/* global AdminSocketBase Admin $ */

var AdminClusterOverviewAbout = AdminSocketBase.extend({
    constructor: function(host, routeToken) {
        this.base(host);
        this.routeToken = routeToken;
    },

    onSocketMessage: function(e) {
        let textMsg;
        if (typeof e.data === 'string') {
            textMsg = e.data;
        }
        else {
            textMsg = '';
        }
        if (textMsg.startsWith('license')) {
            const licenseContentEl = document.getElementById('license-content');
            if (licenseContentEl) {
                licenseContentEl.innerHTML = textMsg.substring('license: '.length);
            } else {
                console.warn('Element #license-content not found');
            }
         }
    },

    onSocketOpen: function() {
        this.socket.send('auth jwt=' + window.jwtToken + ' routeToken=' + this.routeToken);
        this.socket.send('license');
    },

    onSocketClose: function() {
        this.base.call(this);
    }
});

Admin.ClusterOverviewAbout = function(host, routeToken) {
    return new AdminClusterOverviewAbout(host, routeToken);
};
