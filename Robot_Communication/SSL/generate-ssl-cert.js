const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

process.chdir(__dirname);

async function main() {
    let forge;
    try {
        forge = require('node-forge');
    } catch (e) {
        console.log('📦 node-forge not found. Installing...');
        try {
            execSync('npm install node-forge', { stdio: 'inherit' });
            forge = require('node-forge');
            console.log('✅ node-forge installed and loaded.');
        } catch (installError) {
            console.error('❌ Failed to install node-forge. Please run "npm install node-forge" manually.');
            return;
        }
    }

    generateSelfSignedCert(forge);
}

function generateSelfSignedCert(forge) {
    console.log('🛠️ Generating SSL certificate...');
    
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    
    cert.publicKey = keys.publicKey;
    cert.serialNumber = Math.floor(Math.random() * 1000000).toString();
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);
    
    const interfaces = os.networkInterfaces();
    const ips = [];
    Object.keys(interfaces).forEach(name => {
        interfaces[name].forEach(iface => {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push(iface.address);
            }
        });
    });

    const attrs = [
        { name: 'commonName', value: 'liust.local' },
        { name: 'organizationName', value: 'Liust Robotics' }
    ];
    
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    
    const altNames = [
        { type: 2, value: 'localhost' },
        { type: 2, value: 'liust.local' },
        { type: 7, ip: '127.0.0.1' },
        ...ips.map(ip => ({ type: 7, ip: ip })),
        ...ips.map(ip => ({ type: 2, value: ip })) 
    ];
    
    cert.setExtensions([{
        name: 'basicConstraints', cA: true
    }, {
        name: 'keyUsage',
        keyCertSign: true, digitalSignature: true, keyEncipherment: true
    }, {
        name: 'subjectAltName',
        altNames: altNames
    }]);
    
    cert.sign(keys.privateKey, forge.md.sha256.create());
    
    fs.writeFileSync('key.pem', forge.pki.privateKeyToPem(keys.privateKey));
    fs.writeFileSync('cert.pem', forge.pki.certificateToPem(cert));
    
    console.log('\n✅ SSL certificate generation completed!');
    console.log('Files saved in:', __dirname);
    ips.forEach(ip => console.log(`  - Supported IP: ${ip}`));
}

main();
