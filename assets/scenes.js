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

    /* 4 — Chain of trust: sensor → secure chip → signed edit → platform → viewer
     * A photo travels along the chain collecting signature seals. Every second trip an
     * attacker edits it without signing: the link breaks, seals turn red, the viewer rejects it. */
    function trustChain(canvas) {
        var s = setup(canvas, 7.5);
        s.camera.position.set(0, 1.6, 7.8);
        s.camera.lookAt(0, 0, 0);
        s.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
        var dl = new THREE.DirectionalLight(0xffffff, 0.9);
        dl.position.set(3, 5, 4);
        s.scene.add(dl);
        var rim = new THREE.PointLight(0xC9A227, 0.8, 8);
        rim.position.set(0, 1.5, 1.5);
        s.scene.add(rim);

        var floor = new THREE.GridHelper(12, 24, 0x3a3f4a, 0x22262e);
        floor.position.y = -0.95;
        floor.material.transparent = true;
        floor.material.opacity = 0.55;
        s.root.add(floor);

        var names = ['SENSOR', 'SECURE CHIP', 'SIGNED EDIT', 'PLATFORM', 'VIEWER'];
        var subs = ['photons captured', 'C2PA signature', 'edit logged + signed', 'credentials kept', ''];
        var blocks = [], labels = [];
        var spacing = 1.55;

        function labelCanvas(title, sub, color, num) {
            var c = document.createElement('canvas');
            c.width = 512;
            c.height = 256;
            var g = c.getContext('2d');
            var bg = g.createLinearGradient(0, 0, 0, 256);
            bg.addColorStop(0, '#1d2128');
            bg.addColorStop(1, '#101317');
            g.fillStyle = bg;
            g.fillRect(0, 0, 512, 256);
            g.strokeStyle = color;
            g.lineWidth = 8;
            g.strokeRect(4, 4, 504, 248);
            g.lineWidth = 3;
            g.globalAlpha = 0.5;
            g.strokeRect(20, 20, 472, 216);
            g.globalAlpha = 1;
            g.fillStyle = color;
            g.font = '600 52px "IBM Plex Mono", monospace';
            g.textAlign = 'center';
            g.fillText(title, 256, 125);
            g.fillStyle = '#9AA0AC';
            g.font = '34px "IBM Plex Mono", monospace';
            g.fillText(sub, 256, 185);
            if (num) {
                g.textAlign = 'left';
                g.font = '500 30px "IBM Plex Mono", monospace';
                g.fillStyle = color;
                g.fillText(num, 38, 64);
            }
            return c;
        }

        var brassMat = new THREE.MeshStandardMaterial({color: 0xC9A227, metalness: 1, roughness: 0.3});
        var edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.1, 0.55, 0.5));

        names.forEach(function (n, i) {
            var x = (i - 2) * spacing;
            var cv = labelCanvas(n, subs[i], '#C9A227', '0' + (i + 1));
            var tex = new THREE.CanvasTexture(cv);
            var side = new THREE.MeshStandardMaterial({color: 0x1B1F26, metalness: 0.6, roughness: 0.4});
            var front = new THREE.MeshStandardMaterial({map: tex, metalness: 0.1, roughness: 0.8});
            var box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.5),
                [side, side, side, side, front, side]);
            box.position.set(x, Math.sin(i * 0.9) * 0.15, -Math.abs(i - 2) * 0.35);
            box.userData.baseY = box.position.y;
            box.add(new THREE.LineSegments(edgeGeo,
                new THREE.LineBasicMaterial({color: 0xC9A227, transparent: true, opacity: 0.55})));
            s.root.add(box);
            blocks.push(box);
            labels.push({canvas: cv, tex: tex});

            if (i === 0) { // camera lens on top of the sensor
                var barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.14, 24), brassMat);
                barrel.position.set(0, 0.34, 0);
                box.add(barrel);
                var glass = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 16),
                    new THREE.MeshStandardMaterial({color: 0x3FA7A0, metalness: 0.2, roughness: 0.05, emissive: 0x0d3b38}));
                glass.position.set(0, 0.42, 0);
                glass.scale.y = 0.5;
                box.add(glass);
            }
            if (i === 1) { // pins on both long sides so the chip reads as a chip
                for (var p = -4; p <= 4; p++) {
                    [-1, 1].forEach(function (sd) {
                        var pin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.05), brassMat);
                        pin.position.set(p * 0.11, sd * 0.33, 0);
                        box.add(pin);
                    });
                }
            }
            if (i === 2) { // signing stamp
                var stamp = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 10, 28), brassMat);
                stamp.position.set(0, 0.5, 0);
                stamp.rotation.x = Math.PI / 2;
                box.add(stamp);
                box.userData.stamp = stamp;
            }
            if (i === 3) { // server rack slabs
                [0.34, 0.44].forEach(function (y) {
                    var slab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.4), side);
                    slab.position.set(0, y, 0);
                    box.add(slab);
                    var led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.02),
                        new THREE.MeshBasicMaterial({color: 0x3FA7A0}));
                    led.position.set(0.35, y, 0.21);
                    box.add(led);
                });
            }
        });

        // links: a beam plus a small ring on every segment
        var links = [], beams = [];
        var up = new THREE.Vector3(0, 1, 0);
        for (var i = 0; i < names.length - 1; i++) {
            var a = blocks[i].position, b = blocks[i + 1].position;
            var mid = a.clone().add(b).multiplyScalar(0.5);
            var dir = b.clone().sub(a);
            var len = dir.length();
            var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 8),
                new THREE.MeshBasicMaterial({color: 0x4A505B}));
            beam.position.copy(mid);
            beam.quaternion.setFromUnitVectors(up, dir.clone().normalize());
            s.root.add(beam);
            beams.push(beam);
            var link = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 12, 32),
                new THREE.MeshStandardMaterial({color: 0xC9A227, metalness: 0.9, roughness: 0.3, emissive: 0x000000}));
            link.position.copy(mid);
            link.rotation.y = Math.PI / 2;
            s.root.add(link);
            links.push(link);
        }
        var breakPoint = links[2].position.clone();

        // the traveller: a small photo with signature seals
        function photoCanvas(bad) {
            var c = document.createElement('canvas');
            c.width = 128;
            c.height = 96;
            var g = c.getContext('2d');
            var sky = g.createLinearGradient(0, 0, 0, 96);
            sky.addColorStop(0, '#2b4a6f');
            sky.addColorStop(1, '#e9a65b');
            g.fillStyle = sky;
            g.fillRect(0, 0, 128, 96);
            g.fillStyle = '#f4d27a';
            g.beginPath();
            g.arc(92, 38, 12, 0, 7);
            g.fill();
            g.fillStyle = '#1c2430';
            g.beginPath();
            g.moveTo(0, 96);
            g.lineTo(34, 42);
            g.lineTo(62, 78);
            g.lineTo(84, 56);
            g.lineTo(128, 96);
            g.fill();
            if (bad) {
                // glitch: shift horizontal slices, then tint red
                var src = document.createElement('canvas');
                src.width = 128;
                src.height = 96;
                src.getContext('2d').drawImage(c, 0, 0);
                for (var k = 0; k < 9; k++) {
                    var y = (k * 37) % 90;
                    g.drawImage(src, 0, y, 128, 7, (k % 2 ? 1 : -1) * (6 + k), y, 128, 7);
                }
                g.fillStyle = 'rgba(230,69,69,0.38)';
                g.fillRect(0, 0, 128, 96);
            }
            return c;
        }

        var photoGood = new THREE.CanvasTexture(photoCanvas(false));
        var photoBad = new THREE.CanvasTexture(photoCanvas(true));
        var traveller = new THREE.Group();
        var photoMat = new THREE.MeshBasicMaterial({map: photoGood, side: THREE.DoubleSide});
        var photo = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), photoMat);
        var frameMat = new THREE.MeshBasicMaterial({color: 0xEDEBE6, side: THREE.DoubleSide});
        var frame = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.36), frameMat);
        frame.position.z = -0.003;
        traveller.add(frame);
        traveller.add(photo);
        var glow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: dotTexture(), color: 0xC9A227, transparent: true,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        glow.scale.set(1.0, 1.0, 1.0);
        glow.position.z = -0.05;
        traveller.add(glow);
        var seals = [];
        for (var k = 0; k < 3; k++) {
            var seal = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 8, 16),
                new THREE.MeshBasicMaterial({color: 0x3FA7A0}));
            seal.position.set(0.27, 0.14 - k * 0.1, 0.01);
            traveller.add(seal);
            seals.push(seal);
        }
        s.root.add(traveller);

        // glowing trail behind the photo
        var TRAIL = 28;
        var trailPos = new Float32Array(TRAIL * 3);
        var trailGeo = new THREE.BufferGeometry();
        trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
        var trailMat = new THREE.PointsMaterial({
            map: dotTexture(), color: 0xC9A227, size: 0.16, transparent: true, opacity: 0.8,
            blending: THREE.AdditiveBlending, depthWrite: false
        });
        var trail = new THREE.Points(trailGeo, trailMat);
        trail.frustumCulled = false;
        s.root.add(trail);

        // the attacker: a red spiky shard that drops onto the third link
        var attacker = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0),
            new THREE.MeshStandardMaterial({color: 0xE64545, emissive: 0x7a1414, metalness: 0.5, roughness: 0.4, flatShading: true}));
        var aGlow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: dotTexture(), color: 0xE64545, transparent: true,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        aGlow.scale.set(0.9, 0.9, 0.9);
        attacker.add(aGlow);
        attacker.visible = false;
        s.root.add(attacker);

        // sparks at the break
        var SP = 36;
        var spPos = new Float32Array(SP * 3), spDir = [];
        for (var k = 0; k < SP; k++) {
            spDir.push(new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize()
                .multiplyScalar(0.3 + Math.random() * 0.5));
        }
        var spGeo = new THREE.BufferGeometry();
        spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
        var sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({
            map: dotTexture(), color: 0xE64545, size: 0.1, transparent: true,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        sparks.frustumCulled = false;
        sparks.visible = false;
        s.root.add(sparks);

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
            var fresh = labelCanvas(map[0], map[1], map[2], '05');
            viewer.canvas.getContext('2d').drawImage(fresh, 0, 0);
            viewer.tex.needsUpdate = true;
            if (status) {
                status.textContent = state === 'ok' ? 'authentic image' : state === 'ko' ? 'tampered image' : 'in transit';
                status.className = state === 'ko' ? 'red' : '';
            }
        }

        var NONE = new THREE.Color(0, 0, 0);
        s.loop(function (t) {
            // 7 s per trip; every second trip gets tampered between SIGNED EDIT and PLATFORM
            var trip = Math.floor(t / 7), f = (t % 7) / 6, tampered = trip % 2 === 1;
            var seg = Math.min(3.999, f * 4), si = Math.floor(seg), sf = seg - si;
            var broken = tampered && seg > 2.5;
            var running = f <= 1;

            blocks.forEach(function (bk, i) {
                bk.position.y = bk.userData.baseY + Math.sin(t * 1.2 + i) * 0.035;
            });
            blocks[2].userData.stamp.rotation.z = t * 1.5;

            // traveller
            traveller.visible = running;
            trail.visible = running;
            if (running) {
                traveller.position.lerpVectors(blocks[si].position, blocks[si + 1].position, sf);
                traveller.position.y += 0.5 + Math.sin(t * 3) * 0.04;
                traveller.position.z += 0.35;
                traveller.rotation.y = Math.sin(t * 2) * 0.25;
                traveller.rotation.z = broken ? Math.sin(t * 25) * 0.12 : 0;
                var wantMap = broken ? photoBad : photoGood;
                if (photoMat.map !== wantMap) {
                    photoMat.map = wantMap;
                    photoMat.needsUpdate = true;
                }
                glow.material.color.copy(broken ? RED : BRASS);
                frameMat.color.copy(broken ? RED : PAPER);
                seals.forEach(function (sl, j) {
                    sl.visible = broken ? j < 2 : seg >= j + 0.9;
                    sl.material.color.copy(broken ? RED : TEAL);
                    sl.rotation.z = t * 2;
                });
                for (var k = TRAIL - 1; k > 0; k--) {
                    for (var c = 0; c < 3; c++) {
                        trailPos[k * 3 + c] += (trailPos[(k - 1) * 3 + c] - trailPos[k * 3 + c]) * 0.55;
                    }
                }
                trailPos[0] = traveller.position.x;
                trailPos[1] = traveller.position.y - 0.25;
                trailPos[2] = traveller.position.z;
                trailGeo.attributes.position.needsUpdate = true;
                trailMat.color.copy(broken ? RED : BRASS);
            }

            // beams and rings
            beams.forEach(function (bm, k) {
                var bad = tampered && k === 2 && seg > 2.5;
                var done = running && k < si;
                if (bad) {
                    bm.visible = Math.sin(t * 40) > 0;
                    bm.material.color.copy(RED);
                } else {
                    bm.visible = true;
                    bm.material.color.copy(done ? (tampered && k > 2 ? RED : TEAL) : (running && k === si ? BRASS : GREY));
                }
            });
            links.forEach(function (l, k) {
                var bad = tampered && k === 2 && seg > 2.5;
                l.material.color.copy(bad ? RED : BRASS);
                l.material.emissive.copy(bad ? RED : NONE).multiplyScalar(bad ? 0.6 : 0);
                l.rotation.x = bad ? Math.sin(t * 40) * 0.25 : 0;
            });

            // attacker drops onto link 3 while the photo approaches
            var attacking = tampered && running && seg > 1.6 && seg < 3.4;
            attacker.visible = attacking;
            if (attacking) {
                var drop = Math.min(1, (seg - 1.6) / 0.9);
                attacker.position.set(breakPoint.x, breakPoint.y + 1.4 - drop * 0.95 + Math.sin(t * 6) * 0.05, breakPoint.z + 0.1);
                attacker.rotation.x = t * 3;
                attacker.rotation.y = t * 2;
            }

            // sparks at the break
            sparks.visible = tampered && running && seg > 2.5 && seg < 3.6;
            if (sparks.visible) {
                for (var k = 0; k < SP; k++) {
                    var age = (t * 1.6 + k / SP) % 1;
                    spPos[k * 3] = breakPoint.x + spDir[k].x * age;
                    spPos[k * 3 + 1] = breakPoint.y + spDir[k].y * age - age * age * 0.5;
                    spPos[k * 3 + 2] = breakPoint.z + spDir[k].z * age;
                }
                spGeo.attributes.position.needsUpdate = true;
            }

            rim.color.copy(broken ? RED : BRASS);
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
