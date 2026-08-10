document.addEventListener('DOMContentLoaded', () => {
    // Create the banner structure
    const banner = document.createElement('div');
    banner.className = 'supporters-bar';
    banner.innerHTML = '<div id="supporter-message">Thank you to our Supporters: <span id="supporter-name" style="opacity: 0; transition: opacity 0.5s ease-in-out; color: #00bfff; font-weight: bold;">Loading...</span></div>';
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
            const messageDiv = banner.querySelector('#supporter-message');
            const nameSpan = banner.querySelector('#supporter-name');

            if (supporters.length === 0) {
                console.error('No supporters found in the file');
                messageDiv.innerHTML = 'Thank you to our Supporters';
                return;
            }

            let currentIndex = 0;

            const updateSupporter = () => {
                // Fade out name
                nameSpan.style.opacity = '0';

                setTimeout(() => {
                    // Update text
                    const name = supporters[currentIndex];
                    nameSpan.textContent = name;

                    // Fade in name
                    nameSpan.style.opacity = '1';

                    // Move to next supporter
                    currentIndex = (currentIndex + 1) % supporters.length;
                }, 500); // Wait for fade out (matches transition time)
            };

            // Start the cycle
            updateSupporter();

            // Cycle every 4 seconds (0.5s fade out + 3s visible + 0.5s fade in approximation)
            setInterval(updateSupporter, 4000);
        })
        .catch(error => {
            console.error('Error loading supporters:', error);
            const messageDiv = banner.querySelector('#supporter-message');
            messageDiv.innerHTML = 'Thank you to our Supporters: <span style="color: #ff0000;">Error loading</span>';
        });
});
