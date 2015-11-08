/*
* Control.ColumnHeader
*/

L.Control.ColumnHeader = L.Control.extend({
        onAdd: function (map) {
                var docContainer = L.DomUtil.get('document-container');
                var divHeader = L.DomUtil.create('div', 'spreadsheet-container-column', docContainer.parentElement);
                var tableContainer =  L.DomUtil.create('table', 'spreadsheet-container-table', divHeader);
                var tbodyContainer = L.DomUtil.create('tbody', '', tableContainer);
                var trContainer = L.DomUtil.create('tr', '', tbodyContainer);
                L.DomUtil.create('th', 'spreadsheet-container-th-corner', trContainer);
                var thColumns = L.DomUtil.create('th', 'spreadsheet-container-th-column', trContainer);
                var divInner = L.DomUtil.create('div', 'spreadsheet-container-column-inner', thColumns);
                this._table = L.DomUtil.create('table', '', divInner);
                this._table.id = 'spreadsheet-table-column';
                L.DomUtil.create('tbody', '', this._table);
                this._columns = L.DomUtil.create('tr','', this._table.firstChild);

                // dummy initial header
                L.DomUtil.create('th','spreadsheet-table-column-cell', this._columns);

                return document.createElement('div');
        },

        clearColumns : function () {
                L.DomUtil.remove(this._columns);
                this._columns = L.DomUtil.create('tr', '', this._table.firstChild);
        },

        offsetColumn: function (point) {
                L.DomUtil.setStyle(this._table, 'left', point + 'px');
        },

        fillColumns: function (columns, converter, context) {
                var twip, width, column;

                this.clearColumns();
                for (iterator = 0; iterator < columns.length; iterator++) {
                        twip = new L.Point(parseInt(columns[iterator].size),
                                           parseInt(columns[iterator].size));
                        width =  Math.round(converter.call(context, twip).x) - 1;
                        column = L.DomUtil.create('th', 'spreadsheet-table-column-cell', this._columns);
                        column.innerHTML = columns[iterator].text;
                        column.twipWidth = columns[iterator].size;
                        column.width = width + "px";
                }
        },

        updateColumns: function (converter, context) {
                var iterator, twip, width, column;
                for (iterator = 0; iterator < this._columns.childNodes.length; iterator++) {
                        column = this._columns.childNodes[iterator];
                        twip = new L.Point(parseInt(column.twipWidth),
                                           parseInt(column.twipWidth));
                        width =  Math.round(converter.call(context, twip).x) - 1;
                        column.width = width + "px";
                }
        }
})

L.control.columnHeader = function (options) {
        return new L.Control.ColumnHeader(options);
};
