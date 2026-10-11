// "Manage Added Games" dialog.
// Uses the same two app calls as before: electronAPI.getInstalledGames()
// and electronAPI.removeGame(appId). Nothing else in the app depends on it.
(function () {
    'use strict';

    var openBtn = document.getElementById('manageGamesBtn');
    var overlay = document.getElementById('manageGamesModal');
    var closeBtn = document.getElementById('closeModalBtn');
    var body = document.getElementById('installedGamesListContainer');
    var search = document.getElementById('manageSearch');
    var refreshBtn = document.getElementById('manageRefresh');
    var countEl = document.getElementById('manageCount');
    var live = document.getElementById('manageLive');
    if (!openBtn || !overlay || !body) return;

    var games = [];          // App IDs (strings), sorted numerically
    var filter = '';
    var confirming = null;   // App ID currently asking "Remove?"
    var busy = {};           // App IDs being removed
    var loadToken = 0;       // ignores results of out-of-date loads
    var confirmTimer = null;
    var lastFocus = null;
    var status = 'loading';  // loading | ready | error

    function toast(msg, type) {
        if (typeof showNotification === 'function') showNotification(msg, type || 'info');
    }
    function announce(msg) { if (live) live.textContent = msg; }

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }

    function sortIds(list) {
        return list.map(String).sort(function (a, b) {
            var x = Number(a), y = Number(b);
            if (isNaN(x) || isNaN(y)) return a < b ? -1 : a > b ? 1 : 0;
            return x - y;
        });
    }

    function visible() {
        var q = filter.trim();
        return q ? games.filter(function (id) { return id.indexOf(q) !== -1; }) : games;
    }

    function updateCount() {
        if (!countEl) return;
        countEl.textContent = status === 'ready' ? String(games.length) : '';
        countEl.hidden = status !== 'ready';
    }

    // ── Rendering ──────────────────────────────────────────────
    function message(text, actionLabel, action) {
        var box = el('div', 'no-games');
        box.appendChild(el('p', null, text));
        if (actionLabel) {
            var b = el('button', 'manage-btn', actionLabel);
            b.type = 'button';
            b.addEventListener('click', action);
            box.appendChild(b);
        }
        return box;
    }

    function render() {
        updateCount();
        body.textContent = '';
        body.setAttribute('aria-busy', status === 'loading' ? 'true' : 'false');
        var toolbarOn = status === 'ready' && games.length > 0;
        if (search) search.parentNode.hidden = !toolbarOn;

        if (status === 'loading') { body.appendChild(message('Loading added games…')); return; }
        if (status === 'error') {
            body.appendChild(message('Could not read your added games. Check the Steam path in Configuration, then try again.', 'Try again', load));
            return;
        }
        if (!games.length) {
            body.appendChild(message('No games added yet. Open a game page, then choose Add to Steam.'));
            return;
        }
        var list = visible();
        if (!list.length) { body.appendChild(message('No App ID contains “' + filter.trim() + '”.')); return; }

        var ul = el('ul', 'game-list');
        list.forEach(function (id) { ul.appendChild(row(id)); });
        body.appendChild(ul);
    }

    function row(id) {
        var li = el('li', 'game-list-item');
        li.setAttribute('data-appid', id);
        var label = el('span', 'game-id');
        label.appendChild(el('span', 'game-id-label', 'App ID '));
        label.appendChild(el('strong', null, id));
        li.appendChild(label);

        var actions = el('div', 'game-actions');

        if (busy[id]) {
            actions.appendChild(el('span', 'game-state', 'Removing…'));
        } else if (confirming === id) {
            actions.appendChild(el('span', 'game-state', 'Remove this game?'));
            actions.appendChild(button('Cancel', 'manage-btn', function () { setConfirm(null); }));
            var yes = button('Remove', 'btn-remove-game', function () { remove(id); });
            yes.setAttribute('data-confirm', id);
            actions.appendChild(yes);
        } else {
            actions.appendChild(button('View', 'manage-btn', function () { view(id); }, 'View App ID ' + id + ' on SteamDB'));
            actions.appendChild(button('Copy', 'manage-btn', function (e) { copy(id, e.currentTarget); }, 'Copy App ID ' + id));
            actions.appendChild(button('Remove', 'btn-remove-game', function () { setConfirm(id); }, 'Remove App ID ' + id));
        }
        li.appendChild(actions);
        return li;
    }

    function button(text, cls, handler, aria) {
        var b = el('button', cls, text);
        b.type = 'button';
        if (aria) b.setAttribute('aria-label', aria);
        b.addEventListener('click', handler);
        return b;
    }

    // ── Actions ────────────────────────────────────────────────
    function setConfirm(id) {
        clearTimeout(confirmTimer);
        confirming = id;
        render();
        if (id) {
            var yes = body.querySelector('[data-confirm="' + id + '"]');
            if (yes) yes.focus();
            // Back out on its own so a stray click can't remove a game later.
            confirmTimer = setTimeout(function () { if (confirming === id) setConfirm(null); }, 6000);
        }
    }

    async function remove(id) {
        clearTimeout(confirmTimer);
        confirming = null;
        busy[id] = true;
        render();
        try {
            var res = await window.electronAPI.removeGame(id);
            if (res && res.success) {
                games = games.filter(function (g) { return g !== id; });
                toast('Removed App ID ' + id, 'success');
                announce('Removed App ID ' + id);
            } else {
                toast('Could not remove App ID ' + id + '. Please try again.', 'error');
            }
        } catch (err) {
            toast('Could not remove App ID ' + id + ': ' + (err && err.message ? err.message : 'unknown error'), 'error');
        }
        delete busy[id];
        render();
    }

    function view(id) {
        var wv = document.getElementById('webview');
        var url = 'https://steamdb.info/app/' + encodeURIComponent(id) + '/';
        close();
        if (!wv) return;
        if (typeof wv.loadURL === 'function') wv.loadURL(url); else wv.setAttribute('src', url);
    }

    function copy(id, btn) {
        function done(ok) {
            var old = btn.textContent;
            btn.textContent = ok ? 'Copied' : 'Copy failed';
            setTimeout(function () { btn.textContent = old; }, 1200);
        }
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(id).then(function () { done(true); }, function () { done(false); });
            } else { done(false); }
        } catch (e) { done(false); }
    }

    async function load() {
        var token = ++loadToken;
        status = 'loading';
        confirming = null;
        render();
        try {
            var list = await window.electronAPI.getInstalledGames();
            if (token !== loadToken) return;
            games = sortIds(Array.isArray(list) ? list : []);
            status = 'ready';
        } catch (err) {
            if (token !== loadToken) return;
            status = 'error';
        }
        render();
        if (status === 'ready') announce(games.length + (games.length === 1 ? ' game' : ' games') + ' added');
    }

    // ── Open / close ───────────────────────────────────────────
    function isOpen() { return overlay.classList.contains('open'); }

    function open() {
        lastFocus = document.activeElement;
        filter = '';
        if (search) search.value = '';
        overlay.classList.add('open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
        load();
        setTimeout(function () { if (closeBtn) closeBtn.focus(); }, 30);
    }

    function close() {
        clearTimeout(confirmTimer);
        confirming = null;
        loadToken++;
        overlay.classList.remove('open');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    openBtn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (refreshBtn) refreshBtn.addEventListener('click', load);
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    if (search) search.addEventListener('input', function () { filter = search.value; render(); });

    document.addEventListener('keydown', function (e) {
        if (!isOpen()) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            if (confirming) setConfirm(null); else close();
        } else if (e.key === 'Tab') {
            var f = Array.prototype.filter.call(
                overlay.querySelectorAll('button:not(:disabled), input:not(:disabled)'),
                function (n) { return n.offsetParent !== null; });
            if (!f.length) return;
            var first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
    });
})();
