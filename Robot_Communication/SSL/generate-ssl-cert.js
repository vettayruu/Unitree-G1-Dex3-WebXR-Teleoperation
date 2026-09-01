const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

// 强制切换到脚本所在目录，确保生成的 pem 文件就在这里
process.chdir(__dirname);

async function main() {
    let forge;
    try {
        // 尝试加载，如果失败则进入 catch 安装
        forge = require('node-forge');
    } catch (e) {
        console.log('📦 node-forge not found. Installing...');
        try {
            // 在当前目录安装 node-forge
            execSync('npm install node-forge', { stdio: 'inherit' });
            // 安装完后重新 require
            forge = require('node-forge');
            console.log('✅ node-forge installed and loaded.');
        } catch (installError) {
            console.error('❌ Failed to install node-forge. Please run "npm install node-forge" manually.');
            return;
        }
    }

    // 只有加载成功了才执行生成逻辑
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
        ...ips.map(ip => ({ type: 2, value: ip })) // 兼容性：某些浏览器把IP当DNS
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

// 执行主函数
main();