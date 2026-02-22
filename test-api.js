const http = require('http');

setTimeout(async () => {
    try {
        console.log('Testing /api/info...');
        const res = await fetch('http://localhost:3456/api/info');
        console.log('Status:', res.status);
        const data = await res.json();
        console.log('Response:', JSON.stringify(data, null, 2));

        if (res.status === 200 && data.port === 3456) {
            console.log('\n✅ /api/info test passed.\n');
        } else {
            console.error('\n❌ /api/info test failed.\n');
        }
    } catch (e) {
        console.error('Fetch error:', e);
    }
    process.exit(0);
}, 2000);
