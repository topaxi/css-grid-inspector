var self = require("sdk/self");
var { ToggleButton } = require("sdk/ui/button/toggle");
var tabs = require('sdk/tabs');
var panels = require('sdk/panel');
var { Hotkey } = require("sdk/hotkeys");

var state = {
  tabs: []
};

var workers = {};

var button = ToggleButton({
  id: "show-grids",
  label: "Show Grids",
  icon: "./icon-32.png",
  badgeColor: '#0e71a4',
  badge: null,
  onChange: handleButton
});

var panel = panels.Panel({
  contentURL: self.data.url("panel.html"),
  contentScriptFile: [
    self.data.url('virtual-dom.js'),
    self.data.url('panel.js')
  ],
  width: 180,
});
panel.port.on('action', function (action) {
  dispatch(action);
});

var toggleHotKey = Hotkey({
  combo: "accel-alt-g",
  onPress: function() {
    dispatch({
      type: 'toggle'
    });
  }
});

function dispatch (event) {
  switch (event.type) {
    case 'enable':
      getTabState(event.tabId || tabs.activeTab.id).enabled = true;
      panel.show({
        position: button
      });
      break;
    case 'disable':
      getTabState(event.tabId || tabs.activeTab.id).enabled = false;
      break;
    case 'selectors':
      getTabState(event.tabId).selectors = event.selectors;
      break;
    case 'hide':
      getTabState(event.tabId || tabs.activeTab.id).hidden[event.selector] = true;
      break;
    case 'show':
      getTabState(event.tabId || tabs.activeTab.id).hidden[event.selector] = false;
      break;
    case 'toggle':
      if (getTabState(tabs.activeTab.id).enabled) {
        dispatch({
          type: 'disable',
          tabId: tabs.activeTab.id
        });
      } else {
        dispatch({
          type: 'enable',
          tabId: tabs.activeTab.id
        });
      }
      break;
    case 'activeTab':
      break;
  }
  update();
}

function getTabState(tabId) {
  if (!state.tabs[tabId]) {
    state.tabs[tabId] = {
      id: tabId,
      enabled: false,
      selectors: [],
      hidden: {}
    };
  }
  return state.tabs[tabId];
}

function update() {
  var tabId = tabs.activeTab.id;
  var tabState = getTabState(tabId);

  if (!workers[tabId]) {
    workers[tabId] = attach(tabs.activeTab);
  }
  try {
    workers[tabId].port.emit('state', tabState);
  } catch (e) {
  }

  // update button
  button.state('tab', {
    checked: tabState.enabled,
    badge: tabState.selectors.length || null
  });

  // update panel
  panel.port.emit('state', tabState);
}

// Tab events

tabs.on('activate', function () {
  dispatch({
    type: 'activeTab'
  });
});

function reset(tab) {
  if (workers[tab.id]) {
    detach(tab);
  }
}

tabs.on('close', reset);
tabs.on('ready', function (tab) {
  workers[tab.id] = attach(tab);
  workers[tab.id].port.emit('state', getTabState(tab.id));
});

function detach(tab) {
  if (!tab) {
    return;
  }
  if (workers[tab.id]) {
    workers[tab.id].destroy();
  }
  workers[tab.id] = null;
}

function attach(tab) {
  var tabId = tab.id;
  if (workers[tabId]) {
    workers[tabId].destroy();
  }
  var worker = tab.attach({
    contentScriptFile: "./page-script.js"
  });
  worker.port.on('action', function (action) {
    action.tabId = tabId;
    dispatch(action);
  });
  worker.on('detach', function() {
    dispatch({
      type: 'disable',
      tabId: tabId
    });
  });
  return worker;
}

// Button Events

function handleButton() {
  dispatch({
    type: 'toggle'
  });
}

function toggleGrid() {
  var id = activeTab.id;
  toggleState[id] = !toggleState[id];
  button.state('tab', {checked: toggleState[id]});
  if (toggleState[id]) {
    if (id in workers) {
      try {
        workers[id].port.emit('grid', 'show');
      } catch (e) {
        attach(activeTab);
      }
    } else {
      attach(activeTab);
    }
  } else {
    if (workers[id]) {
      workers[id].port.emit('grid', 'hide');
    }
    panel.hide();
  }

}
