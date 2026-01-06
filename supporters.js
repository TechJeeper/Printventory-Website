document.addEventListener('DOMContentLoaded', () => {
    // Create the banner structure
    const banner = document.createElement('div');
    banner.className = 'supporters-bar';
    banner.innerHTML = `
      <div class="supporters-container">
        <span class="supporters-title">Thank You Patreon Supporters:</span>
        <div class="supporters-list" id="supporters-list"></div>
      </div>
    `;
    document.body.appendChild(banner);

    // Adjust body padding to prevent overlap
    document.body.style.paddingBottom = '50px';

    // Load and display supporters
    fetch('supporters.list')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text();
        })
        .then(text => {
            const supporters = text.split('\n').filter(name => name.trim());
            const supportersList = banner.querySelector('#supporters-list');

            if (supporters.length === 0) {
                console.error('No supporters found in the file');
                return;
            }

            // Create the content spans
            const createSpans = () => {
                return supporters.map(supporter => {
                    const span = document.createElement('span');
                    span.textContent = supporter;
                    span.className = 'supporter-name';
                    return span;
                });
            };

            // Add the content multiple times to ensure seamless scrolling
            // Calculate how many copies we need based on screen width vs content width
            // For simplicity, we'll just add it enough times (e.g., 4 times)
            for (let i = 0; i < 20; i++) {
                createSpans().forEach(span => supportersList.appendChild(span));
            }
        })
        .catch(error => {
            console.error('Error loading supporters:', error);
            const supportersList = banner.querySelector('#supporters-list');
            supportersList.innerHTML = '<span style="color: #ff0000;">Error loading supporters</span>';
        });
});
