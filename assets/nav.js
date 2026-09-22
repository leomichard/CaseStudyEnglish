(function () {
    'use strict';
    var pages = ['index.html', 'part-2-consent.html', 'part-3-trust.html', 'part-4-responses.html'];
    var here = location.pathname.split('/').pop() || 'index.html';
    var i = pages.indexOf(here);

    // ← / → : previous / next speaker page.  S : open/close the speaker script.
    document.addEventListener('keydown', function (e) {
        if (e.target.closest('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === 'ArrowRight' && i >= 0 && i < pages.length - 1) location.href = pages[i + 1];
        if (e.key === 'ArrowLeft' && i > 0) location.href = pages[i - 1];
        if (e.key === 's' || e.key === 'S') {
            var d = document.querySelector('details.script');
            if (d) {
                d.open = !d.open;
                if (d.open) d.scrollIntoView({behavior: 'smooth', block: 'start'});
            }
        }
    });

    // Looping muted video: use the local file media/<name>.mp4 if present,
    // otherwise fall back to the YouTube embed (needs internet + http://, not file://).
    document.querySelectorAll('.phone[data-youtube]').forEach(function (phone) {
        var id = phone.dataset.youtube;
        var video = phone.querySelector('video');

        function fallback() {
            if (phone.querySelector('iframe')) return;
            if (video) video.remove();
            var f = document.createElement('iframe');
            f.src = 'https://www.youtube-nocookie.com/embed/' + id +
                '?autoplay=1&mute=1&loop=1&playlist=' + id +
                '&controls=0&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&disablekb=1';
            f.allow = 'autoplay; encrypted-media; picture-in-picture';
            f.referrerPolicy = 'strict-origin-when-cross-origin';
            f.title = 'Looping muted video';
            phone.appendChild(f);
        }

        if (!video) return fallback();
        video.muted = true;
        video.addEventListener('error', fallback, true);
        var src = video.querySelector('source');
        if (src) src.addEventListener('error', fallback);
        var p = video.play();
        if (p && p.catch) p.catch(function () { /* autoplay blocked: stays on first frame */ });
    });
})();
