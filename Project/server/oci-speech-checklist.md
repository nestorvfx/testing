/**
 * OCI Speech Service Checklist
 * 
 * This file contains a checklist for troubleshooting OCI Speech service issues.
 * Use this as a guide to identify and fix common problems with OCI Speech authentication.
 */

/**
 * 1. Check Authentication Basics
 * 
 * [ ] Verify the private key file exists and is in PEM format
 * [ ] Confirm the public key is uploaded to your OCI user account
 * [ ] Ensure the fingerprint in config.txt matches the one shown in OCI Console
 * [ ] Check that user and tenancy OCIDs are correct
 * [ ] Verify the user account is active and not locked
 * 
 * If authentication is working for other OCI services but not Speech, 
 * the issue is likely with Speech service permissions or availability.
 */

/**
 * 2. Check IAM Policies
 * 
 * Speech service requires specific IAM policies. Add these to your tenancy:
 * 
 * [ ] Allow group [YourGroup] to use ai-service-speech-family in compartment [YourCompartment]
 * [ ] Allow group [YourGroup] to use ai-service-speech-family in tenancy
 * [ ] Allow group [YourGroup] to read objectstorage-namespaces in tenancy
 * 
 * If you're using a Resource Principal instead of an API key:
 * [ ] Allow dynamic-group [YourDynamicGroup] to use ai-service-speech-family in compartment [YourCompartment]
 */

/**
 * 3. Check Service Availability
 * 
 * [ ] Verify Speech service is available in your region (eu-amsterdam-1)
 *     List of regions with Speech service: https://docs.oracle.com/en-us/iaas/Content/General/Concepts/regions.htm
 * 
 * [ ] Ensure the Speech service is subscribed in your tenancy
 *     - OCI Console > AI Services > Speech
 *     - Check if you see "Subscribe" option or if it shows the service as available
 * 
 * [ ] Check service limits and quotas
 *     - OCI Console > Limits, Quotas and Usage
 *     - Search for "speech"
 */

/**
 * 4. Check API Endpoints
 * 
 * [ ] Verify you're using the correct API endpoints for your region
 *     - Speech API: speech.aiservice.{region}.oci.oraclecloud.com
 *     - API Endpoint: /20220101/realtimeSessionTokens (note the plural form)
 *     - Realtime WebSocket: realtime.aiservice.{region}.oci.oraclecloud.com
 * 
 * [ ] Check network connectivity to these endpoints
 *     - Run: ping speech.aiservice.{region}.oci.oraclecloud.com
 *     - Run: curl -v https://speech.aiservice.{region}.oci.oraclecloud.com
 */

/**
 * 5. Check Request Parameters
 * 
 * [ ] Ensure you're using the correct API version (20220101)
 * [ ] Check that the compartmentId parameter is set correctly
 * [ ] Verify all required parameters are included
 */

/**
 * Common Error Codes and Solutions:
 * 
 * - NotAuthenticated (401): Authentication failed
 *   Solution: Regenerate your API keys and verify credentials
 * 
 * - NotAuthorizedOrNotFound (404): Authorization failed or resource not found
 *   Solution: Check IAM policies, verify service is enabled in your tenancy/region
 * 
 * - LimitExceeded: Service limits reached
 *   Solution: Request a service limit increase
 * 
 * - InvalidParameter: Bad request parameters
 *   Solution: Check all parameters in your API request
 */

/**
 * Additional Resources:
 * 
 * - OCI Speech Documentation:
 *   https://docs.oracle.com/en-us/iaas/Content/speech/home.htm
 * 
 * - Troubleshooting OCI Authentication:
 *   https://docs.oracle.com/en-us/iaas/Content/API/Concepts/troubleshoot.htm
 * 
 * - OCI IAM Policy Reference:
 *   https://docs.oracle.com/en-us/iaas/Content/Identity/Reference/policyreference.htm
 */
