// Interface + theme switcher and the visual-effects layer.
//
//   Interfaces:  new (default) · legacy · aurora · neon · ember · daylight
//   The last four share one layout ("Aurora family") and differ by theme.
//
// Loaded in <head> so the right look is applied before first paint. It only
// toggles classes/attributes, enables/disables stylesheets and adds visual
// effects (ripple, cursor light, ambient particles, success burst, theme
// reveal). It never touches app logic.
(function () {
    'use strict';

    var KEY = 'steaminjector.ui';
    var MOTION_KEY = 'steaminjector.motion';
    var MODES = ['new', 'legacy', 'aurora', 'neon', 'ember', 'daylight'];
    var FAMILY = ['aurora', 'neon', 'ember', 'daylight'];
    var root = document.documentElement;

    function get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
    function set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
    function clean(v) { return MODES.indexOf(v) === -1 ? 'new' : v; }
    function isFamily(m) { return FAMILY.indexOf(m) !== -1; }

    var mode = clean(get(KEY));
    var osReduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var storedMotion = get(MOTION_KEY);
    var motion = storedMotion === 'full' || storedMotion === 'reduced' ? storedMotion : (osReduced ? 'reduced' : 'full');

    function motionOn() { return motion !== 'reduced'; }

    function setClasses(next) {
        mode = clean(next);
        root.classList.toggle('ui-new', mode === 'new');
        root.classList.toggle('ui-aurora', isFamily(mode));
        root.setAttribute('data-ui', mode);
    }
    function setMotion(next) {
        motion = next === 'reduced' ? 'reduced' : 'full';
        root.setAttribute('data-motion', motion);
        var radios = document.querySelectorAll('input[name="motion"]');
        for (var i = 0; i < radios.length; i++) radios[i].checked = radios[i].value === motion;
    }

    function apply(next) {
        setClasses(next);
        var newSheet = document.getElementById('uiNewCss');
        var auroraSheet = document.getElementById('uiAuroraCss');
        var themeSheet = document.getElementById('uiThemesCss');
        if (newSheet) newSheet.disabled = mode !== 'new';
        if (auroraSheet) auroraSheet.disabled = !isFamily(mode);
        if (themeSheet) themeSheet.disabled = !isFamily(mode) || mode === 'aurora';
        var radios = document.querySelectorAll('input[name="uiMode"]');
        for (var i = 0; i < radios.length; i++) radios[i].checked = radios[i].value === mode;
    }

    // Apply immediately (before the body exists) to avoid a flash of the wrong UI.
    setClasses(mode);
    root.setAttribute('data-motion', motion);

    // ───────── Reveal: entrance animations start once the loader is gone ─────────
    // Fallbacks guarantee the UI is never left hidden (the splash failsafe is 7s).
    var revealed = false;
    function reveal() {
        if (revealed) return;
        revealed = true;
        root.classList.add('aur-ready');
    }
    function watchSplash() {
        var splash = document.getElementById('splash');
        if (!splash || splash.classList.contains('done') || document.body.classList.contains('ready')) { reveal(); return; }
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
        setTimeout(reveal, 7300);
    }

    // ───────── Ambient particles (styled per theme in the CSS) ─────────
    function buildFx() {
        if (document.getElementById('fx')) return;
        var fx = document.createElement('div');
        fx.id = 'fx';
        fx.className = 'fx';
        fx.setAttribute('aria-hidden', 'true');
        for (var i = 0; i < 28; i++) {
            var p = document.createElement('i');
            p.style.setProperty('--x', (Math.random() * 100).toFixed(1) + '%');
            p.style.setProperty('--y', (Math.random() * 100).toFixed(1) + '%');
            p.style.setProperty('--s', (2 + Math.random() * 4).toFixed(1) + 'px');
            p.style.setProperty('--d', (9 + Math.random() * 14).toFixed(1) + 's');
            p.style.setProperty('--dl', (-Math.random() * 20).toFixed(1) + 's');
            p.style.setProperty('--dx', (Math.random() * 120 - 60).toFixed(0) + 'px');
            fx.appendChild(p);
        }
        document.body.insertBefore(fx, document.body.firstChild);
    }

    // ───────── Celebration burst ─────────
    function burst(x, y, count, spread) {
        if (!motionOn() || !isFamily(mode)) return;
        var cs = getComputedStyle(root);
        var cols = [cs.getPropertyValue('--accent'), cs.getPropertyValue('--accent-2'), cs.getPropertyValue('--accent-3'), cs.getPropertyValue('--success')];
        var box = document.createElement('div');
        box.className = 'burst';
        box.style.left = x + 'px';
        box.style.top = y + 'px';
        for (var i = 0; i < count; i++) {
            var a = Math.random() * Math.PI * 2, d = (0.35 + Math.random() * 0.65) * spread;
            var el = document.createElement('i');
            var size = 4 + Math.random() * 6;
            el.style.setProperty('--dx', (Math.cos(a) * d).toFixed(0) + 'px');
            el.style.setProperty('--dy', (Math.sin(a) * d - spread * 0.25).toFixed(0) + 'px');
            el.style.setProperty('--rot', ((Math.random() - 0.5) * 720).toFixed(0) + 'deg');
            el.style.setProperty('--t', (0.8 + Math.random() * 0.7).toFixed(2) + 's');
            el.style.setProperty('--c', cols[i % cols.length].trim() || '#fff');
            el.style.setProperty('--w', size + 'px');
            el.style.setProperty('--h', (Math.random() < 0.5 ? size : size * 0.45) + 'px');
            el.style.setProperty('--r', Math.random() < 0.5 ? '50%' : '2px');
            box.appendChild(el);
        }
        document.body.appendChild(box);
        setTimeout(function () { box.remove(); }, 1800);
    }

    function hookNotifications() {
        var original = window.showNotification;
        if (typeof original !== 'function' || original.__wrapped) return;
        var wrapped = function (message, type) {
            var result = original.apply(this, arguments);
            try {
                if (type === 'success') {
                    var done = typeof window.t === 'function' ? window.t('download_success') : null;
                    if (done && message === done) {
                        burst(window.innerWidth * 0.5, window.innerHeight * 0.32, 70, 340);
                    } else {
                        var id = document.getElementById('appIdDisplay');
                        if (id) { var r = id.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 18, 90); }
                    }
                }
            } catch (e) { /* effects must never break the app */ }
            return result;
        };
        wrapped.__wrapped = true;
        window.showNotification = wrapped;
    }

    // ───────── Delegated effects ─────────
    function initEffects() {
        // Click ripple on buttons
        document.addEventListener('click', function (e) {
            if (!isFamily(mode) || !motionOn()) return;
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

        // Soft light that follows the cursor across the cards + gentle parallax on the glow
        var frame = 0, px = 0, py = 0, card = null;
        document.addEventListener('pointermove', function (e) {
            if (!isFamily(mode) || !motionOn()) return;
            card = e.target.closest && e.target.closest('.card');
            px = e.clientX; py = e.clientY;
            if (frame) return;
            frame = requestAnimationFrame(function () {
                frame = 0;
                root.style.setProperty('--px', ((px / window.innerWidth) * 2 - 1).toFixed(3));
                root.style.setProperty('--py', ((py / window.innerHeight) * 2 - 1).toFixed(3));
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
                if (!isFamily(mode) || !motionOn()) return;
                id.classList.remove('pop');
                void id.offsetWidth; // restart the animation
                id.classList.add('pop');
            }).observe(id, { childList: true, characterData: true, subtree: true });
        }
    }

    // ───────── Switching with a circular reveal ─────────
    function switchTo(next, originEl) {
        if (next === mode) return;
        set(KEY, next);
        var run = function () { apply(next); reveal(); };
        if (document.startViewTransition && motionOn()) {
            var r = originEl && originEl.getBoundingClientRect ? originEl.getBoundingClientRect() : null;
            root.style.setProperty('--tx', (r ? r.left + r.width / 2 : window.innerWidth / 2) + 'px');
            root.style.setProperty('--ty', (r ? r.top + r.height / 2 : window.innerHeight / 2) + 'px');
            try { document.startViewTransition(run); return; } catch (e) { /* fall through */ }
        }
        run();
    }

    document.addEventListener('DOMContentLoaded', function () {
        apply(mode);
        setMotion(motion);
        buildFx();
        initEffects();
        hookNotifications();
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
                switchTo(e.target.value, e.target.closest('.ui-option') || e.target);
            });
        }
        var motionRadios = overlay.querySelectorAll('input[name="motion"]');
        for (var j = 0; j < motionRadios.length; j++) {
            motionRadios[j].addEventListener('change', function (e) {
                if (!e.target.checked) return;
                set(MOTION_KEY, e.target.value);
                setMotion(e.target.value);
            });
        }
    });
})();
