(function () {
  const { h, create:createElement, diff, patch } = virtualDom;

  document.querySelector('.disable').addEventListener('click', function (e) {
    self.port.emit('action', { type: 'disable' });
  });

  function render(state) {
    return h('ul', state.selectors.map(function (selector) {
      return h('li', [
        h('label', [
          h('input', {
            type: 'checkbox',
            value: selector,
            checked: !state.hidden[selector]
          }),
          (' ' + selector)
        ])
      ]);
    }));
  }

  let selectorsEl = document.querySelector('.selectors');
  let tree;
  let rootNode;
  self.port.on('state', function (state) {
    let newTree = render(state);
    if (tree) {
      let patches = diff(tree, newTree);
      patch(rootNode, patches);
    } else {
      rootNode = createElement(newTree);
      selectorsEl.appendChild(rootNode);
    }
    tree = newTree;
  });

  selectorsEl.addEventListener('change', function (e) {
    if (e.target.value) {
      if (e.target.checked) {
        self.port.emit('action', {
          type: 'show',
          selector: e.target.value
        });
      } else {
        self.port.emit('action', {
          type: 'hide',
          selector: e.target.value
        });
      }
    }
  });

})();
