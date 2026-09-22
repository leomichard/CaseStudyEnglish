/* Synthetic Witness — 3D scenes (Three.js r128, global THREE)
 * Each scene: Scenes.<name>(canvasElement)
 * Drag to rotate, scroll the page normally. */
(function () {
    'use strict';

    var BRASS = new THREE.Color(0xC9A227);
    var TEAL = new THREE.Color(0x3FA7A0);
    var RED = new THREE.Color(0xE64545);
    var GREY = new THREE.Color(0x4A505B);
    var PAPER = new THREE.Color(0xEDEBE6);
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Soft round sprite for points
    function dotTexture() {
        var c = document.createElement('canvas');
        c.width = c.height = 64;
        var g = c.getContext('2d');
        var grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grd.addColorStop(0, 'rgba(255,255,255,1)');
        grd.addColorStop(0.35, 'rgba(255,255,255,0.8)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, 64, 64);
        var t = new THREE.CanvasTexture(c);
        return t;
    }

    // Shared boilerplate: renderer, camera, resize, drag-to-rotate group
    function setup(canvas, camZ) {
        var renderer = new THREE.WebGLRenderer({canvas: canvas, antialias: true, alpha: true});
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        var scene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
        camera.position.set(0, 0, camZ || 5);
        var root = new THREE.Group();
        scene.add(root);

        function resize() {
            var w = canvas.clientWidth, h = canvas.clientHeight;
            if (!w || !h) return;
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        }

        if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
        window.addEventListener('resize', resize);
        resize();

        // drag rotation with inertia
        var drag = {on: false, x: 0, y: 0, vx: 0, vy: 0, rx: 0, ry: 0};
        canvas.addEventListener('pointerdown', function (e) {
            drag.on = true;
            drag.x = e.clientX;
            drag.y = e.clientY;
            canvas.setPointerCapture(e.pointerId);
        });
        canvas.addEventListener('pointermove', function (e) {
            if (!drag.on) return;
            drag.vy = (e.clientX - drag.x) * 0.006;
            drag.vx = (e.clientY - drag.y) * 0.006;
            drag.x = e.clientX;
            drag.y = e.clientY;
        });
        canvas.addEventListener('pointerup', function () {
            drag.on = false;
        });

        function applyDrag(autoSpin) {
            drag.ry += drag.vy + (drag.on ? 0 : autoSpin);
            drag.rx = Math.max(-1, Math.min(1, drag.rx + drag.vx));
            drag.vx *= 0.9;
            drag.vy *= 0.9;
            root.rotation.y = drag.ry;
            root.rotation.x = drag.rx;
        }

        // only animate when visible
        var visible = true;
        if (window.IntersectionObserver) {
            new IntersectionObserver(function (en) {
                visible = en[0].isIntersecting;
            }).observe(canvas);
        }

        function loop(fn) {
            var clock = new THREE.Clock();

            function frame() {
                requestAnimationFrame(frame);
                if (!visible) return;
                var t = clock.getElapsedTime() * (reduced ? 0.25 : 1);
                fn(t);
                renderer.render(scene, camera);
            }

            frame();
        }

        return {renderer: renderer, scene: scene, camera: camera, root: root, applyDrag: applyDrag, loop: loop};
    }

    function gauss(d, center, width) {
        var dot = d.x * center.x + d.y * center.y + d.z * center.z;
        var dist = Math.acos(Math.max(-1, Math.min(1, dot)));
        return Math.exp(-(dist * dist) / (2 * width * width));
    }

    /* 1 — Face ↔ data: a head-shaped point cloud that dissolves into a pixel grid and reforms */
    function morphFace(canvas) {
        var s = setup(canvas, 4.6);
        var N = 9000;
        var face = new Float32Array(N * 3), grid = new Float32Array(N * 3), pos = new Float32Array(N * 3);
        var col = new Float32Array(N * 3);
        var nose = new THREE.Vector3(0, -0.05, 1).normalize();
        var eyeL = new THREE.Vector3(-0.36, 0.22, 0.9).normalize();
        var eyeR = new THREE.Vector3(0.36, 0.22, 0.9).normalize();
        var mouth = new THREE.Vector3(0, -0.42, 0.9).normalize();
        var brow = new THREE.Vector3(0, 0.3, 0.95).normalize();
        var golden = Math.PI * (3 - Math.sqrt(5));

        for (var i = 0; i < N; i++) {
            var y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i;
            var d = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
            var rad = 1
                + 0.30 * gauss(d, nose, 0.13)
                - 0.13 * gauss(d, eyeL, 0.13)
                - 0.13 * gauss(d, eyeR, 0.13)
                + 0.06 * gauss(d, brow, 0.22)
                - 0.05 * gauss(d, mouth, 0.09);
            if (d.y < -0.55) rad *= 0.92; // narrower chin
            var fx = d.x * rad * 0.82, fy = d.y * rad * 1.12, fz = d.z * rad * 0.95;
            face[i * 3] = fx;
            face[i * 3 + 1] = fy;
            face[i * 3 + 2] = fz;
            var q = 0.16;
            grid[i * 3] = Math.round(fx * 1.6 / q) * q;
            grid[i * 3 + 1] = Math.round(fy * 1.3 / q) * q;
            grid[i * 3 + 2] = Math.round((fz * 0.4) / q) * q + (Math.random() - 0.5) * 0.05;
            var c = d.z > 0.2 ? BRASS : GREY.clone().lerp(BRASS, 0.35);
            col[i * 3] = c.r;
            col[i * 3 + 1] = c.g;
            col[i * 3 + 2] = c.b;
        }

        var geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        var tex = dotTexture();
        var mat = new THREE.PointsMaterial({
            size: 0.035, map: tex, vertexColors: true, transparent: true,
            depthWrite: false, blending: THREE.AdditiveBlending
        });
        var pts = new THREE.Points(geo, mat);
        s.root.add(pts);

        // chromatic "ghosts" for the glitch
        function ghost(color) {
            var m = new THREE.PointsMaterial({
                size: 0.03, map: tex, color: color, transparent: true, opacity: 0,
                depthWrite: false, blending: THREE.AdditiveBlending
            });
            var p = new THREE.Points(geo, m);
            s.root.add(p);
            return p;
        }

        var gR = ghost(RED), gT = ghost(TEAL);
        var label = canvas.parentNode.querySelector('[data-state]');

        s.loop(function (t) {
            // 10 s cycle: face (0-5) → dissolve (5-6.5) → grid (6.5-8.5) → reform (8.5-10)
            var cyc = t % 10, k;
            if (cyc < 5) k = 0;
            else if (cyc < 6.5) k = (cyc - 5) / 1.5;
            else if (cyc < 8.5) k = 1;
            else k = 1 - (cyc - 8.5) / 1.5;
            var e = k * k * (3 - 2 * k);
            for (var i = 0; i < N * 3; i++) {
                var n = Math.sin(t * 2 + i * 0.37) * 0.015 * e;
                pos[i] = face[i] + (grid[i] - face[i]) * e + n;
            }
            geo.attributes.position.needsUpdate = true;
            var glitch = (cyc > 4.7 && cyc < 5.3) || (cyc > 8.4 && cyc < 8.9) ? 1 : 0;
            gR.material.opacity = glitch * 0.6;
            gT.material.opacity = glitch * 0.6;
            gR.position.x = glitch * (0.04 + Math.random() * 0.04);
            gT.position.x = -glitch * (0.04 + Math.random() * 0.04);
            if (label) {
                var st = e > 0.5 ? 'DATA' : 'FACE';
                if (label.textContent !== st) label.textContent = st;
            }
            s.applyDrag(0.004);
        });
    }

    /* 2 — 14,000 presumed CFake victims; the 13 civil parties are lit */
    function victimCloud(canvas) {
        var s = setup(canvas, 5.2);
        var N = 14000, pos = new Float32Array(N * 3);
        for (var i = 0; i < N; i++) {
            // uniform in a thick shell
            var u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
            var r = 1.1 + Math.pow(Math.random(), 0.6) * 0.6;
            var sq = Math.sqrt(1 - u * u);
            pos[i * 3] = Math.cos(th) * sq * r;
            pos[i * 3 + 1] = u * r;
            pos[i * 3 + 2] = Math.sin(th) * sq * r;
        }
        var geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        var tex = dotTexture();
        var cloud = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 0.022, map: tex, color: 0x6B717C, transparent: true, opacity: 0.75,
            depthWrite: false, blending: THREE.AdditiveBlending
        }));
        s.root.add(cloud);

        var M = 13, lit = new Float32Array(M * 3);
        for (var j = 0; j < M; j++) {
            var idx = Math.floor(Math.random() * N);
            lit[j * 3] = pos[idx * 3];
            lit[j * 3 + 1] = pos[idx * 3 + 1];
            lit[j * 3 + 2] = pos[idx * 3 + 2];
        }
        var lgeo = new THREE.BufferGeometry();
        lgeo.setAttribute('position', new THREE.BufferAttribute(lit, 3));
        var lmat = new THREE.PointsMaterial({
            size: 0.16, map: tex, color: BRASS, transparent: true,
            depthWrite: false, blending: THREE.AdditiveBlending
        });
        s.root.add(new THREE.Points(lgeo, lmat));

        // a scanning ring = the investigation sweeping through
        var ring = new THREE.Mesh(
            new THREE.TorusGeometry(1.95, 0.004, 8, 160),
            new THREE.MeshBasicMaterial({color: RED, transparent: true, opacity: 0.6})
        );
        ring.rotation.x = Math.PI / 2;
        s.root.add(ring);

        s.loop(function (t) {
            lmat.size = 0.14 + Math.sin(t * 3) * 0.04;
            var y = Math.sin(t * 0.5) * 1.6;
            ring.position.y = y;
            var sc = Math.sqrt(Math.max(0.02, 1 - (y / 1.8) * (y / 1.8)));
            ring.scale.set(sc, sc, sc);
            s.applyDrag(0.0025);
        });
    }

    /* 3 — A fake spreading through a social network faster than the fact-check */
    function spreadNetwork(canvas) {
        var s = setup(canvas, 5.4);
        var N = 220, nodes = [], i, j;
        for (i = 0; i < N; i++) {
            var v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
            if (v.length() > 1) {
                i--;
                continue;
            }
            nodes.push(v.multiplyScalar(1.7));
        }
        // connect each node to its 3 nearest neighbours
        var adj = nodes.map(function () {
            return [];
        });
        var edges = [];
        for (i = 0; i < N; i++) {
            var near = [];
            for (j = 0; j < N; j++) if (j !== i) near.push([nodes[i].distanceToSquared(nodes[j]), j]);
            near.sort(function (a, b) {
                return a[0] - b[0];
            });
            for (var k = 0; k < 3; k++) {
                var n = near[k][1];
                if (adj[i].indexOf(n) < 0) {
                    adj[i].push(n);
                    adj[n].push(i);
                    edges.push([i, n]);
                }
            }
        }

        var npos = new Float32Array(N * 3), ncol = new Float32Array(N * 3);
        nodes.forEach(function (p, i) {
            npos[i * 3] = p.x;
            npos[i * 3 + 1] = p.y;
            npos[i * 3 + 2] = p.z;
        });
        var ngeo = new THREE.BufferGeometry();
        ngeo.setAttribute('position', new THREE.BufferAttribute(npos, 3));
        ngeo.setAttribute('color', new THREE.BufferAttribute(ncol, 3));
        var tex = dotTexture();
        s.root.add(new THREE.Points(ngeo, new THREE.PointsMaterial({
            size: 0.11, map: tex, vertexColors: true, transparent: true,
            depthWrite: false, blending: THREE.AdditiveBlending
        })));

        var epos = new Float32Array(edges.length * 6), ecol = new Float32Array(edges.length * 6);
        edges.forEach(function (e, k) {
            var a = nodes[e[0]], b = nodes[e[1]];
            epos.set([a.x, a.y, a.z, b.x, b.y, b.z], k * 6);
        });
        var egeo = new THREE.BufferGeometry();
        egeo.setAttribute('position', new THREE.BufferAttribute(epos, 3));
        egeo.setAttribute('color', new THREE.BufferAttribute(ecol, 3));
        s.root.add(new THREE.LineSegments(egeo, new THREE.LineBasicMaterial({
            vertexColors: true, transparent: true, opacity: 0.55
        })));

        var hitAt = new Float32Array(N), checkAt = new Float32Array(N), start = 0;
        var counter = canvas.parentNode.querySelector('[data-count]');

        function seed(t) {
            start = t;
            // BFS from a random source (the fake) and, 1.5 s later, from another (the fact-check)
            function bfs(src, delay, out, speed) {
                for (var i = 0; i < N; i++) out[i] = Infinity;
                out[src] = delay;
                var q = [src];
                while (q.length) {
                    var c = q.shift();
                    adj[c].forEach(function (n) {
                        if (out[n] === Infinity) {
                            out[n] = out[c] + speed * (0.6 + Math.random() * 0.8);
                            q.push(n);
                        }
                    });
                }
            }

            bfs(Math.floor(Math.random() * N), 0, hitAt, 0.22);
            bfs(Math.floor(Math.random() * N), 2.0, checkAt, 0.55);
        }

        seed(0);
        var tmp = new THREE.Color();

        s.loop(function (t) {
            var lt = t - start;
            if (lt > 12) seed(t);
            var reached = 0;
            for (var i = 0; i < N; i++) {
                var h = Math.max(0, Math.min(1, (lt - hitAt[i]) * 3));
                var c = Math.max(0, Math.min(1, (lt - checkAt[i]) * 3));
                if (h > 0.5) reached++;
                tmp.copy(GREY).lerp(RED, h).lerp(TEAL, c * 0.85);
                ncol[i * 3] = tmp.r;
                ncol[i * 3 + 1] = tmp.g;
                ncol[i * 3 + 2] = tmp.b;
            }
            edges.forEach(function (e, k) {
                for (var m = 0; m < 2; m++) {
                    var ni = e[m];
                    ecol[k * 6 + m * 3] = ncol[ni * 3] * 0.6;
                    ecol[k * 6 + m * 3 + 1] = ncol[ni * 3 + 1] * 0.6;
                    ecol[k * 6 + m * 3 + 2] = ncol[ni * 3 + 2] * 0.6;
                }
            });
            ngeo.attributes.color.needsUpdate = true;
            egeo.attributes.color.needsUpdate = true;
            if (counter) counter.textContent = Math.round(reached / N * 100) + '%';
            s.applyDrag(0.003);
        });
    }

    /* 4 — Chain of trust: sensor → secure chip → signed edit → platform → viewer */
    function trustChain(canvas) {
        var s = setup(canvas, 7.5);
        s.camera.position.set(0, 1.4, 7.5);
        s.camera.lookAt(0, 0, 0);
        s.scene.add(new THREE.AmbientLight(0xffffff, 0.45));
        var dl = new THREE.DirectionalLight(0xffffff, 0.9);
        dl.position.set(3, 5, 4);
        s.scene.add(dl);

        var names = ['SENSOR', 'SECURE CHIP', 'SIGNED EDIT', 'PLATFORM', 'VIEWER'];
        var subs = ['photons captured', 'C2PA signature', 'edit logged + signed', 'credentials kept', ''];
        var blocks = [], labels = [];
        var spacing = 1.55;

        function labelCanvas(title, sub, color) {
            var c = document.createElement('canvas');
            c.width = 512;
            c.height = 256;
            var g = c.getContext('2d');
            g.fillStyle = '#15181D';
            g.fillRect(0, 0, 512, 256);
            g.strokeStyle = color;
            g.lineWidth = 8;
            g.strokeRect(4, 4, 504, 248);
            g.fillStyle = color;
            g.font = '600 52px "IBM Plex Mono", monospace';
            g.textAlign = 'center';
            g.fillText(title, 256, 120);
            g.fillStyle = '#9AA0AC';
            g.font = '34px "IBM Plex Mono", monospace';
            g.fillText(sub, 256, 180);
            return c;
        }

        names.forEach(function (n, i) {
            var x = (i - 2) * spacing;
            var cv = labelCanvas(n, subs[i], '#C9A227');
            var tex = new THREE.CanvasTexture(cv);
            var side = new THREE.MeshStandardMaterial({color: 0x1B1F26, metalness: 0.6, roughness: 0.4});
            var front = new THREE.MeshStandardMaterial({map: tex, metalness: 0.1, roughness: 0.8});
            var box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.5),
                [side, side, side, side, front, side]);
            box.position.set(x, Math.sin(i * 0.9) * 0.15, -Math.abs(i - 2) * 0.35);
            s.root.add(box);
            blocks.push(box);
            labels.push({canvas: cv, tex: tex});
            // tiny "pins" to make the chip read as a chip
            if (i === 1) {
                for (var p = -4; p <= 4; p++) {
                    var pin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.05),
                        new THREE.MeshStandardMaterial({color: 0xC9A227, metalness: 1, roughness: 0.3}));
                    pin.position.set(x + p * 0.11, box.position.y - 0.33, box.position.z);
                    s.root.add(pin);
                }
            }
        });

        var links = [];
        for (var i = 0; i < names.length - 1; i++) {
            var a = blocks[i].position, b = blocks[i + 1].position;
            var mid = a.clone().add(b).multiplyScalar(0.5);
            var link = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 12, 32),
                new THREE.MeshStandardMaterial({color: 0xC9A227, metalness: 0.9, roughness: 0.3, emissive: 0x000000}));
            link.position.copy(mid);
            link.rotation.y = Math.PI / 2;
            s.root.add(link);
            links.push(link);
        }

        var pulse = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16),
            new THREE.MeshBasicMaterial({color: 0xEDEBE6}));
        s.root.add(pulse);
        var glow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: dotTexture(), color: 0xC9A227, transparent: true,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        glow.scale.set(0.7, 0.7, 0.7);
        pulse.add(glow);

        var viewer = labels[4], lastState = null;
        var status = canvas.parentNode.querySelector('[data-status]');

        function setViewer(state) {
            if (state === lastState) return;
            lastState = state;
            var map = {
                wait: ['VIEWER', 'checking…', '#9AA0AC'],
                ok: ['VERIFIED ✓', 'chain intact', '#3FA7A0'],
                ko: ['UNVERIFIED ✗', 'chain broken', '#E64545']
            }[state];
            var fresh = labelCanvas(map[0], map[1], map[2]);
            viewer.canvas.getContext('2d').drawImage(fresh, 0, 0);
            viewer.tex.needsUpdate = true;
            if (status) {
                status.textContent = state === 'ok' ? 'authentic image' : state === 'ko' ? 'tampered image' : 'in transit';
                status.className = state === 'ko' ? 'red' : '';
            }
        }

        s.loop(function (t) {
            // 7 s per trip; every second trip gets tampered between SIGNED EDIT and PLATFORM
            var trip = Math.floor(t / 7), f = (t % 7) / 6, tampered = trip % 2 === 1;
            var seg = Math.min(3.999, f * 4), si = Math.floor(seg), sf = seg - si;
            if (f <= 1) {
                pulse.visible = true;
                pulse.position.lerpVectors(blocks[si].position, blocks[si + 1].position, sf);
                pulse.position.z += 0.3;
            } else {
                pulse.visible = false;
            }
            var broken = tampered && seg > 2.5;
            glow.material.color.copy(broken ? RED : BRASS);
            pulse.material.color.copy(broken ? RED : PAPER);
            links.forEach(function (l, k) {
                var bad = tampered && k === 2 && seg > 2.5;
                l.material.color.copy(bad ? RED : BRASS);
                l.material.emissive.copy(bad ? RED : new THREE.Color(0)).multiplyScalar(bad ? 0.6 : 0);
                l.rotation.x = bad ? Math.sin(t * 40) * 0.25 : 0;
            });
            setViewer(f < 0.97 ? 'wait' : tampered ? 'ko' : 'ok');
            s.applyDrag(0);
            s.root.rotation.y += Math.sin(t * 0.3) * 0.25 - s.root.rotation.y * 0.02;
        });
    }

    window.Scenes = {morphFace: morphFace, victimCloud: victimCloud, spreadNetwork: spreadNetwork, trustChain: trustChain};

    // auto-mount: <canvas data-scene="morphFace">
    document.querySelectorAll('canvas[data-scene]').forEach(function (c) {
        try {
            window.Scenes[c.dataset.scene](c);
        } catch (e) {
            console.error(e);
            c.parentNode.style.display = 'none';
        }
    });
})();
