const forge = require('node-forge');
const fs = require('fs');
const os = require('os');

function generateSelfSignedCert() {
  console.log('Generating SSL certificate...');
  
  // Generate key pair
  const keys = forge.pki.rsa.generateKeyPair(2048);
  
  // Create certificate
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  
  // Get local IP addresses
  const interfaces = os.networkInterfaces();
  const ips = [];
  
  Object.keys(interfaces).forEach(name => {
    interfaces[name].forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    });
  });
  
  // Certificate subject information
  const attrs = [{
    name: 'commonName',
    value: ips[0] || 'localhost' // First IP or localhost
  }, {
    name: 'countryName',
    value: 'CN'
  }, {
    name: 'stateOrProvinceName',
    value: 'Beijing'
  }, {
    name: 'localityName',
    value: 'Beijing'
  }, {
    name: 'organizationName',
    value: 'Time Server'
  }, {
    name: 'organizationalUnitName',
    value: 'Development'
  }];
  
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  
  cert.setExtensions([{
    name: 'basicConstraints',
    cA: false
  }, {
    name: 'keyUsage',
    keyCertSign: false,
    digitalSignature: true,
    nonRepudiation: false,
    keyEncipherment: true,
    dataEncipherment: true
  }, {
    name: 'subjectAltName',
    altNames: [
      { type: 2, value: 'localhost' },
      { type: 7, ip: '127.0.0.1' },
      ...ips.map(ip => ({ type: 7, ip: ip })),
      ...ips.map(ip => ({ type: 2, value: ip }))
    ]
  }]);
  
  cert.sign(keys.privateKey);
  
  const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
  const certPem = forge.pki.certificateToPem(cert);
  
  fs.writeFileSync('key.pem', keyPem);
  fs.writeFileSync('cert.pem', certPem);
  
  console.log('SSL certificate generation completed!');
  console.log('Files saved:');
  console.log('  - key.pem (private key)');
  console.log('  - cert.pem (certificate)');
  console.log('\nCertificate Information:');
  console.log('  - Validity: 1 year');
  console.log('  - Supported domains/IPs:');
  console.log('    * localhost');
  console.log('    * 127.0.0.1');
  ips.forEach(ip => console.log(`    * ${ip}`));
  
  return { keyPem, certPem, ips };
}

async function main() {
  try {
    try {
      require('node-forge');
    } catch (e) {
      console.log('installing node-forge...');
      const { execSync } = require('child_process');
      execSync('npm install node-forge', { stdio: 'inherit' });
    }
    
    generateSelfSignedCert();
  } catch (error) {
    console.error('Certificate generation failed:', error);
  }
}

if (require.main === module) {
  main();
}

module.exports = { generateSelfSignedCert };