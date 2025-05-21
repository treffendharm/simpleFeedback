(function() {
    const params = new URLSearchParams(window.location.search);
    if(!params.has('clientComment')) return;

    // Load styles
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'embed.css';
    document.head.appendChild(link);

    const s = document.createElement('script');
    s.src = './embed.js';
    s.defer = true;
    document.head.appendChild(s);
})()