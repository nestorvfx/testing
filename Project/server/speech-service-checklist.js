/**
 * OCI Speech Service Setup Checklist
 * 
 * Use this checklist to ensure that your OCI environment 
 * is properly configured for the Speech service.
 */

// 1. OCI Console Tasks
console.log('=== OCI Speech Service Setup Checklist ===');
console.log('Perform these steps in your OCI Console:');

console.log('\n1. Enable Speech Service:');
console.log('   - Log in to OCI Console: https://cloud.oracle.com');
console.log('   - Navigate to "AI Services" > "Speech"');
console.log('   - If you see a "Subscribe" or "Enable" button, click it to enable the service');
console.log('   - If the service is already enabled, you should see the Speech dashboard');

console.log('\n2. Add IAM Policies:');
console.log('   - Navigate to "Identity & Security" > "Policies"');
console.log('   - Create a new policy with these statements:');
console.log('     allow group [YourGroup] to manage ai-service-speech-family in tenancy');
console.log('     allow group [YourGroup] to use object-family in tenancy');
console.log('   - Replace [YourGroup] with the group your user belongs to');
console.log('   - If not using groups, you can use: allow any-user to manage ai-service-speech-family in tenancy');

console.log('\n3. Check Service Availability:');
console.log('   - Navigate to "Governance & Administration" > "Limits, Quotas and Usage"');
console.log('   - Search for "speech"');
console.log('   - Verify that you have quota available for Speech service');
console.log('   - If not, submit a service limit increase request');

console.log('\n4. Try a Different Region:');
console.log('   - The Speech service may not be available in eu-amsterdam-1');
console.log('   - Edit your config.txt to try one of these regions:');
console.log('     us-ashburn-1, us-phoenix-1, eu-frankfurt-1, uk-london-1');

console.log('\n5. Verify API Key:');
console.log('   - Navigate to "Identity & Security" > "Users" > [Your User]');
console.log('   - Click on "API Keys"');
console.log('   - Verify that your API key is active and the fingerprint matches your config');
console.log('   - If needed, add a new API key using the public key file');

console.log('\n=== Troubleshooting Tips ===');
console.log('1. If you receive 401 errors:');
console.log('   - Regenerate your API key pair');
console.log('   - Upload the new public key to your OCI user');
console.log('   - Update your config.txt with the new fingerprint and key file');

console.log('\n2. If you receive 404 "NotAuthorizedOrNotFound" errors:');
console.log('   - Check that the Speech service is enabled in your tenancy');
console.log('   - Verify your IAM policies allow access to ai-service-speech-family');
console.log('   - Try a different region where the service is available');

console.log('\n3. Run the region test script:');
console.log('   node test-speech-regions.js');
console.log('   This will help identify regions where the service is available for your account');

console.log('\n=== Required IAM Policy Template ===');
console.log('# Create a policy named "SpeechServicePolicy" with these statements:');
console.log('allow group [YourGroup] to manage ai-service-speech-family in tenancy');
console.log('allow group [YourGroup] to use object-family in tenancy');
console.log('allow group [YourGroup] to read tag-namespaces in tenancy');

console.log('\n=== Contact Oracle Support ===');
console.log('If you have verified all of the above and still cannot access the Speech service,');
console.log('contact Oracle Support to check if there are any service issues or if the service');
console.log('requires specific enablement for your tenancy.');
