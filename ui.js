// Interface switcher: "new" (default) or "legacy".
// Loaded in <head> so the right look is applied before first paint.
// Only toggles a class on <html> and enables/disables styles-new.css;
// it never touches app logic.
(function () {
    'use strict';

    var KEY = 'steaminjector.ui';
    var root = document.documentElement;

    function read() {
        try { return window.localStorage.getItem(KEY) === 'legacy' ? 'legacy' : 'new'; }
        catch (e) { return 'new'; }
    }
    function write(mode) {
        try { window.localStorage.setItem(KEY, mode); } catch (e) { /* storage unavailable */ }
    }

    var mode = read();

    function apply(next) {
        mode = next === 'legacy' ? 'legacy' : 'new';
        root.classList.toggle('ui-new', mode === 'new');
        root.setAttribute('data-ui', mode);
        var sheet = document.getElementById('uiNewCss');
        if (sheet) sheet.disabled = mode !== 'new';
        var radios = document.querySelectorAll('input[name="uiMode"]');
        for (var i = 0; i < radios.length; i++) radios[i].checked = radios[i].value === mode;
    }

    // Apply immediately (before the body exists) to avoid a flash of the wrong UI.
    root.classList.toggle('ui-new', mode === 'new');
    root.setAttribute('data-ui', mode);

    document.addEventListener('DOMContentLoaded', function () {
        apply(mode);

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
            });
        }
    });
})();
