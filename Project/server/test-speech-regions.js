/**
 * OCI Speech Region Test
 * 
 * This script tests the OCI Speech service across different regions
 * to find one where the service is available for your tenancy.
 */

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load configuration
const CONFIG_PATH = path.join(__dirname, 'config', 'config.txt');
const configData = fs.readFileSync(CONFIG_PATH, 'utf8');

const config = {};
configData.split('\n').forEach(line => {
  if (!line.trim() || line.trim().startsWith('//') || line.trim().startsWith('[')) {
    return;
  }
  
  const [key, value] = line.split('=').map(part => part.trim());
  if (key && value) {
    config[key] = value;
  }
});

// Load private key
const privateKeyPath = path.join(__dirname, 'config', config.key_file);
config.privateKey = fs.readFileSync(privateKeyPath, 'utf8');

// Regions to test
const regionsToTest = [
  'us-ashburn-1',    // US East (Ashburn)
  'us-phoenix-1',    // US West (Phoenix)
  'uk-london-1',     // UK South (London)
  'eu-frankfurt-1',  // Germany Central (Frankfurt)
  'ap-mumbai-1',     // India West (Mumbai)
  'ap-tokyo-1',      // Japan East (Tokyo)
  'ap-singapore-1',  // Singapore (Singapore)
  'eu-amsterdam-1',  // Netherlands Northwest (Amsterdam) - current region
];

// Sign request for OCI
const signRequest = (request, config) => {
  const { host, path, method, headers, privateKey } = request;
  
  // Headers to sign
  const headersToSign = Object.keys(headers)
    .map(key => key.toLowerCase())
    .filter(key => ['host', 'date', '(request-target)'].includes(key))
    .sort();
  
  // Create signing string
  let signingString = '';
  headersToSign.forEach(header => {
    if (header === '(request-target)') {
      signingString += `(request-target): ${method.toLowerCase()} ${path}\n`;
    } else {
      signingString += `${header}: ${headers[header]}\n`;
    }
  });
  
  signingString = signingString.trim();
  
  // Create signature
  const sign = crypto.createSign('sha256');
  sign.update(signingString);
  sign.end();
  
  const signature = sign.sign(privateKey, 'base64');
  
  // Format authorization header
  const keyId = `${config.tenancy}/${config.user}/${config.fingerprint}`;
  const authorization = `Signature version="1",keyId="${keyId}",algorithm="rsa-sha256",headers="${headersToSign.join(' ')}",signature="${signature}"`;
  
  return authorization;
};

// Make request to OCI Speech service in a specific region
const testRegion = (region) => {
  return new Promise((resolve) => {
    const date = new Date().toUTCString();
    const host = `speech.aiservice.${region}.oci.oraclecloud.com`;
    const path = '/20220101/realtimeSessionTokens'; // Updated from realtimeSessionToken to realtimeSessionTokens
    
    // Prepare request for signing
    const requestInfo = {
      host,
      path,
      method: 'POST',
      headers: {
        'host': host,
        'date': date,
        'content-type': 'application/json'
      },
      privateKey: config.privateKey
    };
    
    // Generate authorization header
    const authorization = signRequest(requestInfo, config);
    
    // Request body
    const requestBody = JSON.stringify({
      compartmentId: config.tenancy
    });
    
    // Request options
    const options = {
      hostname: host,
      port: 443,
      path,
      method: 'POST',
      headers: {
        'Date': date,
        'Authorization': authorization,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };
    
    // Make request
    console.log(`Testing region ${region}...`);
    
    const req = https.request(options, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        console.log(`Region ${region}: Status ${response.statusCode}`);
        
        try {
          const jsonData = JSON.parse(data);
          resolve({
            region,
            status: response.statusCode,
            data: jsonData,
            success: response.statusCode >= 200 && response.statusCode < 300
          });
        } catch (e) {
          resolve({
            region,
            status: response.statusCode,
            data: data,
            success: false
          });
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`Region ${region} error: ${error.message}`);
      resolve({
        region,
        status: 'ERROR',
        data: error.message,
        success: false
      });
    });
    
    // Write request body for POST request
    req.write(requestBody);
    req.end();
  });
};

// Test all regions
const testAllRegions = async () => {
  console.log('=== Testing OCI Speech Service in Different Regions ===');
  console.log(`User: ${config.user}`);
  console.log(`Tenancy: ${config.tenancy}`);
  console.log();
  
  const results = [];
  
  for (const region of regionsToTest) {
    const result = await testRegion(region);
    results.push(result);
    
    // Add a short delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Print summary
  console.log('\n=== Results Summary ===');
  
  const successfulRegions = results.filter(r => r.success);
  const failedRegions = results.filter(r => !r.success);
  
  if (successfulRegions.length > 0) {
    console.log('\nRegions where Speech service is available:');
    successfulRegions.forEach(r => {
      console.log(`- ${r.region} (Status: ${r.status})`);
    });
    
    console.log('\nRecommendation: Update your config.txt to use one of these regions.');
  } else {
    console.log('\nSpeech service is not available in any of the tested regions.');
    console.log('Recommendation:');
    console.log('1. Enable the Speech service in your OCI console');
    console.log('2. Add the required IAM policies for the Speech service');
    console.log('3. Check if your tenancy has access to the Speech service');
  }
  
  // Check for specific error patterns
  const notAuthorizedCount = failedRegions.filter(r => {
    try {
      if (typeof r.data === 'string') {
        const jsonData = JSON.parse(r.data);
        return jsonData.code === 'NotAuthorizedOrNotFound';
      }
      return r.data.code === 'NotAuthorizedOrNotFound';
    } catch (e) {
      return false;
    }
  }).length;
  
  if (notAuthorizedCount === regionsToTest.length) {
    console.log('\nAll regions returned "NotAuthorizedOrNotFound" error, which suggests:');
    console.log('1. The Speech service is not enabled in your tenancy');
    console.log('2. Your user does not have the required IAM policies');
    console.log('3. You need to add these policies to your tenancy:');
    console.log('   allow group [YourGroup] to manage ai-service-speech-family in tenancy');
    console.log('   allow group [YourGroup] to use object-family in tenancy');
  }
  
  // Write detailed results to file
  const detailedResults = {
    timestamp: new Date().toISOString(),
    config: {
      user: config.user,
      tenancy: config.tenancy,
      fingerprint: config.fingerprint
    },
    results: results.map(r => ({
      region: r.region,
      status: r.status,
      success: r.success,
      data: r.data
    }))
  };
  
  fs.writeFileSync(
    path.join(__dirname, 'speech-region-test-results.json'),
    JSON.stringify(detailedResults, null, 2)
  );
  
  console.log('\nDetailed results written to speech-region-test-results.json');
};

// Run the tests
testAllRegions().catch(error => {
  console.error('Error running tests:', error);
});
