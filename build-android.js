
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Building Transport Invoice for Android...');

// Create build directory
if (!fs.existsSync('build')) {
    fs.mkdirSync('build');
}

// Copy all files to build directory
const filesToCopy = [
    'index.html',
    'style.css',
    'script.js',
    'manifest.json',
    'sw.js',
    'privacy-policy.html',
    'terms.html',
    'splash.html',
    'icon-192.png',
    'icon-512.png'
];

filesToCopy.forEach(file => {
    if (fs.existsSync(file)) {
        fs.copyFileSync(file, path.join('build', file));
        console.log(`✅ Copied ${file}`);
    }
});

// Create Android-specific index.html
const androidHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Transport Invoice</title>
    <link href="style.css" rel="stylesheet" type="text/css" />
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    <script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyC21qVY3uVkvA8cfV6-Ob1mjdg_8HSWk9s&libraries=places,geometry"></script>
    
    <!-- PWA Manifest -->
    <link rel="manifest" href="manifest.json">
    <meta name="theme-color" content="#3498db">
    
    <!-- Android specific meta tags -->
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    
    <!-- Prevent zoom on input focus -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    
    <!-- Favicons -->
    <link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
    <link rel="icon" type="image/png" sizes="512x512" href="icon-512.png">
</head>
<body>
    <div id="splash-screen" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #2c3e50; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 9999;">
        <img src="icon-192.png" alt="Transport Invoice" style="width: 120px; height: 120px; margin-bottom: 2rem; border-radius: 20px;">
        <h1 style="color: white; font-family: Arial, sans-serif; margin-bottom: 1rem;">Transport Invoice</h1>
        <div style="color: #3498db; font-size: 18px;">Loading...</div>
        <div style="width: 50px; height: 50px; border: 5px solid #34495e; border-top: 5px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; margin-top: 1rem;"></div>
    </div>
    
    <div class="container" style="display: none;" id="main-app">
        <!-- Main app content will be loaded here -->
    </div>
    
    <style>
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
    
    <script>
        // Hide splash screen after 3 seconds
        setTimeout(() => {
            document.getElementById('splash-screen').style.display = 'none';
            document.getElementById('main-app').style.display = 'block';
            // Load main app content
            loadMainApp();
        }, 3000);
        
        function loadMainApp() {
            // Load the main app content from original index.html
            fetch('index.html')
                .then(response => response.text())
                .then(html => {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    const mainContent = doc.querySelector('.container');
                    if (mainContent) {
                        document.getElementById('main-app').innerHTML = mainContent.innerHTML;
                    }
                })
                .catch(error => {
                    console.error('Error loading main app:', error);
                    // Fallback: redirect to original index.html
                    window.location.href = 'index.html';
                });
        }
    </script>
    <script src="script.js"></script>
</body>
</html>`;

fs.writeFileSync(path.join('build', 'android-index.html'), androidHtml);

console.log('✅ Android build preparation complete!');
console.log('📱 Next steps:');
console.log('1. Use Capacitor or Cordova to build APK');
console.log('2. Test on Android device');
console.log('3. Generate signed APK for Play Store');
