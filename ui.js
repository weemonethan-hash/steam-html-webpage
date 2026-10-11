// Interface switcher: "new" (default), "legacy" or "aurora".
// Loaded in <head> so the right look is applied before first paint.
// It toggles a class on <html>, enables/disables the matching stylesheet and,
// for Aurora only, adds small visual effects (click ripple, cursor light,
// App ID pop, entrance after the splash). It never touches app logic.
(function () {
    'use strict';

    var KEY = 'steaminjector.ui';
    var MODES = ['new', 'legacy', 'aurora'];
    var root = document.documentElement;

    function clean(v) { return MODES.indexOf(v) === -1 ? 'new' : v; }
    function read() {
        try { return clean(window.localStorage.getItem(KEY)); }
        catch (e) { return 'new'; }
    }
    function write(mode) {
        try { window.localStorage.setItem(KEY, mode); } catch (e) { /* storage unavailable */ }
    }

    var mode = read();
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function setClasses(next) {
        mode = clean(next);
        root.classList.toggle('ui-new', mode === 'new');
        root.classList.toggle('ui-aurora', mode === 'aurora');
        root.setAttribute('data-ui', mode);
    }

    function apply(next) {
        setClasses(next);
        var sheets = { new: 'uiNewCss', aurora: 'uiAuroraCss' };
        Object.keys(sheets).forEach(function (m) {
            var sheet = document.getElementById(sheets[m]);
            if (sheet) sheet.disabled = mode !== m;
        });
        var radios = document.querySelectorAll('input[name="uiMode"]');
        for (var i = 0; i < radios.length; i++) radios[i].checked = radios[i].value === mode;
    }

    // Apply immediately (before the body exists) to avoid a flash of the wrong UI.
    setClasses(mode);

    // ───────── Aurora entrance: wait for the splash to leave, then reveal ─────────
    // Fallbacks guarantee the UI is never left hidden (splash failsafe is 7s).
    var revealed = false;
    function reveal() {
        if (revealed) return;
        revealed = true;
        root.classList.add('aur-ready');
    }
    function watchSplash() {
        var splash = document.getElementById('splash');
        if (!splash || splash.classList.contains('done') || document.body.classList.contains('ready')) {
            reveal();
            return;
        }
        var check = function () {
            if (splash.classList.contains('done') || document.body.classList.contains('ready') || !document.body.contains(splash)) {
                reveal();
                return true;
            }
            return false;
        };
        if (window.MutationObserver) {
            var mo = new MutationObserver(function () { if (check()) mo.disconnect(); });
            mo.observe(splash, { attributes: true, attributeFilter: ['class'] });
            mo.observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true });
        }
        // the splash's CSS failsafe leaves without touching classes
        splash.addEventListener('animationend', function (e) { if (e.target === splash) reveal(); });
        splash.addEventListener('transitionend', function (e) { if (e.target === splash && e.propertyName === 'opacity') reveal(); });
        setTimeout(reveal, 7300);
    }

    // ───────── Aurora effects (delegated, no-ops in the other interfaces) ─────────
    function initEffects() {
        // Click ripple on buttons
        document.addEventListener('click', function (e) {
            if (mode !== 'aurora' || reduceMotion) return;
            var btn = e.target.closest && e.target.closest('.btn');
            if (!btn || btn.disabled) return;
            var rect = btn.getBoundingClientRect();
            var dot = document.createElement('span');
            dot.className = 'ripple';
            dot.style.left = (e.clientX - rect.left) + 'px';
            dot.style.top = (e.clientY - rect.top) + 'px';
            btn.appendChild(dot);
            dot.addEventListener('animationend', function () { dot.remove(); });
        });

        // Soft light that follows the cursor across the cards
        var frame = 0, px = 0, py = 0, card = null;
        document.addEventListener('pointermove', function (e) {
            if (mode !== 'aurora' || reduceMotion) return;
            card = e.target.closest && e.target.closest('.card');
            if (!card) return;
            px = e.clientX; py = e.clientY;
            if (frame) return;
            frame = requestAnimationFrame(function () {
                frame = 0;
                if (!card) return;
                var r = card.getBoundingClientRect();
                card.style.setProperty('--mx', (px - r.left) + 'px');
                card.style.setProperty('--my', (py - r.top) + 'px');
            });
        }, { passive: true });

        // The App ID "pops" whenever it changes
        var id = document.getElementById('appIdDisplay');
        if (id && window.MutationObserver) {
            new MutationObserver(function () {
                if (mode !== 'aurora' || reduceMotion) return;
                id.classList.remove('pop');
                void id.offsetWidth; // restart the animation
                id.classList.add('pop');
            }).observe(id, { childList: true, characterData: true, subtree: true });
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        apply(mode);
        initEffects();
        watchSplash();

        var btn = document.getElementById('settingsBtn');
        var overlay = document.getElementById('settingsOverlay');
        var closeBtn = document.getElementById('settingsClose');
        if (!btn || !overlay) return;
        var lastFocus = null;

        function open() {
            lastFocus = document.activeElement;
            overlay.classList.add('open');
            overlay.setAttribute('aria-hidden', 'false');
            document.body.classList.add('help-open'); // hides the webview so it can't sit above the dialog
            var checked = overlay.querySelector('input[name="uiMode"]:checked');
            if (checked) checked.focus();
        }
        function close() {
            overlay.classList.remove('open');
            overlay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('help-open');
            if (lastFocus && lastFocus.focus) lastFocus.focus();
        }

        btn.addEventListener('click', open);
        closeBtn.addEventListener('click', close);
        overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && overlay.classList.contains('open')) { e.preventDefault(); close(); }
        });

        var radios = overlay.querySelectorAll('input[name="uiMode"]');
        for (var i = 0; i < radios.length; i++) {
            radios[i].addEventListener('change', function (e) {
                if (!e.target.checked) return;
                write(e.target.value);
                apply(e.target.value);
                reveal(); // switching live: nothing should stay hidden
            });
        }
    });
})();
