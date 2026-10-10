// Help dialog: animated step-by-step guide + FAQ.
// Standalone: does not touch any app logic.
(function () {
    'use strict';

    var helpBtn = document.getElementById('helpBtn');
    var helpTip = document.getElementById('helpTip');
    var overlay = document.getElementById('helpOverlay');
    var closeBtn = document.getElementById('helpClose');
    var prevBtn = document.getElementById('helpPrev');
    var nextBtn = document.getElementById('helpNext');
    var dotsWrap = document.getElementById('helpDots');
    var progress = document.getElementById('helpProgress');
    if (!helpBtn || !overlay) return;

    var steps = Array.prototype.slice.call(overlay.querySelectorAll('.help-step'));
    var tabs = Array.prototype.slice.call(overlay.querySelectorAll('.help-tab'));
    var panes = Array.prototype.slice.call(overlay.querySelectorAll('.help-pane'));
    var current = 0;
    var lastFocus = null;
    var SEEN_KEY = 'steaminjector.helpSeen';

    function store(get, val) {
        try {
            if (get) return window.localStorage.getItem(SEEN_KEY);
            window.localStorage.setItem(SEEN_KEY, val);
        } catch (e) { /* storage unavailable: ignore */ }
        return null;
    }

    // Build dots
    steps.forEach(function (_, i) {
        var d = document.createElement('button');
        d.type = 'button';
        d.className = 'help-dot';
        d.setAttribute('aria-label', 'Go to step ' + (i + 1));
        d.addEventListener('click', function () { go(i); });
        dotsWrap.appendChild(d);
    });
    var dots = Array.prototype.slice.call(dotsWrap.children);

    function go(i) {
        i = Math.max(0, Math.min(steps.length - 1, i));
        var dir = i >= current ? 'fwd' : 'back';
        steps.forEach(function (s, idx) {
            s.classList.remove('active', 'fwd', 'back');
            if (idx === i) {
                // force reflow so scene animations restart
                void s.offsetWidth;
                s.classList.add('active', dir);
            }
        });
        dots.forEach(function (d, idx) {
            d.classList.toggle('active', idx === i);
            d.classList.toggle('done', idx < i);
        });
        current = i;
        progress.style.width = ((i + 1) / steps.length * 100) + '%';
        prevBtn.style.visibility = i === 0 ? 'hidden' : 'visible';
        nextBtn.textContent = i === steps.length - 1 ? 'Finish' : (i === 0 ? 'Start tour' : 'Next');
    }

    function showTab(name) {
        tabs.forEach(function (t) {
            var on = t.getAttribute('data-tab') === name;
            t.classList.toggle('active', on);
            t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        panes.forEach(function (p) {
            p.classList.toggle('active', p.getAttribute('data-pane') === name);
        });
        if (name === 'guide') go(current);
    }

    function hideTip() {
        helpTip.classList.remove('show');
        helpBtn.classList.remove('attention');
    }

    function open(tab) {
        lastFocus = document.activeElement;
        hideTip();
        store(false, '1');
        showTab(tab || 'guide');
        if (!tab || tab === 'guide') go(0);
        overlay.classList.add('open');
        document.body.classList.add('help-open');
        overlay.setAttribute('aria-hidden', 'false');
        setTimeout(function () { nextBtn.focus(); }, 60);
    }

    function close() {
        overlay.classList.remove('open');
        document.body.classList.remove('help-open');
        overlay.setAttribute('aria-hidden', 'true');
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    function isOpen() { return overlay.classList.contains('open'); }

    helpBtn.addEventListener('click', function () { open('guide'); });
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    prevBtn.addEventListener('click', function () { go(current - 1); });
    nextBtn.addEventListener('click', function () {
        if (current === steps.length - 1) close(); else go(current + 1);
    });
    tabs.forEach(function (t) {
        t.addEventListener('click', function () { showTab(t.getAttribute('data-tab')); });
    });
    helpTip.addEventListener('click', function () { open('guide'); });

    document.addEventListener('keydown', function (e) {
        var tag = (e.target && e.target.tagName) || '';
        var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
        if (!isOpen()) {
            if (e.key === '?' && !typing) { e.preventDefault(); open('guide'); }
            return;
        }
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1); }
        else if (e.key === 'Tab') {
            // keep focus inside the dialog
            var f = overlay.querySelectorAll('button, summary, [href], input, select');
            var vis = Array.prototype.filter.call(f, function (el) { return el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden'; });
            if (!vis.length) return;
            var first = vis[0], last = vis[vis.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
    });

    // First-run nudge: show a small bubble next to the Help button once.
    if (!store(true)) {
        setTimeout(function () { if (!isOpen()) helpTip.classList.add('show'); }, 1200);
        setTimeout(function () { helpTip.classList.remove('show'); }, 11000);
    } else {
        helpBtn.classList.remove('attention');
    }

    go(0);
})();
