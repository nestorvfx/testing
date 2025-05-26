# OCI Speech Integration Project

This project demonstrates integration of Oracle Cloud Infrastructure (OCI) Speech-to-Text service with a React Native application.

## Project Structure

The project is organized into two main directories:

- **client/**: The React Native application (Expo-based)
- **server/**: The authentication proxy server for OCI Speech API

## Quick Start

1. **Install dependencies for both client and server:**

```bash
# Install root dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..

# Install client dependencies
cd client
npm install
cd ..

# Or use the shortcut script to install all dependencies at once
npm run install:all
```

2. **Start the server and client:**

```bash
# Start both server and client with one command
npm run start:both

# OR run them separately:

# Start the server (in one terminal)
npm run start:server

# Start the client (in another terminal)
npm run start:client
```

## Testing the Speech Recognition

1. Start the server and client as described above
2. When the Expo client starts, open the app in a web browser or on a device
3. Use the voice button to test speech recognition
4. If OCI authentication works correctly, you'll see actual transcriptions
5. If authentication fails, the app will fall back to simulation mode

## Troubleshooting

If you encounter OCI authentication errors (404 NotAuthorizedOrNotFound), check:

1. Verify that all credentials in your config file belong to the same tenancy
2. Ensure your OCI user has the proper permissions and policies set up
3. Validate that your private key file is correctly formatted and accessible
4. Confirm the key file path is correctly specified in server/config/config.txt
5. Check that you're using the correct API endpoints according to OCI documentation
   - Speech API endpoint should be: `/20220101/realtimeSessionTokens` (note the plural form)

## Repository Structure

```
Project/
├── client/             # React Native Expo application
│   ├── components/     # UI components  
│   ├── services/       # Service modules including OCI voice integration
│   └── ...            
├── server/             # Authentication proxy server
│   ├── config/         # OCI configuration and keys
│   └── server.js       # Express server for authentication
├── package.json        # Root package.json with scripts to run client and server
└── README.md           # This file
```

For more detailed information, see the README.md files in client/ and server/ directories.

## License

Private - All rights reserved