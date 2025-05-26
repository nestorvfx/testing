# OCI Speech Authentication Proxy Server

This server provides authentication for the Oracle Cloud Infrastructure (OCI) Speech-to-Text service. It acts as a proxy between the client application and OCI, handling the complex authentication requirements.

## How It Works

1. The server receives requests from the client application for a session token
2. It loads OCI credentials from the config files
3. It signs the request using OCI's requirements and the private key
4. It sends a request to OCI to get a session token
5. It returns the token and a pre-constructed WebSocket URL to the client

## Configuration

Ensure your OCI credentials are properly set up in `config/config.txt` with the following format:

```
user=ocid1.user.oc1..aaaaaaaa...
fingerprint=xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx
tenancy=ocid1.tenancy.oc1..aaaaaaaa...
region=your-region-1
key_file=your-private-key.pem
compartmentId=ocid1.tenancy.oc1..aaaaaaaa...
```

Make sure your private key file (`your-private-key.pem`) is in the `config/` directory.

## Installation

```bash
npm install
```

## Running the Server

```bash
npm start
```

This will start the server on port 3001 (or the port specified in the PORT environment variable).

## API Endpoints

- `GET /api/speech/session-token`: Returns a session token and WebSocket URL for connecting to OCI Speech service

## Troubleshooting

### 404 NotAuthorizedOrNotFound Error

If you see this error:

```
Error getting session token: {
  statusCode: 404,
  message: 'NotAuthorizedOrNotFound'
}
```

Check the following:

1. Verify that all credentials in your config file belong to the same tenancy
2. Ensure your OCI user has the proper permissions and policies set up
3. Validate that your private key file is correctly formatted and accessible
4. Confirm the key file path is correctly specified in your config.txt
