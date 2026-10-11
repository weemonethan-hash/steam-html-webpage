// Loading screen controller.
//
//  • Drives the splash (progress arc, percentage, status line, title letters,
//    tips) and then dismisses it with an exit animation.
//  • Draws a particle layer that spirals into the logo as loading progresses
//    and bursts outward on completion, in the active theme's colours.
//  • Cooperative: if the host app is already driving the splash (it set --p,
//    changed the percentage, or dismissed it) this script only draws the
//    particles and follows whatever progress the host reports.
//  • Honours Settings → Animations → Reduced (and the OS setting): no
//    particles, and a short fade.
//
// It never touches app logic; the CSS failsafe in styles.css still removes
// the splash after 7s if scripting fails.
(function () {
    'use strict';

    var splash = document.getElementById('splash');
    if (!splash) return;

    var root = document.documentElement;
    var word = document.getElementById('spWord');
    var statusEl = document.getElementById('spStatus');
    var pctEl = document.getElementById('spPct');
    var stage = splash.querySelector('.sp-stage');

    function reduced() {
        return root.getAttribute('data-motion') === 'reduced';
    }

    var MIN_MS = reduced() ? 700 : 3000;
    var STATUS = [
        [0.00, 'Warming up the injector'],
        [0.30, 'Loading the interface'],
        [0.62, 'Applying your theme'],
        [0.90, 'Almost ready'],
        [1.00, 'Ready']
    ];
    var TIPS = [
        'Tip: press <kbd>?</kbd> any time for the quick tour',
        'Tip: drop .manifest or .lua files straight onto the drop zone',
        'Tip: change the look in Settings, there are six interfaces',
        'Tip: Steam must be running for the status light to turn green'
    ];

    // ───────── Title letters (only if the host did not build them) ─────────
    if (word && !word.querySelector('span')) {
        var text = word.textContent;
        word.textContent = '';
        for (var i = 0; i < text.length; i++) {
            var sp = document.createElement('span');
            sp.style.setProperty('--i', i);
            if (text[i] === ' ') { sp.className = 'sp-gap'; sp.innerHTML = '&nbsp;'; }
            else sp.textContent = text[i];
            word.appendChild(sp);
        }
    }

    // ───────── Extra decoration (orbits, tip line, particle canvas) ─────────
    if (stage && !stage.querySelector('.sp-orbit')) {
        var orbit = document.createElement('div');
        orbit.className = 'sp-orbit';
        orbit.setAttribute('aria-hidden', 'true');
        orbit.innerHTML = '<i></i><i></i><i></i>';
        stage.appendChild(orbit);
    }
    var tipEl = document.createElement('div');
    tipEl.className = 'sp-tip';
    tipEl.setAttribute('aria-hidden', 'true');
    var meter = splash.querySelector('.sp-meter');
    if (meter && meter.parentNode) meter.parentNode.appendChild(tipEl);

    var canvas = null, ctx = null, W = 0, H = 0, DPR = 1;
    if (!reduced()) {
        canvas = document.createElement('canvas');
        canvas.className = 'splash-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        splash.insertBefore(canvas, splash.firstChild);
        ctx = canvas.getContext('2d');
    }

    function resize() {
        if (!canvas) return;
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = splash.clientWidth; H = splash.clientHeight;
        canvas.width = W * DPR; canvas.height = H * DPR;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // ───────── Progress model ─────────
    var t0 = performance.now();
    var loaded = document.readyState === 'complete';
    var fontsOk = false;
    var finished = false;
    var progress = 0;
    var hostDriven = false;
    var decided = false;
    var lastStatus = -1;
    var tipIndex = 0;

    if (!loaded) window.addEventListener('load', function () { loaded = true; });
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { fontsOk = true; });
        setTimeout(function () { fontsOk = true; }, 2200); // offline / slow font host: don't wait
    } else { fontsOk = true; }

    function ease(x) { return 1 - Math.pow(1 - x, 2.4); }

    function setStatus(p) {
        var idx = 0;
        for (var i = 0; i < STATUS.length; i++) if (p >= STATUS[i][0]) idx = i;
        if (idx === lastStatus || !statusEl) return;
        lastStatus = idx;
        statusEl.classList.add('swap');
        setTimeout(function () { statusEl.textContent = STATUS[idx][1]; statusEl.classList.remove('swap'); }, 180);
    }

    function setTip() {
        tipEl.classList.add('swap');
        setTimeout(function () {
            tipEl.innerHTML = TIPS[tipIndex++ % TIPS.length];
            tipEl.classList.remove('swap');
        }, 380);
    }
    setTimeout(setTip, 500);
    var tipTimer = setInterval(setTip, 2600);

    function readHostProgress() {
        var v = parseFloat(splash.style.getPropertyValue('--p'));
        return isNaN(v) ? 0 : v;
    }

    // ───────── Particles ─────────
    var parts = [];
    var burst = false;
    var COUNT = 110;

    function palette() {
        var cs = getComputedStyle(root);
        function v(n, d) { var x = cs.getPropertyValue(n).trim(); return x || d; }
        return [v('--accent', '#62d0ff'), v('--accent-2', '#3d8bff'), v('--accent-3', v('--accent', '#62d0ff'))];
    }
    var colors = palette();
    var light = root.getAttribute('data-ui') === 'daylight';

    function center() {
        var r = stage ? stage.getBoundingClientRect() : null;
        return r ? [r.left + r.width / 2, r.top + r.height / 2] : [W / 2, H / 2];
    }

    function spawn(far) {
        var maxR = Math.max(W, H) * 0.62;
        return {
            a: Math.random() * Math.PI * 2,
            r: far ? maxR * (0.35 + Math.random() * 0.65) : 90 + Math.random() * maxR * 0.5,
            s: 0.4 + Math.random() * 1.2,     // spiral speed
            z: 0.8 + Math.random() * 1.9,     // size
            c: colors[(Math.random() * colors.length) | 0],
            vx: 0, vy: 0, life: 1
        };
    }
    for (var k = 0; k < COUNT; k++) parts.push(spawn(true));

    function triggerBurst() {
        burst = true;
        var c = center();
        parts = [];
        for (var i = 0; i < 150; i++) {
            var ang = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 9;
            parts.push({ x: c[0], y: c[1], vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, z: 1 + Math.random() * 2.4, c: colors[(Math.random() * colors.length) | 0], life: 1 });
        }
    }

    function draw(p) {
        if (!ctx) return;
        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
        var c = center();
        for (var i = 0; i < parts.length; i++) {
            var q = parts[i], x, y, alpha;
            if (burst) {
                q.x += q.vx; q.y += q.vy; q.vx *= 0.955; q.vy *= 0.955; q.vy += 0.04;
                q.life -= 0.016;
                if (q.life <= 0) continue;
                x = q.x; y = q.y; alpha = q.life;
            } else {
                // spiral inward; faster and tighter the further loading has got
                q.r -= q.s * (0.35 + p * 2.6);
                q.a += (0.004 + 0.012 * p) * (1 + 60 / (q.r + 40));
                if (q.r < 34) { Object.assign(q, spawn(true)); }
                x = c[0] + Math.cos(q.a) * q.r;
                y = c[1] + Math.sin(q.a) * q.r * 0.8;
                alpha = Math.min(1, (q.r - 30) / 140) * (0.25 + 0.6 * p + 0.15);
            }
            ctx.globalAlpha = Math.max(0, alpha) * (light ? 0.7 : 1);
            ctx.fillStyle = q.c;
            ctx.beginPath();
            ctx.arc(x, y, q.z, 0, 6.2832);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ───────── Finish ─────────
    function finish() {
        if (finished) return;
        finished = true;
        clearInterval(tipTimer);
        setStatus(1);
        splash.classList.add('full');
        if (pctEl) pctEl.textContent = '100%';
        splash.style.setProperty('--p', 1);
        if (!reduced()) triggerBurst();
        setTimeout(function () {
            splash.classList.add('done');
            document.body.classList.add('ready');
            splash.setAttribute('aria-busy', 'false');
        }, reduced() ? 80 : 760);
        // let the exit animation finish, then stop painting
        setTimeout(function () { if (canvas) canvas.remove(); }, 2200);
    }

    // ───────── Main loop ─────────
    function frame(now) {
        // keep painting while the exit animation plays, then stop
        if (splash.classList.contains('done') && (!canvas || !canvas.parentNode)) return;

        var t = now - t0;

        // After a moment, decide whether the host is driving the splash.
        // For the first 450ms we only watch; then we either follow or lead.
        if (!decided && t > 450) {
            decided = true;
            hostDriven = readHostProgress() > 0.02 || (pctEl && pctEl.textContent !== '0%') ||
                splash.classList.contains('full') || splash.classList.contains('done');
        }

        if (hostDriven) {
            progress = readHostProgress();
            if (splash.classList.contains('full') && !burst && !reduced()) triggerBurst();
        } else if (decided && !finished) {
            var cap = (loaded && fontsOk) ? 1 : 0.9;
            var target = Math.min(ease(Math.min(t / MIN_MS, 1)), cap);
            progress += (target - progress) * 0.2;     // smooth any jumps
            if (progress > 0.9995 || (target >= 1 && progress > 0.995)) progress = 1;
            splash.style.setProperty('--p', progress.toFixed(4));
            if (pctEl) { pctEl.textContent = Math.round(progress * 100) + '%'; }
            setStatus(progress);
            if (progress >= 1) finish();
        }

        draw(progress);
        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
})();
