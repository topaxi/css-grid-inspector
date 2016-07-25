(function () {

  function collectSelectors() {
    var selectors = [];

    function processRules(rules) {
      Array.from(rules).forEach(function (rule) {
        if (rule.cssRules) {
          processRules(rule.cssRules);
        } else {
          var found = false;
          Array.from(rule.style).forEach(function (dec) {
            if (dec === 'display' &&
                (rule.style[dec] === 'grid' ||
                 rule.style[dec] === 'inline-grid')) {
              found = true;
            }
          });
          if (found) {
            selectors.push(rule.selectorText);
          }
        }
      });
    }

    Array.from(document.styleSheets).forEach(function (sheet) {
      try {
        processRules(sheet.cssRules);
      } catch (e) {
        console.warn("failed to process sheet with error", e);
      }
    });
    self.port.emit('action', {
      type: 'selectors',
      selectors: selectors
    });
    return selectors;
  }

  var selectors = collectSelectors();

  var dpr = window.devicePixelRatio;

  var overlayEl, ctx;
  function createOverlayElement() {
    var el = document.createElement('canvas');
    var style = {
      pointerEvents: 'none',
      position: 'absolute',
      left: 0,
      top: 0,
      width: "100%",
      height: "100%"
    }
    for (var p in style) {
      el.style[p] = style[p];
    }
    return el;
  }

  var elsBySelector = {};

  function detectElements() {
    selectors.forEach(sel => {
      elsBySelector[sel] = Array.from(document.querySelectorAll(sel));
    });
  }

  function measureAndDraw() {
    overlayEl.width = overlayEl.offsetWidth * dpr;
    overlayEl.height = overlayEl.offsetHeight * dpr;

    var viewTop = document.documentElement.scrollTop;
    var viewLeft = document.documentElement.scrollLeft;

    overlayEl.style.top = viewTop + 'px';
    overlayEl.style.left = viewLeft + 'px';

    ctx.clearRect(0, 0, overlayEl.width * dpr, overlayEl.height * dpr);
    ctx.lineWidth = dpr;

    function vert(x) {
      ctx.lineDashOffset = (viewTop * dpr) % 17;
      line(x, 0, x, overlayEl.height);
    }

    function horiz(y) {
      ctx.lineDashOffset = (viewLeft * dpr) % 17;
      line(0, y, overlayEl.width, y);
    }

    function line(x0, y0, x1, y1) {
      ctx.beginPath();
      ctx.moveTo(x0 * dpr, y0 * dpr);
      ctx.lineTo(x1 * dpr, y1 * dpr);
      ctx.stroke();
    }

    function rect(x, y, width, height) {
      ctx.fillRect(x * dpr, y * dpr, width * dpr, height * dpr);
    }

    function text(s, x, y) {
      x *= dpr;
      y *= dpr;
      ctx.save();
      ctx.textBaseline = 'bottom';
      var em = 12 * dpr;
      ctx.font = em + 'px sans-serif';
      var width = 2 * em + ctx.measureText(s).width;
      var height = em * 2;
      ctx.fillRect(x, y - height, width, height);
      ctx.strokeRect(x, y - height, width, height);
      ctx.fillStyle = '#000';
      ctx.fillText(s, x + em, y - em / 2);
      ctx.restore();
    }

    var num = 0;
    selectors.forEach(function (selector) {
      if (state.hidden[selector]) {
        return;
      }
      var els = elsBySelector[selector];
      els.forEach(function (el) {
        ctx.setLineDash([12, 5]);

        // ctx.strokeStyle = 'hsla(' + ((num * 219) % 360) + ', 100%, 55%, .8)';
        ctx.strokeStyle = state.color[selector];

        var innerQuad = el.getBoxQuads({
          box:"content"
        })[0];

        var top = innerQuad.p1.y;
        var left = innerQuad.p1.x;

        var elStyle;

        function getStyle(prop) {
          return elStyle.getPropertyValue(prop);
        }

        function parseMulti(s) {
          return s.split(/\s+/).filter(p => !isNaN(parseFloat(p, 10)));
        }

        elStyle = window.getComputedStyle(el);

        var cols = parseMulti(getStyle('grid-template-columns'));
        var colGaps = parseMulti(getStyle('grid-column-gap'));
        var rows = parseMulti(getStyle('grid-template-rows'));
        var rowGaps = parseMulti(getStyle('grid-row-gap'));

        var pos = 0;
        vert(pos + left);
        for (var i = 0; i <= cols.length; i++) {
          var gap = parseFloat(colGaps[i % colGaps.length], 10);
          pos += parseFloat(cols[i], 10);
          vert(pos + left);
          if (i <= cols.length - 2) {
            vert(pos + left + gap);
          }
          pos += gap;
        }

        var pos = 0;
        horiz(pos + top);
        for (var i = 0; i <= rows.length; i++) {
          var gap = parseFloat(rowGaps[i % rowGaps.length], 10);
          pos += parseFloat(rows[i], 10);
          horiz(pos + top);
          if (i <= rows.length - 2) {
            horiz(pos + top + gap);
          }
          pos += gap;
        }

        ctx.setLineDash([0]);
        // ctx.strokeStyle = 'hsla(' + ((num * 219 + 200) % 360) + ', 100%, 55%, .9)';
        ctx.strokeStyle = state.color[selector];
        // ctx.fillStyle = 'hsla(' + ((num * 219 + 200) % 360) + ', 100%, 70%, 1)';
        ctx.fillStyle = state.color[selector];
        var outerQuad = el.getBoxQuads({
          box: "border"
        })[0];

        text(selector, outerQuad.p1.x, outerQuad.p1.y)

        horiz(outerQuad.p1.y);
        vert(outerQuad.p1.x);
        horiz(outerQuad.p3.y);
        vert(outerQuad.p3.x);

        num++;
      });
    });

  }

  detectElements();

  var redrawScheduled = false;
  function redraw() {
    if (!redrawScheduled) {
      redrawScheduled = true;
      setTimeout(function () {
        measureAndDraw();
        redrawScheduled = false;
      }, 50);
    }
  }

  var enabled = false;
  var state;
  self.port.on('state', function (newState) {
    state = newState;

    if (state.enabled) {
      enable();
    } else {
      disable();
    }
  });

  function enable() {
    if (!overlayEl) {
      overlayEl = createOverlayElement();
    }
    document.body.appendChild(overlayEl);
    ctx = overlayEl.getContext('2d');

    if (!enabled) {
      collectSelectors();
      detectElements();
    }
    measureAndDraw();
    enabled = true;
  }

  function disable() {
    if (overlayEl && overlayEl.parentNode) {
      document.body.removeChild(overlayEl);
    }
    enabled = false;
  }

  self.port.on('detach', function () {
    disable();
  });

  self.port.on('redraw', redraw);

  window.addEventListener('resize', redraw);
  window.addEventListener('scroll', redraw);
})();
