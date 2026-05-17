function switchTab(tabId, theme) {
            const contents = document.querySelectorAll('.tab-content');
            const buttons = document.querySelectorAll('.tab-button');
            const panel = document.getElementById('display-panel');
            
            contents.forEach(content => content.classList.remove('active'));
            buttons.forEach(button => button.classList.remove('active'));
            
            document.getElementById(tabId).classList.add('active');
            
            const clickedButton = Array.from(buttons).find(btn => btn.getAttribute('onclick').includes(tabId));
            if (clickedButton) clickedButton.classList.add('active');

            if (panel) {
                panel.className = 'manual-panel theme-' + theme;
            }
        }
