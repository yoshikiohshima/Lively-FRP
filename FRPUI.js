module('users.ohshima.frp.FRPUI').requires().toRun(function() {

lively.morphic.WindowedApp.subclass('users.ohshima.frp.FRPInspector',
'settings', {
    documentation: 'An inspector for an FRP object.',
    emptyText: '',
    connections: ['targetObject', 'listPaneSelection', 'sourceString'],
},
'initialization', {
    initialViewExtent: pt(640, 400),
    panelSpec: [
        ['LocationPane', newTextPane, [0, 0, 0.8, 0.08]],
        ['ListPane', newDragnDropListPane, [0, 0.03, 0.33, 0.92]],
        ['SourcePane', newTextPane, [0.33, 0.03, 0.67, 0.46]],
        ['ValuePane', newTextPane, [0.33, 0.5, 0.67, 0.46]],
    ],

    allPaneNames: ['LocationPane', 'ListPane', 'SourcePane', 'ValuePane'],

    initialize: function($super) {
        $super();
    },
    on: function(object) {
        this.object = object;
        var browser = this;
        this.onListPaneContentUpdate = function(value, source) {
            browser.panel["ListPane"].setList(value)
        }
        this.setListPaneContent(Object.keys(object).asListItemArray())
    },

    setupListPanes: function() {
        var inspector = this;
        function setupListPane(paneName) {
            var pane = browser.panel[paneName];
            var list = pane.innerMorph();
            pane.applyStyle({scaleProportional: true});
            lively.bindings.connect(list, 'selection', browser, 'set' + paneName + 'Selection', {
                updater: function($upd, v) {
                    var browser = this.targetObj, list = this.sourceObj;
                }});
            list.plugTo(browser, {
                getelection: '->get' + paneName + 'Selection',
                getList: '->get' + paneName + 'Content',
                getMenu: '->get' + paneName + 'Menu',
                updateList: '<-set' + paneName + "Content'"
            });
            pane.plugTo(browser, {
                getMenu: '->get' + paneName + 'Menu'
            });
            // overwriting event handlers so that list items can be selected using keys
            // and focus is still on the list and not the source pane
            list.addScript(function onDownPressed(evt) {
                $super(evt);
                this.focus.bind(this).delay(0);
                return true;
            });
            list.addScript(function onUpPressed(evt) {
                $super(evt);
                this.focus.bind(this).delay(0);
                return true;
            });
            this.allPaneNames.forEach(function(ea) {setupListPane(ea)});
        }
    },
    buildView: function(extent) {
        extent = extent || this.initialViewExtent;
        var panel = new lively.morphic.Panel(extent);
        lively.morphic.Panel.makePanedPanel(extent, this.panelSpec, panel);
        panel.applyStyle({fill: Color.lightGray});
        this.panel = panel;

        this.setupListPanes();
        this.setupResizers(panel);

        panel.ownerWidget = this;
        this.start();
        return panel;
    },

    setupResizers: function() {
        var panel = this.panel;
        if (!panel.midResizer)
            return;
        this.allPaneNames.forEach(function(name) {
            panel.midResizer.addScalingAbove(panel[name]);
        });
        panel.midResizer.addScalingBelow(panel.sourcePane);

        panel.midResizer.linkToStyles(["Browser_resizer"]);
    },

    start: function() {
        this.set
        //this.setListPaneContent(this.childsFilteredAndAsListItems(this.rootNode(), this.getRootFilters()));
    },
},
'formal getters and setters', {
    getListPaneContent: function() {return this.ListPaneContent},
    setListPaneContent: function(value, source) {
        this.ListPaneContent = value;
        if (this.onListPaneContentUpdate) this.onListPaneContentUpdate(value, source);
        return value;
    },
    getSourcePaneContent: function() {return this.SourcePaneContent},
    setSourcePaneContent: function(value, source) {
        this.SourcePaneContent = value;
        if (this.onSourcePaneContentUpdate) this.onSourceContentUpdate(value, source);
        return value;
    },
    getValuePaneContent: function() {return this.ValuePaneContent},
    setValuePaneContent: function(value, source) {
        this.ValuePaneContent = value;
        if (this.onValuePaneContentUpdate) this.onValueContentUpdate(value, source);
        return value;
    },
    getListPaneSelection: function() {return this.ListPaneSelection},
    setListPaneSelection: function(value, source) {
        this.ListPaneSelection = value;
        if (this.onListPaneSelectionUpdate) this.onListPaneSelectionUpdate(value, source);
        return value;
    },
    getListPaneMenu: function() {return this.ListPaneMenu},
    setListPaneMenu: function(value, source) {
        this.ListPaneMenu = value;
        if (this.onListPaneMenuUpdate) this.onListPaneMenuUpdate(value, source);
        return value;
    },
    getListPaneFilters: function() {return this.ListPaneFilters},
    setListPaneFilters: function(value, source) {
        this.ListPaneFilters = value;
        if (this.onListPaneFiltersUpdate) this.onListPaneFiltersUpdate(value, source);
        return value;
    }
});

// Enter your code here

}) // end of module